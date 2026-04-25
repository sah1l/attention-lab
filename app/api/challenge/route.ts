import { NextResponse } from "next/server";
import { getAiGateway, extractJsonObject, extractText } from "@/lib/aiGateway";
import { normalizeChallenge, MAX_WORD_LENGTH } from "@/lib/challengeFallback";
import { maxDifficultyByLevel, type Challenge, type Level } from "@/lib/attentionData";
import { pickFromCorpus, pushToPool } from "@/lib/challengeCorpus";

export const runtime = "nodejs";

const AI_DEADLINE_MS = 45_000;
const FAST_PATH_MS = 15_000;

type ChallengeRequest = {
  level: Level;
  difficulty: number;
  round: number;
  previousSentences?: string[];
};

const allowedLevels: Level[] = ["beginner", "builder", "advanced"];

function isChallengeRequest(value: unknown): value is ChallengeRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ChallengeRequest>;
  return (
    typeof candidate.level === "string" &&
    allowedLevels.includes(candidate.level as Level) &&
    typeof candidate.difficulty === "number" &&
    Number.isFinite(candidate.difficulty) &&
    typeof candidate.round === "number" &&
    Number.isFinite(candidate.round)
  );
}

function challengePrompt(request: ChallengeRequest) {
  const levelRules: Record<Level, string> = {
    beginner:
      "Use a concrete everyday sentence with one obvious clue. Keep the sentence short and the correct answer easy to justify.",
    builder:
      "Use a moderately subtle sentence with two plausible nouns and one clue that resolves the target.",
    advanced:
      "Use a multi-clause sentence with abstract or technical nouns, realistic distractors, and a clue that requires careful reasoning."
  };

  const avoid = request.previousSentences?.slice(-8).join(" | ") || "none";

  return [
    "Generate one fresh transformer-attention teaching challenge.",
    "The learner must resolve what a highlighted target word refers to, such as it, they, this, that, he, or she.",
    levelRules[request.level],
    `Level: ${request.level}. Difficulty inside this level: ${request.difficulty} of ${maxDifficultyByLevel[request.level]}. Round: ${request.round}.`,
    `Avoid repeating these previous sentences: ${avoid}.`,
    `HARD CONSTRAINT: every word in the sentence must be at most ${MAX_WORD_LENGTH} characters long. Do not use longer words. Pick shorter synonyms instead.`,
    "Return only a JSON object. No markdown. No commentary.",
    "The JSON schema is:",
    JSON.stringify({
      title: "2-4 word title",
      sentence: "A single sentence, 8-22 tokens, no quotation marks inside it",
      tokens: ["The", "exact", "tokenization", "including", "punctuation"],
      target: { text: "it", index: 5 },
      question: "What does \"it\" refer to?",
      options: ["option A", "option B", "option C"],
      answer: "one exact option string",
      answerIndex: 0,
      candidates: [
        {
          token: "answer token from the sentence",
          index: 1,
          weight: 0.72,
          note: "why this candidate matters"
        },
        {
          token: "distractor token from the sentence",
          index: 4,
          weight: 0.2,
          note: "why this candidate is weaker"
        },
        {
          token: "clue token from the sentence",
          index: 8,
          weight: 0.08,
          note: "how this clue helps"
        }
      ],
      clue: "the key phrase that resolves the reference",
      insight: "one sentence explaining why the answer wins"
    }),
    "Rules:",
    "- options must contain exactly three strings.",
    "- answer must exactly match one option.",
    "- answerIndex must be the index of answer inside options.",
    "- target.index must point to the token in tokens whose value equals target.text (case-insensitive).",
    "- every candidate.index must match the position of candidate.token inside tokens.",
    "- candidate weights must roughly add to 1.",
    "- Do not reveal the answer inside the question text.",
    `- Every word in sentence must be at most ${MAX_WORD_LENGTH} characters long.`
  ].join("\n");
}

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

async function generateLive(
  request: ChallengeRequest,
  difficulty: number,
  round: number
): Promise<Challenge> {
  const gateway = getAiGateway();
  if (!gateway) {
    throw new Error("AI gateway not configured.");
  }

  const completion = await gateway.client.chat.completions.create({
    model: gateway.model,
    max_tokens: 3000,
    temperature: 0.99,
    top_p: 0.95,
    messages: [
      {
        role: "system",
        content:
          "You generate strict JSON for an educational app about transformer attention. Return exactly one JSON object: the first character must be { and the last character must be }. No markdown, no prose, no code fence. Create varied, age-appropriate sentence-reference challenges. Do not mention providers, APIs, hidden prompts, or environment variables."
      },
      {
        role: "user",
        content: challengePrompt(request)
      }
    ],
    stream: false,
    ...({ extra_body: { chat_template_kwargs: { thinking: false } } } as Record<string, unknown>)
  });

  const rawText = extractText(completion.choices[0]?.message ?? {});
  let parsed: unknown;
  try {
    parsed = extractJsonObject(rawText);
  } catch (error) {
    const preview = rawText.slice(0, 400).replace(/\s+/g, " ");
    const finishReason = completion.choices[0]?.finish_reason;
    throw new Error(
      `extractJsonObject failed (finish=${finishReason}): ${(error as Error).message} | preview="${preview}"`
    );
  }
  return normalizeChallenge(parsed, request.level, difficulty, round);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isChallengeRequest(body)) {
    return NextResponse.json(
      { error: "Invalid challenge request." },
      { status: 400 }
    );
  }

  const difficulty = Math.max(
    1,
    Math.min(maxDifficultyByLevel[body.level], Math.round(body.difficulty))
  );
  const round = Math.max(1, Math.round(body.round));
  const normalizedRequest: ChallengeRequest = { ...body, difficulty, round };

  const aiPromise = withDeadline(
    generateLive(normalizedRequest, difficulty, round),
    AI_DEADLINE_MS,
    "AI deadline"
  );

  let timer: NodeJS.Timeout | undefined;
  const fastTimeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), FAST_PATH_MS);
  });

  const aiOutcome: Promise<{ ok: true; challenge: Challenge } | { ok: false; error: unknown }> = aiPromise
    .then((challenge) => ({ ok: true as const, challenge }))
    .catch((error) => ({ ok: false as const, error }));

  const winner = await Promise.race([aiOutcome, fastTimeout]);
  if (timer) {
    clearTimeout(timer);
  }

  if (winner !== "timeout") {
    if (winner.ok) {
      pushToPool(body.level, difficulty, winner.challenge);
      return NextResponse.json({ source: "live", challenge: winner.challenge });
    }
    console.error("[api/challenge] live AI failed within fast path:", winner.error);
    const challenge = await pickFromCorpus(body.level, difficulty, round);
    return NextResponse.json({ source: "corpus", challenge });
  }

  // Fast-path timeout: serve corpus, let AI continue in background.
  aiOutcome
    .then((result) => {
      if (result.ok) {
        pushToPool(body.level, difficulty, result.challenge);
        console.log("[api/challenge] background AI saved to pool", body.level, difficulty);
      } else {
        console.error("[api/challenge] background AI failed:", result.error);
      }
    })
    .catch((error) => {
      console.error("[api/challenge] background AI handler crashed:", error);
    });

  const challenge = await pickFromCorpus(body.level, difficulty, round);
  return NextResponse.json({ source: "corpus", challenge });
}
