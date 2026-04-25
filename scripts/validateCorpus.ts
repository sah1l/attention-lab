import { promises as fs } from "fs";
import path from "path";
import { normalizeChallenge, MAX_WORD_LENGTH } from "../lib/challengeFallback";
import { type Level } from "../lib/attentionData";

type CorpusFile = {
  generatedAt?: string;
  count?: number;
  challenges: Array<Record<string, unknown> & { level: Level; difficulty: number }>;
};

async function main() {
  const corpusPath = path.join(process.cwd(), "data", "challengeCorpus.json");
  const raw = await fs.readFile(corpusPath, "utf-8");
  const data = JSON.parse(raw) as CorpusFile;

  let ok = 0;
  const failures: Array<{ index: number; title: unknown; error: string }> = [];
  const wordLengthIssues: Array<{ index: number; word: string }> = [];

  data.challenges.forEach((entry, idx) => {
    try {
      const normalized = normalizeChallenge(entry, entry.level, entry.difficulty, 1);
      for (const t of normalized.tokens) {
        if (t.length > MAX_WORD_LENGTH) {
          wordLengthIssues.push({ index: idx, word: t });
        }
      }
      ok++;
    } catch (e) {
      failures.push({ index: idx, title: entry.title, error: (e as Error).message });
    }
  });

  console.log(`Validated: ${ok}/${data.challenges.length}`);
  if (failures.length) {
    console.error("Normalization failures:");
    for (const f of failures) {
      console.error(`  [#${f.index}] ${f.title}: ${f.error}`);
    }
  }
  if (wordLengthIssues.length) {
    console.error("Word-length violations:");
    for (const w of wordLengthIssues) {
      console.error(`  [#${w.index}] "${w.word}" (${w.word.length} chars)`);
    }
  }
  if (failures.length || wordLengthIssues.length) {
    process.exit(1);
  }

  const counts: Record<string, number> = {};
  for (const e of data.challenges) {
    const k = `${e.level}:${e.difficulty}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  console.log("Bucket distribution:", counts);
  console.log("All entries pass: word length ok, indices valid, options consistent.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
