import { describe, expect, it } from "vitest";
import { selectLearnedTodayPracticeItems } from "../lib/vocabulary/review-practice";

describe("same-day vocabulary practice", () => {
  it("uses the learner's local calendar date", () => {
    const items = [
      {
        id: "today",
        learned_at: "2026-07-14T18:30:00.000Z",
      },
      {
        id: "yesterday",
        learned_at: "2026-07-14T16:30:00.000Z",
      },
      {
        id: "not-learned",
        learned_at: null,
      },
    ];

    expect(
      selectLearnedTodayPracticeItems(
        items,
        "2026-07-15",
        "Asia/Krasnoyarsk",
      ).map((item) => item.id),
    ).toEqual(["today"]);
  });

  it("keeps scheduled cards out of the optional practice queue", () => {
    const items = [
      { id: "scheduled", learned_at: "2026-07-15T06:00:00.000Z" },
      { id: "practice", learned_at: "2026-07-15T07:00:00.000Z" },
    ];

    expect(
      selectLearnedTodayPracticeItems(
        items,
        "2026-07-15",
        "UTC",
        ["scheduled"],
      ).map((item) => item.id),
    ).toEqual(["practice"]);
  });
});
