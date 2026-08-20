import type { GeneratedExercise } from "./types";

const EXPLICIT_CONTINUOUS_SIGNALS = [
  { pattern: /^look[!,]/iu, signal: "Look!" },
  { pattern: /\bright now\b/iu, signal: "right now" },
  { pattern: /\bat the moment\b/iu, signal: "at the moment" },
  { pattern: /\bcurrently\b/iu, signal: "currently" },
  { pattern: /\bnow\b/iu, signal: "now" },
  { pattern: /\btoday\b/iu, signal: "today" },
  { pattern: /\bthis (?:week|month)\b/iu, signal: "a temporary this-week or this-month context" },
] as const;

export function applyTenseContrastRule(
  sentence: string,
  exercise: GeneratedExercise,
): GeneratedExercise {
  const matched = EXPLICIT_CONTINUOUS_SIGNALS.find(({ pattern }) => pattern.test(sentence));
  if (!matched || exercise.grammarTopic !== "present_continuous") return exercise;
  return {
    ...exercise,
    exerciseType: "tense_contrast",
    grammarTopic: "present_simple_vs_continuous",
    explanation: `${matched.signal} makes the situation explicitly current or temporary, so the Present Continuous is required.`,
    transformation: {
      ...exercise.transformation,
      contrastRule: "explicit-current-or-temporary-context",
    },
    analysis: {
      ...exercise.analysis,
      contrastSignal: matched.signal,
    },
  };
}
