import { describe, expect, it } from "vitest";
import { selectSameDayPracticeItems } from "../lib/vocabulary/review-practice";

describe("same-day vocabulary practice", () => {
  it("uses the server-saved local advancement date", () => {
    const items = [
      {
        id: "today",
        last_stage_advanced_date: "2026-07-15",
        next_review_date: "2026-07-16",
        requires_relearning: false,
      },
      {
        id: "yesterday",
        last_stage_advanced_date: "2026-07-14",
        next_review_date: "2026-07-17",
        requires_relearning: false,
      },
      {
        id: "forgotten",
        last_stage_advanced_date: "2026-07-15",
        next_review_date: null,
        requires_relearning: true,
      },
    ];

    expect(
      selectSameDayPracticeItems(items, "2026-07-15").map((item) => item.id),
    ).toEqual(["today"]);
  });

  it("keeps currently due cards out of a separate practice queue", () => {
    const items = [
      {
        id: "scheduled",
        last_stage_advanced_date: "2026-07-15",
        next_review_date: "2026-07-16",
        requires_relearning: false,
      },
      {
        id: "practice",
        last_stage_advanced_date: "2026-07-15",
        next_review_date: "2026-07-18",
        requires_relearning: false,
      },
    ];

    expect(
      selectSameDayPracticeItems(items, "2026-07-15", ["scheduled"]).map(
        (item) => item.id,
      ),
    ).toEqual(["practice"]);
  });
});
