import { promises as fs } from "fs";
import path from "path";
import { fallbackChallenge, normalizeChallenge } from "./challengeFallback";
import { maxDifficultyByLevel, type Challenge, type Level } from "./attentionData";

type CorpusEntry = Omit<Challenge, "id" | "level" | "difficulty">;
type Bucket = { entries: CorpusEntry[]; cursor: number };
type BucketKey = `${Level}:${number}`;

const CORPUS_PATH = path.join(process.cwd(), "data", "challengeCorpus.json");

const buckets = new Map<BucketKey, Bucket>();
let loaded = false;
let loadPromise: Promise<void> | null = null;

function bucketKey(level: Level, difficulty: number): BucketKey {
  return `${level}:${difficulty}`;
}

function ensureBucket(level: Level, difficulty: number): Bucket {
  const key = bucketKey(level, difficulty);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { entries: [], cursor: 0 };
    buckets.set(key, bucket);
  }
  return bucket;
}

async function loadCorpus(): Promise<void> {
  if (loaded) {
    return;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const raw = await fs.readFile(CORPUS_PATH, "utf-8");
      const parsed = JSON.parse(raw) as { challenges?: Array<CorpusEntry & { level: Level; difficulty: number }> };
      const list = Array.isArray(parsed?.challenges) ? parsed.challenges : [];
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const level = item.level;
        const difficulty = item.difficulty;
        if (level !== "beginner" && level !== "builder" && level !== "advanced") continue;
        if (typeof difficulty !== "number" || !Number.isFinite(difficulty)) continue;
        const bucket = ensureBucket(level, difficulty);
        bucket.entries.push(item);
      }
    } catch (error) {
      console.warn("[challengeCorpus] no corpus file loaded:", (error as Error).message);
    } finally {
      loaded = true;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

function stripCorpusMeta(challenge: Challenge): CorpusEntry {
  const copy = { ...challenge } as Partial<Challenge>;
  delete copy.id;
  delete copy.level;
  delete copy.difficulty;
  return copy as CorpusEntry;
}

function clampDifficulty(level: Level, difficulty: number): number {
  return Math.max(1, Math.min(maxDifficultyByLevel[level], Math.round(difficulty)));
}

export async function pickFromCorpus(level: Level, difficulty: number, round: number): Promise<Challenge> {
  await loadCorpus();
  const safeDifficulty = clampDifficulty(level, difficulty);
  const bucket = buckets.get(bucketKey(level, safeDifficulty));

  if (bucket && bucket.entries.length > 0) {
    const entry = bucket.entries[bucket.cursor % bucket.entries.length];
    bucket.cursor = (bucket.cursor + 1) % bucket.entries.length;
    return normalizeChallenge(
      { ...entry, level, difficulty: safeDifficulty },
      level,
      safeDifficulty,
      round
    );
  }

  return fallbackChallenge(level, safeDifficulty, round);
}

export function pushToPool(level: Level, difficulty: number, challenge: Challenge): void {
  const safeDifficulty = clampDifficulty(level, difficulty);
  const bucket = ensureBucket(level, safeDifficulty);
  const rest = stripCorpusMeta(challenge);
  bucket.entries.push(rest);
}

export function getCorpusStats() {
  const stats: Record<string, number> = {};
  for (const [key, bucket] of buckets.entries()) {
    stats[key] = bucket.entries.length;
  }
  return { loaded, totalBuckets: buckets.size, sizes: stats };
}
