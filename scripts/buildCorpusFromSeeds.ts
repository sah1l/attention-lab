import { promises as fs } from "fs";
import path from "path";
import { normalizeChallenge, MAX_WORD_LENGTH, tokenize } from "../lib/challengeFallback";
import { type Challenge, type Level } from "../lib/attentionData";

type Seed = {
  level: Level;
  difficulty: number;
  title: string;
  sentence: string;
  targetText: string;
  options: [string, string, string];
  answer: string;
  candidates: Array<{ token: string; weight: number; note: string }>;
  clue: string;
  insight: string;
};

function findIndex(tokens: string[], target: string): number {
  const lower = target.toLowerCase();
  return tokens.findIndex((t) => t.toLowerCase() === lower);
}

function findIndexFlexible(tokens: string[], target: string): number {
  const direct = findIndex(tokens, target);
  if (direct !== -1) return direct;
  const cleaned = target.toLowerCase().replace(/[^\w']/g, "");
  return tokens.findIndex((t) => t.toLowerCase().replace(/[^\w']/g, "") === cleaned);
}

function buildEntry(seed: Seed): Omit<Challenge, "id"> & { level: Level; difficulty: number } {
  const rawTokens = tokenize(seed.sentence);
  const tokens = rawTokens.filter((t) => /[\w']/.test(t));

  for (const t of tokens) {
    if (t.length > MAX_WORD_LENGTH) {
      throw new Error(`Word "${t}" > ${MAX_WORD_LENGTH} chars in: ${seed.sentence}`);
    }
  }

  const targetIndex = findIndexFlexible(tokens, seed.targetText);
  if (targetIndex === -1) {
    throw new Error(`Target "${seed.targetText}" not found in tokens: ${tokens.join("|")}`);
  }

  const answerIndex = seed.options.findIndex((o) => o === seed.answer);
  if (answerIndex === -1) {
    throw new Error(`Answer "${seed.answer}" not in options: ${seed.options.join(", ")}`);
  }

  const candidates = seed.candidates.map((c) => {
    const idx = findIndexFlexible(tokens, c.token);
    if (idx === -1) {
      throw new Error(`Candidate token "${c.token}" not found in: ${tokens.join("|")}`);
    }
    return { token: tokens[idx], index: idx, weight: c.weight, note: c.note };
  });

  if (candidates.length < 2) {
    throw new Error("Need at least 2 candidates");
  }

  const challengeShape = {
    title: seed.title,
    sentence: seed.sentence,
    target: { text: seed.targetText, index: targetIndex },
    question: `What does "${seed.targetText}" refer to?`,
    options: seed.options,
    answer: seed.answer,
    answerIndex,
    candidates,
    clue: seed.clue,
    insight: seed.insight,
    tokens
  };

  // Validate via normalizeChallenge (will throw on any malformation)
  const normalized = normalizeChallenge(challengeShape, seed.level, seed.difficulty, 1);
  // Extract just the data fields (no id) — normalizeChallenge already gave clean tokens
  const { id: _id, ...rest } = normalized;
  return { ...rest, level: seed.level, difficulty: seed.difficulty };
}

async function main() {
  const seedsPath = path.join(process.cwd(), "data", "corpusSeeds.json");
  const outPath = path.join(process.cwd(), "data", "challengeCorpus.json");

  const raw = await fs.readFile(seedsPath, "utf-8");
  const seeds = JSON.parse(raw) as Seed[];

  console.log(`Loading ${seeds.length} seeds...`);

  const errors: Array<{ seed: Seed; error: string }> = [];
  const entries: Array<ReturnType<typeof buildEntry>> = [];

  for (const seed of seeds) {
    try {
      entries.push(buildEntry(seed));
    } catch (error) {
      errors.push({ seed, error: (error as Error).message });
    }
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} seed(s) failed validation:`);
    for (const e of errors) {
      console.error(`  [${e.seed.level} d${e.seed.difficulty}] ${e.seed.title}: ${e.error}`);
    }
    process.exit(1);
  }

  const counts: Record<string, number> = {};
  for (const e of entries) {
    const k = `${e.level}:${e.difficulty}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }

  const payload = { generatedAt: new Date().toISOString(), count: entries.length, challenges: entries };
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${entries.length} challenges to ${outPath}`);
  console.log("Per-bucket counts:", counts);
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
