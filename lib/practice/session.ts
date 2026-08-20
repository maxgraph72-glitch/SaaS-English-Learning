import type { PracticeExercise } from "./types";

export interface PracticeSessionResult {
  exerciseId: string;
  correct: boolean;
}

export function practiceSessionProgress(total: number, completed: number) {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.min(Math.max(0, completed), safeTotal);
  return {
    total: safeTotal,
    completed: safeCompleted,
    remaining: safeTotal - safeCompleted,
    percent: safeTotal === 0 ? 100 : (safeCompleted / safeTotal) * 100,
  };
}

export function canSubmitPracticeAnswer(input: {
  answer: string;
  pending: boolean;
  hasFeedback: boolean;
}): boolean {
  return Boolean(input.answer.trim()) && !input.pending && !input.hasFeedback;
}

export function getOrCreateSubmissionId(
  ids: Map<string, string>,
  exerciseId: string,
  createId: () => string,
): string {
  const existing = ids.get(exerciseId);
  if (existing) return existing;
  const created = createId();
  ids.set(exerciseId, created);
  return created;
}

export function currentPracticeExercise(
  exercises: readonly PracticeExercise[],
  completed: number,
): PracticeExercise | null {
  return exercises[completed] ?? null;
}
