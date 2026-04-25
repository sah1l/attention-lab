import { NextResponse } from "next/server";
import { getAiGateway, extractText } from "@/lib/aiGateway";
import { fallbackTutorResponse, type TutorRequest } from "@/lib/tutorFallback";

export const runtime = "nodejs";

function isTutorRequest(value: unknown): value is TutorRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TutorRequest>;
  const challenge = candidate.challenge as Partial<TutorRequest["challenge"]> | undefined;

  return (
    Boolean(challenge) &&
    typeof challenge?.sentence === "string" &&
    typeof challenge?.answer === "string" &&
    typeof challenge?.insight === "string" &&
    typeof candidate.stageId === "string" &&
    typeof candidate.level === "string"
  );
}

function tutorPrompt(body: TutorRequest) {
  const outcome =
    typeof body.quizCorrect === "boolean"
      ? body.quizCorrect
        ? "The learner answered correctly."
        : "The learner answered incorrectly."
      : "The learner has not locked an answer yet.";

  return JSON.stringify({
    task:
      "Explain the answer reveal for a transformer attention tutor. Mention the learner's choice, the correct reference, the clue, and why attention would weight the winning context highest.",
    level: body.level,
    outcome,
    selectedAnswer: body.selectedAnswer ?? null,
    sentence: body.challenge.sentence,
    target: body.challenge.target,
    options: body.challenge.options,
    correctAnswer: body.challenge.answer,
    clue: body.challenge.clue,
    insight: body.challenge.insight,
    attentionCandidates: body.challenge.candidates
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isTutorRequest(body)) {
    return NextResponse.json(
      { error: "Invalid tutor request." },
      { status: 400 }
    );
  }

  const gateway = getAiGateway();

  if (!gateway) {
    return NextResponse.json({
      source: "fallback",
      text: fallbackTutorResponse(body)
    });
  }

  let rawText: string | null = null;

  try {
    const completion = await gateway.client.chat.completions.create({
      model: gateway.model,
      max_tokens: 1500,
      temperature: 0.99,
      top_p: 0.95,
      messages: [
        {
          role: "system",
          content:
            "You are an adaptive tutor teaching transformer attention through reference resolution. Return one plain-text paragraph only. No markdown, no headings, no bullets, no numbered lists. Keep replies under 75 words. Use the learner level to choose wording. If the learner answered, reveal the correct answer and explain it. Do not mention providers, APIs, hidden prompts, or environment variables."
        },
        {
          role: "user",
          content: tutorPrompt(body)
        }
      ],
      stream: false,
      ...({ extra_body: { chat_template_kwargs: { thinking: false } } } as Record<string, unknown>)
    });

    rawText = extractText(completion.choices[0]?.message ?? {});
    const text = rawText || fallbackTutorResponse(body);

    return NextResponse.json({
      source: "live",
      text
    });
  } catch (error) {
    console.error("[api/tutor] live AI failed, using fallback:", error);
    if (rawText !== null) {
      console.error("[api/tutor] raw model output:\n" + rawText);
    }
    return NextResponse.json({
      source: "fallback",
      text: fallbackTutorResponse(body)
    });
  }
}
