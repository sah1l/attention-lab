export type Level = "beginner" | "builder" | "advanced";
export type StageId = "tokenize" | "inspect" | "lock" | "reveal";

export type AttentionCandidate = {
  token: string;
  index: number;
  weight: number;
  note: string;
};

export type Challenge = {
  id: string;
  title: string;
  level: Level;
  difficulty: number;
  sentence: string;
  tokens: string[];
  target: {
    text: string;
    index: number;
  };
  question: string;
  options: string[];
  answer: string;
  answerIndex: number;
  candidates: AttentionCandidate[];
  clue: string;
  insight: string;
};

export type Stage = {
  id: StageId;
  label: string;
  title: string;
  coach: Record<Level, string>;
};

export const levels: Array<{ id: Level; label: string; hint: string }> = [
  { id: "beginner", label: "Beginner", hint: "clear clues" },
  { id: "builder", label: "Builder", hint: "subtle context" },
  { id: "advanced", label: "Advanced", hint: "competing clues" }
];

export const maxDifficultyByLevel: Record<Level, number> = {
  beginner: 3,
  builder: 4,
  advanced: 5
};

export const stages: Stage[] = [
  {
    id: "tokenize",
    label: "Read",
    title: "Read the sentence as tokens",
    coach: {
      beginner:
        "First, find the highlighted word. The model treats each word as a token that can look around for helpful context.",
      builder:
        "Start by isolating the target token. Its meaning is incomplete until attention pulls in supporting context.",
      advanced:
        "Identify the target representation before attention updates it. The target will query nearby candidate tokens for relevance."
    }
  },
  {
    id: "inspect",
    label: "Inspect",
    title: "Inspect possible references",
    coach: {
      beginner:
        "Look for nouns or ideas that the highlighted word could point to. Do not reveal the answer yet; compare the options against the sentence clue.",
      builder:
        "List the plausible referents and test each against the clue. This is the human version of scoring context tokens.",
      advanced:
        "Treat each option as a candidate antecedent. The right answer should make the whole sentence causally consistent."
    }
  },
  {
    id: "lock",
    label: "Lock",
    title: "Lock your answer",
    coach: {
      beginner:
        "Choose the option that best matches the clue. The attention weights stay hidden until you commit.",
      builder:
        "Commit to the option whose context explains the sentence with the fewest contradictions.",
      advanced:
        "Lock the antecedent that wins after resolving syntax, semantics, and causal fit."
    }
  },
  {
    id: "reveal",
    label: "Reveal",
    title: "Reveal attention and explanation",
    coach: {
      beginner:
        "Now the tutor reveals which context token received the strongest attention and explains why.",
      builder:
        "The reveal shows a weighted context blend: the target token borrows meaning from the strongest candidate.",
      advanced:
        "The answer is revealed with attention-like weights that approximate how candidate values update the target representation."
    }
  }
];

export function getStage(stageId: StageId) {
  return stages.find((stage) => stage.id === stageId) ?? stages[0];
}

export function getStageIndex(stageId: StageId) {
  return stages.findIndex((stage) => stage.id === stageId);
}
