import { describe, expect, it } from "vitest";
import {
  canSubmitPracticeAnswer,
  completePracticePrompt,
  currentPracticeExercise,
  displayedPracticeExercise,
  getOrCreateSubmissionId,
  practiceSessionProgress,
} from "../lib/practice/session";
import type { PracticeExercise } from "../lib/practice/types";

const exercises = Array.from({ length: 10 }, (_, index) => ({
  id: `exercise-${index + 1}`,
  content_version: 1,
  exercise_type: "affirmative" as const,
  grammar_topic: "present_simple" as const,
  cefr_estimate: "A1" as const,
  prompt: `They ___ item ${index + 1}. (read)`,
  hint: "Use read.",
  lemma: "read",
  accepted_answers: ["read"],
  distractors: [],
  explanation: "Use the base form with they.",
  license_code: "CC0-1.0",
  source_credit: "Fixture",
})) satisfies PracticeExercise[];

describe("critical practice session flow", () => {
  it("loads and completes a ten-item queue without repeating an item", () => {
    const visited = Array.from({ length: 10 }, (_, completed) => currentPracticeExercise(exercises, completed)?.id);
    expect(new Set(visited).size).toBe(10);
    expect(currentPracticeExercise(exercises, 10)).toBeNull();
    expect(practiceSessionProgress(10, 10)).toEqual({ total: 10, completed: 10, remaining: 0, percent: 100 });
  });

  it("prevents empty, pending, and post-feedback double submission", () => {
    expect(canSubmitPracticeAnswer({ answer: "", pending: false, hasFeedback: false })).toBe(false);
    expect(canSubmitPracticeAnswer({ answer: "works", pending: true, hasFeedback: false })).toBe(false);
    expect(canSubmitPracticeAnswer({ answer: "works", pending: false, hasFeedback: true })).toBe(false);
    expect(canSubmitPracticeAnswer({ answer: "works", pending: false, hasFeedback: false })).toBe(true);
  });

  it("reuses the same submission ID after a failed write", () => {
    const ids = new Map<string, string>();
    let counter = 0;
    const factory = () => `submission-${++counter}`;
    expect(getOrCreateSubmissionId(ids, "exercise-1", factory)).toBe("submission-1");
    expect(getOrCreateSubmissionId(ids, "exercise-1", factory)).toBe("submission-1");
    expect(counter).toBe(1);
  });

  it("keeps the answered exercise visible if refreshed props reorder the session", () => {
    const answeredExercise = {
      ...exercises[0],
      id: "answered",
      prompt: "She ___ every morning. (read)",
    };
    const refreshedExercise = {
      ...exercises[1],
      id: "replacement",
      prompt: "They ___ now. (work)",
    };

    expect(displayedPracticeExercise([refreshedExercise], 0, answeredExercise))
      .toBe(answeredExercise);
  });

  it("shows the correct answer inside the same prompt", () => {
    expect(completePracticePrompt("She ___ every morning. (read)", "reads"))
      .toBe("She reads every morning. (read)");
  });
});
