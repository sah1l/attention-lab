"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getStageIndex,
  levels,
  maxDifficultyByLevel,
  stages,
  type Challenge,
  type Level,
  type Stage
} from "@/lib/attentionData";
import { fallbackChallenge } from "@/lib/challengeFallback";
import { triviaTips } from "@/lib/attentionTrivia";

type Source = "loading" | "live" | "fallback";
type QuizState = "idle" | "correct" | "wrong";

export default function Home() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeSource, setChallengeSource] = useState<Source>("loading");
  const [triviaIndex, setTriviaIndex] = useState(0);
  useEffect(() => {
    setTriviaIndex(Math.floor(Math.random() * triviaTips.length));
  }, []);
  const [tutorSource, setTutorSource] = useState<Source>("fallback");
  const [stageIndex, setStageIndex] = useState(0);
  const [level, setLevel] = useState<Level>("builder");
  const [difficulty, setDifficulty] = useState(1);
  const [round, setRound] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [tutorText, setTutorText] = useState("");
  const [quizState, setQuizState] = useState<QuizState>("idle");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const previousSentencesRef = useRef<string[]>([]);

  const stage = stages[stageIndex];
  const STAGE_MS = 1500;
  const locked = quizState !== "idle";
  const availableStageCount = locked ? stages.length : getStageIndex("reveal");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        difficulty,
        round,
        previousSentences: previousSentencesRef.current
      }),
      signal: controller.signal
    })
      .then((response) => response.json())
      .then((data: { source?: Source; challenge?: Challenge }) => {
        if (!data.challenge) {
          throw new Error("No challenge returned.");
        }

        setChallenge(data.challenge);
        setChallengeSource(data.source === "live" ? "live" : "fallback");
        setTutorSource("fallback");
        setTutorText("");
        previousSentencesRef.current = [
          ...previousSentencesRef.current.slice(-7),
          data.challenge.sentence
        ];
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") {
          setChallenge(fallbackChallenge(level, difficulty, round));
          setChallengeSource("fallback");
        }
      });

    return () => controller.abort();
  }, [difficulty, level, round]);

  useEffect(() => {
    if (challengeSource !== "loading") {
      return;
    }

    const timer = window.setInterval(() => {
      setTriviaIndex((current) => (current + 1) % triviaTips.length);
    }, 9000);

    return () => window.clearInterval(timer);
  }, [challengeSource]);

  useEffect(() => {
    if (!isPlaying || challengeSource === "loading") {
      return;
    }

    const timer = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % availableStageCount);
    }, STAGE_MS);

    return () => window.clearInterval(timer);
  }, [availableStageCount, challengeSource, isPlaying]);

  const mastery = useMemo(() => {
    const maxDifficulty = maxDifficultyByLevel[level];
    const stageProgress = (stageIndex + 1) / stages.length;
    const difficultyProgress = difficulty / maxDifficulty;
    const accuracy = attempts === 0 ? 0.35 : correctCount / attempts;

    return Math.max(
      0.12,
      Math.min(1, difficultyProgress * 0.48 + stageProgress * 0.22 + accuracy * 0.3)
    );
  }, [attempts, correctCount, difficulty, level, stageIndex]);

  function resetRound(nextLevel = level, nextDifficulty = difficulty, nextRound = round + 1) {
    setChallenge(null);
    setLevel(nextLevel);
    setDifficulty(nextDifficulty);
    setRound(nextRound);
    setStageIndex(0);
    setQuizState("idle");
    setSelectedAnswer(null);
    setTutorText("");
    setTutorSource("fallback");
    setChallengeSource("loading");
    setIsPlaying(true);
    setTriviaIndex(Math.floor(Math.random() * triviaTips.length));
  }

  function changeLevel(nextLevel: Level) {
    resetRound(nextLevel, 1, 1);
  }

  function nextChallengeSameLevel() {
    resetRound(level, difficulty, round + 1);
  }

  function nextHarderChallenge() {
    const maxDifficulty = maxDifficultyByLevel[level];
    resetRound(level, Math.min(maxDifficulty, difficulty + 1), round + 1);
  }

  async function submitAnswer(answer: string) {
    if (!challenge || locked) {
      return;
    }

    const correct = answer === challenge.answer;
    setSelectedAnswer(answer);
    setQuizState(correct ? "correct" : "wrong");
    setAttempts((current) => current + 1);
    setCorrectCount((current) => current + (correct ? 1 : 0));
    setIsPlaying(false);
    setStageIndex(getStageIndex("reveal"));
    setTutorSource("loading");

    const response = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge,
        stageId: "reveal",
        level,
        selectedAnswer: answer,
        quizCorrect: correct
      })
    }).catch(() => null);

    if (!response) {
      setTutorSource("fallback");
      setTutorText(challenge.insight);
      return;
    }

    const data = (await response.json()) as { source?: Source; text?: string };
    setTutorSource(data.source === "live" ? "live" : "fallback");
    setTutorText(data.text ?? challenge.insight);
  }

  return (
    <main className="app-shell">
      <section className="workbench" aria-label="Attention Lab tutor">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <p className="eyebrow">Transformer attention</p>
              <h1>Attention Lab</h1>
            </div>
          </div>
          <div className="status-row">
            <span className="topic-pill">Round {round}</span>
          </div>
        </header>

        <section className="control-strip" aria-label="Tutor controls">
          <SegmentedControl
            label="Level"
            value={level}
            options={levels.map((item) => ({
              value: item.id,
              label: item.label
            }))}
            onChange={(value) => changeLevel(value as Level)}
          />
          <DifficultyTrack level={level} difficulty={difficulty} />
          <div className="transport" aria-label="Round controls">
            <button
              className="text-button"
              type="button"
              onClick={nextChallengeSameLevel}
            >
              New Round
            </button>
            <button
              className="text-button accent"
              type="button"
              onClick={nextHarderChallenge}
              disabled={difficulty >= maxDifficultyByLevel[level]}
            >
              Harder
            </button>
          </div>
        </section>

        <section className="content-grid">
          <section className="lesson-panel" aria-label="Adaptive tutor">
            <div className="progress-block">
              <div className="progress-copy">
                <span>Mastery</span>
                <strong>{Math.round(mastery * 100)}%</strong>
              </div>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${mastery * 100}%` }} />
              </div>
            </div>

            <div className="stage-stack">
              {stages.map((item, index) => {
                const disabled = !locked && item.id === "reveal";

                return (
                  <button
                    className={`stage-step ${index === stageIndex ? "active" : ""} ${
                      index < stageIndex ? "done" : ""
                    }`}
                    disabled={disabled}
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (disabled) {
                        return;
                      }

                      setStageIndex(index);
                      setIsPlaying(false);
                    }}
                  >
                    <span>{index + 1}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>

            <article className="coach-copy">
              <p className="eyebrow">Adaptive explanation</p>
              <h2>{locked ? "Answer explanation" : stage.title}</h2>
              <p>{locked ? tutorText || "Building explanation..." : stage.coach[level]}</p>
            </article>

            {challenge ? (
              <QuizCard
                challenge={challenge}
                quizState={quizState}
                selectedAnswer={selectedAnswer}
                onAnswer={submitAnswer}
              />
            ) : (
              <LoadingTip
                title="Preparing your next challenge"
                tip={triviaTips[triviaIndex]}
                variant="quiz"
              />
            )}
          </section>

          <section className="visual-panel" aria-label="Attention visualization">
            {challenge ? (
              <>
                <div className="sentence-block">
                  <p className="eyebrow">
                    {challenge.title} / difficulty {difficulty} of{" "}
                    {maxDifficultyByLevel[level]}
                  </p>
                  <h2>{challenge.sentence}</h2>
                </div>
                <AttentionVisualizer
                  challenge={challenge}
                  stage={stage}
                  stageIndex={stageIndex}
                  paceMs={STAGE_MS}
                  quizState={quizState}
                />
                <ReferencePanel challenge={challenge} locked={locked} />
              </>
            ) : (
              <LoadingTip
                title="Generating a fresh sentence"
                tip={triviaTips[triviaIndex]}
                variant="visual"
              />
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

function LoadingTip({
  title,
  tip,
  variant
}: {
  title: string;
  tip: string;
  variant: "quiz" | "visual";
}) {
  if (variant === "quiz") {
    return (
      <div className="loading-tip loading-tip-quiz" role="status" aria-live="polite">
        <div className="loading-spinner" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  return (
    <div className="loading-tip loading-tip-visual" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="eyebrow">{title}</p>
      <p className="loading-headline">Did you know?</p>
      <p className="loading-tip-text">{tip}</p>
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            className={option.value === value ? "selected" : ""}
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function DifficultyTrack({ level, difficulty }: { level: Level; difficulty: number }) {
  const maxDifficulty = maxDifficultyByLevel[level];

  return (
    <div className="difficulty-box" aria-label="Difficulty">
      <div>
        <span>Difficulty</span>
        <strong>
          {difficulty}/{maxDifficulty}
        </strong>
      </div>
      <div className="difficulty-dots" aria-hidden="true">
        {Array.from({ length: maxDifficulty }, (_, index) => (
          <span className={index < difficulty ? "filled" : ""} key={index} />
        ))}
      </div>
    </div>
  );
}

function QuizCard({
  challenge,
  quizState,
  selectedAnswer,
  onAnswer
}: {
  challenge: Challenge;
  quizState: QuizState;
  selectedAnswer: string | null;
  onAnswer: (answer: string) => void;
}) {
  const locked = quizState !== "idle";

  return (
    <article className={`quiz-card ${quizState}`}>
      <p className="eyebrow">Understanding check</p>
      <h3>{challenge.question}</h3>
      <div className="answer-grid">
        {challenge.options.map((option) => {
          const isCorrect = locked && option === challenge.answer;
          const isWrongPick = locked && selectedAnswer === option && option !== challenge.answer;

          return (
            <button
              className={`${selectedAnswer === option ? "picked" : ""} ${
                isCorrect ? "correct-option" : ""
              } ${isWrongPick ? "wrong-option" : ""}`}
              disabled={locked}
              key={option}
              type="button"
              onClick={() => onAnswer(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
      <p className="quiz-result">
        {quizState === "correct"
          ? "Locked in. The answer and attention weights are now revealed."
          : quizState === "wrong"
            ? "Locked in. Compare your choice with the revealed attention pattern."
            : "Lock an answer to reveal the correct reference and the tutor explanation."}
      </p>
    </article>
  );
}

function AttentionVisualizer({
  challenge,
  stage,
  stageIndex,
  paceMs,
  quizState
}: {
  challenge: Challenge;
  stage: Stage;
  stageIndex: number;
  paceMs: number;
  quizState: QuizState;
}) {
  const locked = quizState !== "idle";
  const showCandidates = stageIndex >= getStageIndex("inspect");
  const showReveal = locked && stageIndex >= getStageIndex("reveal");
  const targetX = tokenX(challenge.target.index, challenge.tokens.length);

  return (
    <div
      className={`attention-stage stage-${stage.id} quiz-${quizState}`}
      style={{ "--pace-ms": `${paceMs}ms` } as React.CSSProperties}
    >
      <div className="stage-title-row">
        <div>
          <p className="eyebrow">Active step</p>
          <h3>{stage.title}</h3>
        </div>
        <div className="target-chip">Target: {challenge.target.text}</div>
      </div>

      <div className="token-scroll">
        <div className="attention-canvas">
          <svg className="attention-arcs" viewBox="0 0 1000 170" preserveAspectRatio="none" aria-hidden="true">
            {showReveal &&
              challenge.candidates.map((candidate) => {
                const start = targetX;
                const end = tokenX(candidate.index, challenge.tokens.length);
                const middle = (start + end) / 2;
                const lift = Math.max(24, 90 - Math.abs(start - end) * 0.08);

                return (
                  <path
                    className="attention-path"
                    d={`M ${start} 130 Q ${middle} ${lift} ${end} 130`}
                    key={`${candidate.token}-${candidate.index}`}
                    style={
                      {
                        "--weight": candidate.weight,
                        "--delay": `${candidate.weight * 360}ms`
                      } as React.CSSProperties
                    }
                  />
                );
              })}
          </svg>

          <div
            className="token-track"
            style={
              {
                "--token-count": challenge.tokens.length
              } as React.CSSProperties
            }
          >
            {challenge.tokens.map((token, index) => {
              const candidate = challenge.candidates.find((item) => item.index === index);
              const isTarget = index === challenge.target.index;
              const isCandidate = Boolean(candidate) && showCandidates;
              const strength = showReveal ? candidate?.weight ?? 0 : 0;

              return (
                <div
                  className={`token-card ${isTarget ? "target" : ""} ${
                    isCandidate ? "candidate" : ""
                  }`}
                  key={`${token}-${index}`}
                  style={
                    {
                      "--strength": strength,
                      "--index": index
                    } as React.CSSProperties
                  }
                >
                  <span>{token}</span>
                  {showReveal && candidate ? (
                    <em>{Math.round(candidate.weight * 100)}%</em>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="meaning-output">
        <span className="meaning-label">
          {showReveal ? "Context-aware token" : "Reveal locked"}
        </span>
        <strong>
          {showReveal
            ? `"${challenge.target.text}" = ${challenge.answer}`
            : `Choose an answer to reveal "${challenge.target.text}"`}
        </strong>
      </div>
    </div>
  );
}

function ReferencePanel({
  challenge,
  locked
}: {
  challenge: Challenge;
  locked: boolean;
}) {
  if (!locked) {
    return (
      <div className="insight-row">
        {challenge.options.map((option) => (
          <div className="weight-meter hidden-meter" key={option}>
            <div>
              <span>{option}</span>
              <strong>?</strong>
            </div>
            <p>Possible reference. Lock your answer before the tutor reveals attention.</p>
            <div className="meter-track" aria-hidden="true">
              <span style={{ width: "0%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="insight-row">
      {challenge.candidates.map((candidate) => (
        <div className="weight-meter" key={`${candidate.token}-${candidate.index}`}>
          <div>
            <span>{candidate.token}</span>
            <strong>{Math.round(candidate.weight * 100)}%</strong>
          </div>
          <p>{candidate.note}</p>
          <div className="meter-track" aria-hidden="true">
            <span style={{ width: `${candidate.weight * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function tokenX(index: number, count: number) {
  if (count <= 1) {
    return 500;
  }

  return 52 + (index / (count - 1)) * 896;
}
