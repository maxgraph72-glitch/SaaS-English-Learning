import { generatePresentContinuousExercise } from "./present-continuous.ts";
import { generatePresentSimpleExercise } from "./present-simple.ts";
import { applyTenseContrastRule } from "./tense-contrast.ts";
import type { GeneratedExercise } from "./types";

export function generatePresentTenseExercise(sentence: string): GeneratedExercise | null {
  const continuous = generatePresentContinuousExercise(sentence);
  if (continuous) return applyTenseContrastRule(sentence, continuous);
  return generatePresentSimpleExercise(sentence);
}
