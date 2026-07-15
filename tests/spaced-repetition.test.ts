import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calculateReviewOutcome,
  scheduleNewlyLearned,
  type RepetitionStage,
} from "../lib/learning/spaced-repetition";

describe("spaced repetition scheduling", () => {
  it("schedules a newly learned word for the next local calendar day", () => {
    expect(scheduleNewlyLearned("2026-07-13")).toEqual({
      group: "learning",
      stage: 1,
      nextReviewDate: "2026-07-14",
    });
  });

  it.each([
    [2999, "known", 2, "2026-07-15"],
    [3000, "repeat", 1, "2026-07-14"],
    [5000, "repeat", 1, "2026-07-14"],
    [5001, "weak", 1, "2026-07-14"],
    [10000, "weak", 1, "2026-07-14"],
    [10001, "learning", 1, "2026-07-14"],
  ] as const)(
    "classifies a correct response at %i ms",
    (responseTimeMs, group, stage, nextReviewDate) => {
      expect(
        calculateReviewOutcome({
          correct: true,
          responseTimeMs,
          currentStage: 1,
          reviewDate: "2026-07-13",
        }),
      ).toEqual({ group, stage, nextReviewDate });
    },
  );

  it.each([0, 2999, 3000, 10000, 10001])(
    "lets an incorrect answer override a %i ms response",
    (responseTimeMs) => {
      expect(
        calculateReviewOutcome({
          correct: false,
          responseTimeMs,
          currentStage: 5,
          reviewDate: "2026-07-13",
        }),
      ).toEqual({
        group: "learning",
        stage: 1,
        nextReviewDate: "2026-07-14",
      });
    },
  );

  it("advances through stages 1, 2, 3, 4, and 5", () => {
    const expected = [
      [1, 2, "2026-07-15"],
      [2, 3, "2026-07-16"],
      [3, 4, "2026-07-20"],
      [4, 5, "2026-08-12"],
      [5, 5, "2026-08-12"],
    ] as const;

    for (const [currentStage, stage, nextReviewDate] of expected) {
      expect(
        calculateReviewOutcome({
          correct: true,
          responseTimeMs: 2000,
          currentStage,
          reviewDate: "2026-07-13",
        }),
      ).toEqual({ group: "known", stage, nextReviewDate });
    }
  });

  it.each([
    [1, "2026-07-14"],
    [2, "2026-07-15"],
    [3, "2026-07-16"],
    [4, "2026-07-20"],
    [5, "2026-08-12"],
  ] as const)("repeats stage %i at its current interval", (stage, nextReviewDate) => {
    expect(
      calculateReviewOutcome({
        correct: true,
        responseTimeMs: 4000,
        currentStage: stage,
        reviewDate: "2026-07-13",
      }),
    ).toEqual({ group: "repeat", stage, nextReviewDate });
  });

  it("resets a weak result to stage 1 and tomorrow", () => {
    expect(
      calculateReviewOutcome({
        correct: true,
        responseTimeMs: 7000,
        currentStage: 4,
        reviewDate: "2026-07-13",
      }),
    ).toEqual({ group: "weak", stage: 1, nextReviewDate: "2026-07-14" });
  });

  it("schedules an overdue review from the actual review date", () => {
    expect(
      calculateReviewOutcome({
        correct: true,
        responseTimeMs: 2500,
        currentStage: 3,
        reviewDate: "2026-08-20",
      }).nextReviewDate,
    ).toBe("2026-08-27");
  });

  it.each([
    ["2026-01-31", 1, "2026-02-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2024-02-28", 1, "2024-02-29"],
    ["2026-01-31", 30, "2026-03-02"],
  ] as const)("adds calendar days across month and year ends", (date, days, expected) => {
    expect(addCalendarDays(date, days)).toBe(expected);
  });

  it("rejects invalid response times and stages", () => {
    expect(() =>
      calculateReviewOutcome({
        correct: true,
        responseTimeMs: -1,
        currentStage: 1,
        reviewDate: "2026-07-13",
      }),
    ).toThrow(/non-negative/);

    expect(() =>
      calculateReviewOutcome({
        correct: true,
        responseTimeMs: 1000,
        currentStage: 0 as RepetitionStage,
        reviewDate: "2026-07-13",
      }),
    ).toThrow(/between 1 and 5/);
  });
});
