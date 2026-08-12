import { describe, expect, it } from "vitest";
import {
  getVocabularyProgressStatus,
  isReviewDue,
  matchesVocabularyFilter,
} from "../lib/vocabulary/status";

describe("vocabulary progress and daily queue status", () => {
  it("keeps progress status separate from the temporary due queue", () => {
    const item = { repetition_stage: 5, next_review_date: "2026-08-12" };

    expect(getVocabularyProgressStatus(item)).toBe("mastered");
    expect(isReviewDue(item, "2026-08-12")).toBe(true);
    expect(matchesVocabularyFilter(item, "mastered", "2026-08-12")).toBe(true);
    expect(matchesVocabularyFilter(item, "due", "2026-08-12")).toBe(true);
  });

  it("removes a reviewed word from Due today when its next date moves forward", () => {
    const before = { repetition_stage: 2, next_review_date: "2026-08-12" };
    const after = { repetition_stage: 2, next_review_date: "2026-08-14" };

    expect(matchesVocabularyFilter(before, "due", "2026-08-12")).toBe(true);
    expect(matchesVocabularyFilter(after, "due", "2026-08-12")).toBe(false);
    expect(getVocabularyProgressStatus(after)).toBe("learning");
  });

  it.each([
    [{ repetition_stage: 0, next_review_date: null }, "new"],
    [{ repetition_stage: 1, next_review_date: "2026-08-13" }, "learning"],
    [{ repetition_stage: 4, next_review_date: "2026-08-19" }, "learning"],
    [{ repetition_stage: 5, next_review_date: "2026-09-11" }, "mastered"],
  ] as const)("derives a stable progress status from the schedule", (item, status) => {
    expect(getVocabularyProgressStatus(item)).toBe(status);
  });

  it("does not put unscheduled or future words into today's queue", () => {
    expect(
      isReviewDue({ repetition_stage: 0, next_review_date: null }, "2026-08-12"),
    ).toBe(false);
    expect(
      isReviewDue(
        { repetition_stage: 3, next_review_date: "2026-08-13" },
        "2026-08-12",
      ),
    ).toBe(false);
  });
});
