import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";
import { normalizeChallenge, MAX_WORD_LENGTH } from "../lib/challengeFallback";
import { maxDifficultyByLevel, type Challenge, type Level } from "../lib/attentionData";
import { extractJsonObject as sharedExtractJsonObject } from "../lib/aiGateway";

const OUT_PATH = path.join(process.cwd(), "data", "challengeCorpus.json");

const PER_BUCKET = parseInt(process.env.CORPUS_PER_BUCKET ?? "10", 10);
const CONCURRENCY = parseInt(process.env.CORPUS_CONCURRENCY ?? "4", 10);
const MAX_ATTEMPTS = 3;

type CorpusEntry = Omit<Challenge, "id"> & { level: Level; difficulty: number };

function buildPrompt(level: Level, difficulty: number, round: number, avoid: string[]): string {
  const levelRules: Record<Level, string> = {
    beginner:
      "Use a concrete everyday sentence with one obvious clue. Keep the sentence short and the correct answer easy to justify.",
    builder:
      "Use a moderately subtle sentence with two plausible nouns and one clue that resolves the target.",
    advanced:
      "Use a multi-clause sentence with abstract or technical nouns, realistic distractors, and a clue that requires careful reasoning."
  };

  const avoidLine = avoid.slice(-12).join(" | ") || "none";

  return [
    "Generate one fresh transformer-attention teaching challenge.",
    "The learner must resolve what a highlighted target word refers to, such as it, they, this, that, he, or she.",
    levelRules[level],
    `Level: ${level}. Difficulty inside this level: ${difficulty} of ${maxDifficultyByLevel[level]}. Round: ${round}.`,
    `Avoid repeating these previous sentences: ${avoidLine}.`,
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
        { token: "answer token", index: 1, weight: 0.72, note: "why this candidate matters" },
        { token: "distractor token", index: 4, weight: 0.2, note: "why this candidate is weaker" },
        { token: "clue token", index: 8, weight: 0.08, note: "how this clue helps" }
      ],
      clue: "the key phrase that resolves the reference",
      insight: "one sentence explaining why the answer wins"
    }),
    "Rules:",
    "- options must contain exactly three strings.",
    "- answer must exactly match one option.",
    "- answerIndex must be the index of answer inside options.",
    "- target.index must point to the token whose value equals target.text (case-insensitive).",
    "- every candidate.index must match the position of candidate.token inside tokens.",
    "- candidate weights must roughly add to 1.",
    "- Do not reveal the answer inside the question text.",
    `- Every word in sentence must be at most ${MAX_WORD_LENGTH} characters long.`
  ].join("\n");
}

function extractText(message: { content?: string | null }): string {
  return (message.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractJsonObject(text: string): unknown {
  return sharedExtractJsonObject(text);
}

async function generateOne(
  client: OpenAI,
  model: string,
  level: Level,
  difficulty: number,
  round: number,
  avoid: string[]
): Promise<Challenge> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model,
        max_tokens: 3000,
        temperature: 0.99,
        top_p: 0.95,
        messages: [
          {
            role: "system",
            content:
              "You generate strict JSON for an educational app about transformer attention. Return exactly one JSON object: the first character must be { and the last character must be }. No markdown, no prose, no code fence. Create varied, age-appropriate sentence-reference challenges."
          },
          { role: "user", content: buildPrompt(level, difficulty, round, avoid) }
        ],
        stream: false,
        ...({ extra_body: { chat_template_kwargs: { thinking: false } } } as Record<string, unknown>)
      });

      const rawText = extractText(completion.choices[0]?.message ?? {});
      const parsed = extractJsonObject(rawText);
      return normalizeChallenge(parsed, level, difficulty, round);
    } catch (error) {
      lastError = error;
      console.warn(`  [retry ${attempt}] ${level} d${difficulty} r${round}: ${(error as Error).message}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

type Job = { level: Level; difficulty: number; round: number };

async function runWithConcurrency<T>(
  jobs: Job[],
  worker: (job: Job, index: number) => Promise<T | null>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let cursor = 0;
  let completed = 0;

  async function next(): Promise<void> {
    while (cursor < jobs.length) {
      const i = cursor++;
      const job = jobs[i];
      try {
        const result = await worker(job, i);
        if (result !== null) {
          results.push(result);
        }
      } catch (error) {
        console.error(`  failed: ${job.level} d${job.difficulty} r${job.round}:`, (error as Error).message);
      }
      completed++;
      if (completed % 5 === 0 || completed === jobs.length) {
        console.log(`  progress: ${completed}/${jobs.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => next()));
  return results;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;
  const model = process.env.AI_MODEL;

  if (!apiKey || !model) {
    console.error("OPENAI_API_KEY and AI_MODEL must be set in the environment.");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey, baseURL });

  const jobs: Job[] = [];
  for (const level of ["beginner", "builder", "advanced"] as Level[]) {
    for (let difficulty = 1; difficulty <= maxDifficultyByLevel[level]; difficulty++) {
      for (let round = 1; round <= PER_BUCKET; round++) {
        jobs.push({ level, difficulty, round });
      }
    }
  }

  console.log(`Generating ${jobs.length} challenges (concurrency=${CONCURRENCY}, per-bucket=${PER_BUCKET})...`);

  const seenSentences = new Map<string, string[]>();

  const entries = await runWithConcurrency<CorpusEntry>(
    jobs,
    async (job) => {
      const key = `${job.level}:${job.difficulty}`;
      const avoid = seenSentences.get(key) ?? [];
      const challenge = await generateOne(client, model, job.level, job.difficulty, job.round, avoid);
      avoid.push(challenge.sentence);
      seenSentences.set(key, avoid);
      const copy = { ...challenge } as Partial<Challenge>;
      delete copy.id;
      return { ...(copy as Omit<Challenge, "id">), level: job.level, difficulty: job.difficulty };
    },
    CONCURRENCY
  );

  console.log(`Generated ${entries.length}/${jobs.length} valid challenges.`);

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  const payload = { generatedAt: new Date().toISOString(), count: entries.length, challenges: entries };
  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT_PATH}`);

  const counts: Record<string, number> = {};
  for (const e of entries) {
    const k = `${e.level}:${e.difficulty}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  console.log("Per-bucket counts:", counts);
}

main().catch((error) => {
  console.error("Generation failed:", error);
  process.exit(1);
});
