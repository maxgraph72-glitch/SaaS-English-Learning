import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  addCalendarMonth,
  advanceStage,
  calculateNextReviewDate,
  calculateOverdueAction,
  calculateReviewAttempt,
  classifyResponse,
  rollbackStage,
  scheduleNewlyLearned,
  type RepetitionStage,
} from "../lib/learning/spaced-repetition";

describe("knowledge categories", () => {
  it.each([
    [0, 1],
    [1000, 1],
    [1001, 2],
    [3000, 2],
    [3001, 3],
    [5000, 3],
    [5001, 4],
    [60_000, 4],
  ] as const)("classifies %i ms as category %i", (responseTimeMs, category) => {
    expect(classifyResponse(responseTimeMs)).toBe(category);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid response time %s",
    (responseTimeMs) => {
      expect(() => classifyResponse(responseTimeMs)).toThrow(/non-negative integer/);
    },
  );
});

describe("six-stage scheduling", () => {
  it("starts a newly studied word at stage 1 on the same local date", () => {
    expect(scheduleNewlyLearned("2026-07-13")).toEqual({
      learningState: "learning",
      category: null,
      stage: 1,
      nextReviewDate: "2026-07-13",
    });
  });

  it.each([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 6],
  ] as const)("advances stage %i to %i", (current, expected) => {
    expect(advanceStage(current)).toBe(expected);
  });

  it.each([
    [1, "2026-07-14"],
    [2, "2026-07-16"],
    [3, "2026-07-20"],
    [4, "2026-07-27"],
    [5, "2026-08-13"],
    [6, "2026-08-13"],
  ] as const)(
    "schedules completion of stage %i from the actual attempt date",
    (completedStage, expected) => {
      expect(calculateNextReviewDate(completedStage, "2026-07-13")).toBe(expected);
    },
  );

  it.each([
    ["2026-01-31", "2026-02-28"],
    ["2024-01-31", "2024-02-29"],
    ["2026-03-31", "2026-04-30"],
    ["2026-12-31", "2027-01-31"],
  ] as const)("adds one clamped calendar month to %s", (date, expected) => {
    expect(addCalendarMonth(date)).toBe(expected);
  });

  it.each([
    ["2026-01-31", 1, "2026-02-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2024-02-28", 1, "2024-02-29"],
  ] as const)("adds calendar days across boundaries", (date, days, expected) => {
    expect(addCalendarDays(date, days)).toBe(expected);
  });

  it("rejects stages outside 1 through 6", () => {
    expect(() => advanceStage(0 as RepetitionStage)).toThrow(/between 1 and 6/);
    expect(() => advanceStage(7 as RepetitionStage)).toThrow(/between 1 and 6/);
  });
});

describe("overdue handling and same-day practice", () => {
  it.each([
    ["2026-07-01", "2026-07-01", "none"],
    ["2026-07-01", "2026-07-02", "rollback"],
    ["2026-07-01", "2026-07-07", "rollback"],
    ["2026-07-01", "2026-07-08", "forgotten"],
    ["2026-07-01", "2026-07-09", "forgotten"],
  ] as const)("maps due %s and local %s to %s", (due, local, expected) => {
    expect(calculateOverdueAction(5, due, local)).toBe(expected);
  });

  it("rolls back exactly one stage with stage 1 as the floor", () => {
    expect(rollbackStage(5)).toBe(4);
    expect(rollbackStage(1)).toBe(1);
  });

  it("advances the rolled-back stage once and schedules from the actual date", () => {
    expect(
      calculateReviewAttempt({
        responseTimeMs: 2500,
        currentStage: 5,
        nextReviewDate: "2026-07-12",
        localDate: "2026-07-13",
      }),
    ).toEqual({
      category: 2,
      stage: 5,
      nextReviewDate: "2026-07-27",
      attemptKind: "scheduled",
      overdueAction: "rollback",
      requiresRelearning: false,
    });
  });

  it("does not apply the same rollback twice", () => {
    expect(
      calculateReviewAttempt({
        responseTimeMs: 2500,
        currentStage: 4,
        nextReviewDate: "2026-07-12",
        localDate: "2026-07-13",
        overdueAlreadyProcessed: true,
      }),
    ).toMatchObject({
      stage: 5,
      nextReviewDate: "2026-07-27",
      overdueAction: "rollback",
    });
  });

  it("moves a word overdue by seven days into relearning", () => {
    expect(
      calculateReviewAttempt({
        responseTimeMs: 900,
        currentStage: 6,
        nextReviewDate: "2026-07-01",
        localDate: "2026-07-08",
      }),
    ).toEqual({
      category: 4,
      stage: 1,
      nextReviewDate: null,
      attemptKind: "scheduled",
      overdueAction: "forgotten",
      requiresRelearning: true,
    });
  });

  it("keeps stage and date on unlimited same-day practice while updating category", () => {
    expect(
      calculateReviewAttempt({
        responseTimeMs: 5001,
        currentStage: 4,
        nextReviewDate: "2026-07-20",
        localDate: "2026-07-13",
        lastStageAdvancedDate: "2026-07-13",
      }),
    ).toEqual({
      category: 4,
      stage: 4,
      nextReviewDate: "2026-07-20",
      attemptKind: "practice",
      overdueAction: "none",
      requiresRelearning: false,
    });
  });

  it("rejects a future scheduled attempt that is not same-day practice", () => {
    expect(() =>
      calculateReviewAttempt({
        responseTimeMs: 1000,
        currentStage: 3,
        nextReviewDate: "2026-07-14",
        localDate: "2026-07-13",
      }),
    ).toThrow(/not due yet/);
  });
});
