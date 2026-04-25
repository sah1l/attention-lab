import {
  maxDifficultyByLevel,
  type AttentionCandidate,
  type Challenge,
  type Level
} from "./attentionData";

type ChallengeSeed = Omit<Challenge, "id" | "level" | "difficulty" | "tokens">;

export const MAX_WORD_LENGTH = 11;

const fallbackBank: Record<Level, ChallengeSeed[]> = {
  beginner: [
    {
      title: "Too Heavy",
      sentence: "The robot could not lift the crate because it was too heavy.",
      target: { text: "it", index: 8 },
      question: "What does \"it\" refer to?",
      options: ["the robot", "the crate", "the lift"],
      answer: "the crate",
      answerIndex: 1,
      candidates: [
        { token: "crate", index: 6, weight: 0.76, note: "The heavy thing is what could not be lifted." },
        { token: "robot", index: 1, weight: 0.17, note: "The robot is doing the lifting, not being lifted." },
        { token: "lift", index: 4, weight: 0.07, note: "The action helps frame the clue." }
      ],
      clue: "too heavy",
      insight: "The clue says the object being lifted was too heavy, so the target points to the crate."
    },
    {
      title: "Too Hot",
      sentence: "Maya dropped the mug after it became too hot.",
      target: { text: "it", index: 5 },
      question: "What does \"it\" refer to?",
      options: ["Maya", "the mug", "the table"],
      answer: "the mug",
      answerIndex: 1,
      candidates: [
        { token: "mug", index: 3, weight: 0.82, note: "The mug became hot, which explains why Maya dropped it." },
        { token: "Maya", index: 0, weight: 0.1, note: "Maya is the person reacting to the heat." },
        { token: "dropped", index: 1, weight: 0.08, note: "The action is useful context, not the referent." }
      ],
      clue: "became too hot",
      insight: "The heat caused the action, so the highlighted word points to the mug."
    },
    {
      title: "Battery Drain",
      sentence: "The tablet stopped working because it ran out of battery.",
      target: { text: "it", index: 5 },
      question: "What does \"it\" refer to?",
      options: ["the tablet", "the charger", "the battery"],
      answer: "the tablet",
      answerIndex: 0,
      candidates: [
        { token: "tablet", index: 1, weight: 0.79, note: "The tablet is what stopped working and ran out of battery." },
        { token: "battery", index: 9, weight: 0.13, note: "Battery is the resource that was depleted." },
        { token: "working", index: 3, weight: 0.08, note: "The state gives supporting context." }
      ],
      clue: "ran out of battery",
      insight: "The device stopped working because the device ran out of battery."
    },
    {
      title: "Burst Balloon",
      sentence: "The kid let go of the balloon and it floated into the sky.",
      target: { text: "it", index: 8 },
      question: "What does \"it\" refer to?",
      options: ["the kid", "the balloon", "the sky"],
      answer: "the balloon",
      answerIndex: 1,
      candidates: [
        { token: "balloon", index: 6, weight: 0.78, note: "Balloons float, so the floating thing is the balloon." },
        { token: "kid", index: 1, weight: 0.14, note: "The kid is the actor letting go, not the floater." },
        { token: "sky", index: 11, weight: 0.08, note: "The sky is the destination, not the referent." }
      ],
      clue: "floated into the sky",
      insight: "Balloons float once released, so the highlighted word points to the balloon."
    },
    {
      title: "Spilled Drink",
      sentence: "The cat knocked over the glass because it was sitting too close.",
      target: { text: "it", index: 7 },
      question: "What does \"it\" refer to?",
      options: ["the cat", "the glass", "the table"],
      answer: "the cat",
      answerIndex: 0,
      candidates: [
        { token: "cat", index: 1, weight: 0.74, note: "The cat is the one sitting and knocking things over." },
        { token: "glass", index: 4, weight: 0.18, note: "The glass is what got knocked over, not the sitter." },
        { token: "knocked", index: 2, weight: 0.08, note: "The action sets up the clue." }
      ],
      clue: "sitting too close",
      insight: "Sitting describes the cat, so the highlighted word points to the cat."
    },
    {
      title: "Frozen Lake",
      sentence: "The pond froze last night because it dropped below zero.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the pond", "the temperature", "last night"],
      answer: "the temperature",
      answerIndex: 1,
      candidates: [
        { token: "dropped", index: 7, weight: 0.66, note: "Temperature is what drops below zero." },
        { token: "pond", index: 1, weight: 0.22, note: "The pond is what froze, not what dropped." },
        { token: "night", index: 4, weight: 0.12, note: "Night is when, not what dropped." }
      ],
      clue: "dropped below zero",
      insight: "Only temperature drops below zero, so the highlighted word points to temperature."
    },
    {
      title: "Stuck Door",
      sentence: "Sara pushed the door but it would not open.",
      target: { text: "it", index: 5 },
      question: "What does \"it\" refer to?",
      options: ["Sara", "the door", "the handle"],
      answer: "the door",
      answerIndex: 1,
      candidates: [
        { token: "door", index: 3, weight: 0.8, note: "Doors are what open or fail to open." },
        { token: "Sara", index: 0, weight: 0.12, note: "Sara is the one pushing, not the thing opening." },
        { token: "pushed", index: 1, weight: 0.08, note: "Pushing frames the action." }
      ],
      clue: "would not open",
      insight: "Opening is something a door does, so the highlighted word points to the door."
    }
  ],
  builder: [
    {
      title: "Cracked Screen",
      sentence: "Arun replaced the phone case after it cracked during the fall.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["Arun", "the phone case", "the fall"],
      answer: "the phone case",
      answerIndex: 1,
      candidates: [
        { token: "case", index: 4, weight: 0.68, note: "The replaced object is the thing that cracked." },
        { token: "phone", index: 3, weight: 0.22, note: "Phone is close, but the sentence says the case was replaced." },
        { token: "fall", index: 10, weight: 0.1, note: "The fall caused the crack." }
      ],
      clue: "replaced the phone case",
      insight: "The repair action points to the case as the cracked object."
    },
    {
      title: "Blocked View",
      sentence: "The banner covered the scoreboard because it was hanging too low.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the banner", "the scoreboard", "the crowd"],
      answer: "the banner",
      answerIndex: 0,
      candidates: [
        { token: "banner", index: 1, weight: 0.71, note: "A low banner would cover the scoreboard." },
        { token: "scoreboard", index: 4, weight: 0.2, note: "The scoreboard is being covered, not hanging." },
        { token: "covered", index: 2, weight: 0.09, note: "The action frames the spatial clue." }
      ],
      clue: "hanging too low",
      insight: "The thing doing the covering is the one hanging too low."
    },
    {
      title: "Delayed Train",
      sentence: "The train missed the signal because it arrived late at the junction.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the train", "the signal", "the junction"],
      answer: "the train",
      answerIndex: 0,
      candidates: [
        { token: "train", index: 1, weight: 0.72, note: "The train is the thing that arrived late." },
        { token: "signal", index: 4, weight: 0.18, note: "The signal was missed, not late." },
        { token: "junction", index: 11, weight: 0.1, note: "The junction is the place." }
      ],
      clue: "arrived late",
      insight: "The arrival clue belongs to the train, not the signal."
    },
    {
      title: "Wet Notebook",
      sentence: "Priya rewrote the notes after the bottle leaked onto them in her bag.",
      target: { text: "them", index: 9 },
      question: "What does \"them\" refer to?",
      options: ["the notes", "the bottle", "the bag"],
      answer: "the notes",
      answerIndex: 0,
      candidates: [
        { token: "notes", index: 3, weight: 0.7, note: "Notes were rewritten because they got wet." },
        { token: "bottle", index: 6, weight: 0.2, note: "The bottle is what leaked, not the wet thing." },
        { token: "bag", index: 12, weight: 0.1, note: "The bag is the location, not the referent." }
      ],
      clue: "rewrote the notes",
      insight: "The rewrite clue points the highlighted word back to the notes."
    },
    {
      title: "Closed Stall",
      sentence: "The vendor shut the kiosk because it had run out of stock.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the vendor", "the kiosk", "the stock"],
      answer: "the kiosk",
      answerIndex: 1,
      candidates: [
        { token: "kiosk", index: 4, weight: 0.65, note: "The kiosk is the place that ran out of stock." },
        { token: "vendor", index: 1, weight: 0.22, note: "The vendor performs the action of shutting." },
        { token: "stock", index: 11, weight: 0.13, note: "Stock is what was depleted, not the holder." }
      ],
      clue: "run out of stock",
      insight: "A kiosk runs out of stock; that points the highlighted word to the kiosk."
    },
    {
      title: "Late Reply",
      sentence: "The director reread the email because it had arrived during a noisy meeting.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the director", "the email", "the meeting"],
      answer: "the email",
      answerIndex: 1,
      candidates: [
        { token: "email", index: 4, weight: 0.71, note: "Emails arrive; the email is the thing that came in." },
        { token: "director", index: 1, weight: 0.16, note: "The director is the reader, not what arrived." },
        { token: "meeting", index: 12, weight: 0.13, note: "The meeting is the timing context." }
      ],
      clue: "had arrived",
      insight: "Arriving describes the email, so the highlighted word points to the email."
    },
    {
      title: "Skipped Beat",
      sentence: "The conductor stopped the orchestra because it had drifted off tempo.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the conductor", "the orchestra", "the tempo"],
      answer: "the orchestra",
      answerIndex: 1,
      candidates: [
        { token: "orchestra", index: 4, weight: 0.69, note: "The orchestra is the group that can drift off tempo." },
        { token: "conductor", index: 1, weight: 0.18, note: "The conductor stops things; they do not drift." },
        { token: "tempo", index: 10, weight: 0.13, note: "Tempo is the reference, not the drifter." }
      ],
      clue: "drifted off tempo",
      insight: "Drifting off tempo describes the orchestra, not the conductor."
    }
  ],
  advanced: [
    {
      title: "Subtle Approval",
      sentence: "The committee rejected the proposal after it failed to address the safety audit.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the committee", "the proposal", "the safety audit"],
      answer: "the proposal",
      answerIndex: 1,
      candidates: [
        { token: "proposal", index: 4, weight: 0.74, note: "The proposal failed to address the audit, so it was rejected." },
        { token: "committee", index: 1, weight: 0.14, note: "The committee performs the rejection." },
        { token: "audit", index: 12, weight: 0.12, note: "The audit is the missing requirement." }
      ],
      clue: "failed to address",
      insight: "The clause explains why the proposal was rejected, so the target refers to the proposal."
    },
    {
      title: "Conflicting Evidence",
      sentence: "The analyst revised the forecast when it clashed with the newest sales report.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the analyst", "the forecast", "the sales report"],
      answer: "the forecast",
      answerIndex: 1,
      candidates: [
        { token: "forecast", index: 4, weight: 0.7, note: "A forecast can clash with a report and then be revised." },
        { token: "report", index: 12, weight: 0.19, note: "The report is the evidence being compared against." },
        { token: "analyst", index: 1, weight: 0.11, note: "The analyst performs the revision." }
      ],
      clue: "clashed with the newest sales report",
      insight: "The item being revised is the one that clashed with the newer evidence."
    },
    {
      title: "Ambiguous Attachment",
      sentence: "The scholar corrected the summary after it misread the trial's control group.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the scholar", "the summary", "the trial"],
      answer: "the summary",
      answerIndex: 1,
      candidates: [
        { token: "summary", index: 4, weight: 0.73, note: "A summary can misread details and need correction." },
        { token: "trial's", index: 9, weight: 0.17, note: "The trial owns the control group detail." },
        { token: "scholar", index: 1, weight: 0.1, note: "The scholar performs the correction." }
      ],
      clue: "misread the trial's control group",
      insight: "The misread belongs to the summary, which explains why it was corrected."
    },
    {
      title: "Code Conflict",
      sentence: "The architect revised the blueprint after it failed to satisfy the new fire-safety code.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the architect", "the blueprint", "the fire-safety code"],
      answer: "the blueprint",
      answerIndex: 1,
      candidates: [
        { token: "blueprint", index: 4, weight: 0.7, note: "The blueprint is the artifact being revised because it failed compliance." },
        { token: "code", index: 14, weight: 0.18, note: "The code is the standard the blueprint failed to meet, not the failer." },
        { token: "architect", index: 1, weight: 0.12, note: "The architect performs the revision, not the failing." }
      ],
      clue: "failed to satisfy",
      insight: "The blueprint failed compliance, so the highlighted word points to the blueprint."
    },
    {
      title: "Pivoted Strategy",
      sentence: "The startup pivoted the strategy when backers saw that it inflated the target market.",
      target: { text: "it", index: 9 },
      question: "What does \"it\" refer to?",
      options: ["the startup", "the strategy", "the target market"],
      answer: "the strategy",
      answerIndex: 1,
      candidates: [
        { token: "strategy", index: 4, weight: 0.69, note: "The strategy is the thing that inflated the market." },
        { token: "startup", index: 1, weight: 0.16, note: "The startup pivots in response, but the strategy is the flawed item." },
        { token: "backers", index: 6, weight: 0.15, note: "Backers are the observers, not the referent." }
      ],
      clue: "inflated the target market",
      insight: "Strategies, not companies, can inflate a market — that points the highlighted word to the strategy."
    },
    {
      title: "Retracted Story",
      sentence: "The journalist withdrew the article after editors discovered that it cited a fabricated quote.",
      target: { text: "it", index: 9 },
      question: "What does \"it\" refer to?",
      options: ["the journalist", "the article", "the editors"],
      answer: "the article",
      answerIndex: 1,
      candidates: [
        { token: "article", index: 4, weight: 0.72, note: "Articles cite quotes; the article is the thing that did the citing." },
        { token: "journalist", index: 1, weight: 0.15, note: "The journalist withdrew it, but does not do the citing in this clause." },
        { token: "editors", index: 6, weight: 0.13, note: "Editors discovered the issue; they are not what cited the quote." }
      ],
      clue: "cited a fabricated quote",
      insight: "Citation belongs to the article itself, so the highlighted word points to the article."
    },
    {
      title: "Reissued Label",
      sentence: "The pharmacist replaced the label because it omitted the dosage warning required by regulators.",
      target: { text: "it", index: 6 },
      question: "What does \"it\" refer to?",
      options: ["the pharmacist", "the label", "the dosage warning"],
      answer: "the label",
      answerIndex: 1,
      candidates: [
        { token: "label", index: 4, weight: 0.71, note: "The label is the printed surface that omitted required text." },
        { token: "warning", index: 10, weight: 0.18, note: "The warning is what was missing, not the omitter." },
        { token: "pharmacist", index: 1, weight: 0.11, note: "The pharmacist performs the replacement, not the omission." }
      ],
      clue: "omitted the dosage warning",
      insight: "Omission belongs to the label, so the highlighted word points to the label."
    }
  ]
};

export function tokenize(sentence: string) {
  const matches = sentence.match(/[\w']+|[^\s\w]/g);
  return matches ?? sentence.split(/\s+/).filter(Boolean);
}

export function fallbackChallenge(level: Level, difficulty: number, round: number) {
  const bank = fallbackBank[level];
  const index = Math.abs(round + difficulty - 1) % bank.length;
  const seed = bank[index];
  const tokens = tokenize(seed.sentence);

  return normalizeChallenge(
    {
      ...seed,
      id: `${level}-${difficulty}-${round}-${index}`,
      level,
      difficulty,
      tokens
    },
    level,
    difficulty,
    round
  );
}

export function normalizeChallenge(
  value: unknown,
  level: Level,
  difficulty: number,
  round: number
): Challenge {
  if (!value || typeof value !== "object") {
    throw new Error("Challenge is not an object.");
  }

  const candidate = value as Partial<Challenge>;
  const sentence = typeof candidate.sentence === "string" ? candidate.sentence.trim() : "";
  const rawTokens = Array.isArray(candidate.tokens) && candidate.tokens.every((item) => typeof item === "string")
    ? candidate.tokens.map((item) => item.trim()).filter(Boolean)
    : tokenize(sentence);

  const { tokens, indexMap } = stripPunctuationTokens(rawTokens);

  if (!sentence || tokens.length < 6 || tokens.length > 28) {
    throw new Error("Challenge sentence must contain 6 to 28 tokens.");
  }

  if (tokens.some((token) => token.length > MAX_WORD_LENGTH)) {
    throw new Error(`Challenge tokens must each be at most ${MAX_WORD_LENGTH} characters.`);
  }

  remapTargetIndex(candidate.target, indexMap);
  remapCandidateIndices(candidate.candidates, indexMap);

  const target = normalizeTarget(candidate.target, tokens);
  const options = normalizeOptions(candidate.options);
  const answerIndex = normalizeAnswerIndex(candidate.answer, candidate.answerIndex, options);

  if (answerIndex === -1) {
    throw new Error("Challenge answer must match an option.");
  }

  const candidates = normalizeCandidates(candidate.candidates, tokens, options, options[answerIndex]);

  return {
    id:
      typeof candidate.id === "string" && candidate.id
        ? candidate.id
        : `${level}-${difficulty}-${round}-${Date.now()}`,
    title:
      typeof candidate.title === "string" && candidate.title.trim()
        ? candidate.title.trim()
        : `Round ${round}`,
    level,
    difficulty: clampDifficulty(level, difficulty),
    sentence,
    tokens,
    target,
    question:
      typeof candidate.question === "string" && candidate.question.trim()
        ? candidate.question.trim()
        : `What does "${target.text}" refer to?`,
    options,
    answer: options[answerIndex],
    answerIndex,
    candidates,
    clue:
      typeof candidate.clue === "string" && candidate.clue.trim()
        ? candidate.clue.trim()
        : "the sentence clue",
    insight:
      typeof candidate.insight === "string" && candidate.insight.trim()
        ? candidate.insight.trim()
        : `The strongest clue points "${target.text}" to "${options[answerIndex]}".`
  };
}

function stripPunctuationTokens(rawTokens: string[]) {
  const tokens: string[] = [];
  const indexMap = new Map<number, number>();

  rawTokens.forEach((token, originalIndex) => {
    if (/[\w']/.test(token)) {
      indexMap.set(originalIndex, tokens.length);
      tokens.push(token);
    }
  });

  return { tokens, indexMap };
}

function remapTargetIndex(
  target: Partial<Challenge>["target"] | undefined,
  indexMap: Map<number, number>
) {
  if (target && typeof target.index === "number" && indexMap.has(target.index)) {
    target.index = indexMap.get(target.index)!;
  }
}

function remapCandidateIndices(candidates: unknown, indexMap: Map<number, number>) {
  if (!Array.isArray(candidates)) {
    return;
  }

  candidates.forEach((item) => {
    if (item && typeof item === "object" && typeof item.index === "number" && indexMap.has(item.index)) {
      item.index = indexMap.get(item.index)!;
    }
  });
}

function normalizeTarget(target: Partial<Challenge>["target"], tokens: string[]) {
  const text =
    target && typeof target.text === "string" && target.text.trim()
      ? target.text.trim()
      : "";

  const claimedIndex =
    target &&
    typeof target.index === "number" &&
    Number.isInteger(target.index) &&
    target.index >= 0 &&
    target.index < tokens.length
      ? target.index
      : -1;

  const matchesText = (token: string) =>
    text ? token.toLowerCase() === text.toLowerCase() : /^it$/i.test(token);

  if (claimedIndex !== -1 && matchesText(tokens[claimedIndex])) {
    return { text: text || tokens[claimedIndex], index: claimedIndex };
  }

  const foundIndex = tokens.findIndex(matchesText);

  if (foundIndex !== -1) {
    return { text: text || tokens[foundIndex], index: foundIndex };
  }

  const fallbackIndex = claimedIndex !== -1 ? claimedIndex : 0;
  return { text: text || tokens[fallbackIndex], index: fallbackIndex };
}

function normalizeOptions(options: unknown) {
  if (!Array.isArray(options)) {
    throw new Error("Challenge options must be an array.");
  }

  const normalized = Array.from(
    new Set(options.filter((item): item is string => typeof item === "string").map((item) => item.trim()))
  ).filter(Boolean);

  if (normalized.length !== 3) {
    throw new Error("Challenge needs exactly three options.");
  }

  return normalized;
}

function normalizeAnswerIndex(answer: unknown, answerIndex: unknown, options: string[]) {
  if (
    typeof answerIndex === "number" &&
    Number.isInteger(answerIndex) &&
    answerIndex >= 0 &&
    answerIndex < options.length
  ) {
    return answerIndex;
  }

  if (typeof answer === "string") {
    const exact = options.findIndex((option) => option === answer.trim());

    if (exact !== -1) {
      return exact;
    }

    const fuzzy = options.findIndex((option) => sameOption(option, answer));

    if (fuzzy !== -1) {
      return fuzzy;
    }
  }

  throw new Error("Challenge answer must match an option.");
}

function normalizeCandidates(
  candidates: unknown,
  tokens: string[],
  options: string[],
  answer: unknown
): AttentionCandidate[] {
  if (!Array.isArray(candidates)) {
    throw new Error("Challenge candidates must be an array.");
  }

  const normalized = candidates
    .filter((item): item is Partial<AttentionCandidate> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const index =
        typeof item.index === "number" && Number.isInteger(item.index) && item.index >= 0 && item.index < tokens.length
          ? item.index
          : findTokenIndex(tokens, item.token);

      return {
        token: typeof item.token === "string" && item.token.trim() ? item.token.trim() : tokens[index],
        index,
        weight: typeof item.weight === "number" ? item.weight : 0.2,
        note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : "Relevant context token."
      };
    })
    .filter((item) => item.index >= 0);

  const answerText = typeof answer === "string" ? answer : options[0];
  const hasAnswer = normalized.some((item) => sameOption(item.token, answerText));

  if (!hasAnswer) {
    const answerIndex = findTokenIndex(tokens, answerText);
    normalized.unshift({
      token: answerText,
      index: Math.max(0, answerIndex),
      weight: 0.68,
      note: "The strongest matching context."
    });
  }

  if (normalized.length < 2) {
    throw new Error("Challenge needs at least two attention candidates.");
  }

  const top = normalized.slice(0, 3);
  const total = top.reduce((sum, item) => sum + Math.max(0.05, item.weight), 0);

  return top.map((item) => ({
    ...item,
    weight: Math.max(0.06, Math.min(0.86, Math.max(0.05, item.weight) / total))
  }));
}

function findTokenIndex(tokens: string[], token: unknown) {
  if (typeof token !== "string") {
    return -1;
  }

  const simpleToken = simplify(token);
  return tokens.findIndex((item) => {
    const simplified = simplify(item);
    return simplified === simpleToken || simpleToken.includes(simplified) || simplified.includes(simpleToken);
  });
}

function sameOption(left: string, right: string) {
  const simpleLeft = simplify(left);
  const simpleRight = simplify(right);
  return simpleLeft === simpleRight || simpleLeft.includes(simpleRight) || simpleRight.includes(simpleLeft);
}

function simplify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function clampDifficulty(level: Level, difficulty: number) {
  return Math.max(1, Math.min(maxDifficultyByLevel[level], difficulty));
}
