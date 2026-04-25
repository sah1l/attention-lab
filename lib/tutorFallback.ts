import {
  getStage,
  type Challenge,
  type Level,
  type StageId
} from "./attentionData";

export type TutorRequest = {
  challenge: Challenge;
  stageId: StageId;
  level: Level;
  selectedAnswer?: string;
  quizCorrect?: boolean;
};

export function fallbackTutorResponse(request: TutorRequest) {
  const stage = getStage(request.stageId);
  const { challenge } = request;

  if (typeof request.quizCorrect === "boolean") {
    if (request.quizCorrect) {
      return `Correct. "${challenge.target.text}" refers to "${challenge.answer}". ${challenge.insight}`;
    }

    return `Not quite. You chose "${request.selectedAnswer ?? "another option"}", but "${challenge.target.text}" refers to "${challenge.answer}". The clue is "${challenge.clue}": ${challenge.insight}`;
  }

  return stage.coach[request.level];
}
