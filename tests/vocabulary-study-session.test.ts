import { describe, expect, it } from "vitest";
import {
  STUDY_SESSION_LIMIT,
  completeCurrentAfterConfirmation,
  getQueueProgress,
  isReviewDue,
  isSameDayPracticeAvailable,
  isStudyEligible,
  parseStudyItemIds,
  resolveReviewShortcut,
  resolveStudyShortcut,
  restoreSelectionOrder,
  rotateCurrentToEnd,
  type ShortcutInput,
} from "../lib/vocabulary/study-session";

function itemId(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

const shortcutDefaults: ShortcutInput = {
  key: " ",
  phase: "front",
  pending: false,
  repeat: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  editableTarget: false,
};

describe("vocabulary study selection", () => {
  it("de-duplicates requested IDs, ignores malformed values, and caps the result at 10", () => {
    const ids = Array.from({ length: STUDY_SESSION_LIMIT + 2 }, (_, index) =>
      itemId(index + 1),
    );

    expect(
      parseStudyItemIds(["not-an-id", ids[0], ids[0].toUpperCase(), ...ids.slice(1)]),
    ).toEqual(ids.slice(0, STUDY_SESSION_LIMIT));
  });

  it("restores the learner's selection order after the database response", () => {
    const selected = [itemId(3), itemId(1), itemId(2)];
    const databaseRows = [
      { id: itemId(2), word: "two" },
      { id: itemId(3), word: "three" },
      { id: itemId(1), word: "one" },
    ];

    expect(restoreSelectionOrder(selected, databaseRows).map((item) => item.word)).toEqual([
      "three",
      "one",
      "two",
    ]);
  });

  it("allows new and relearning words into study", () => {
    expect(
      isStudyEligible({
        learning_state: "new",
        knowledge_category: null,
        repetition_stage: 0,
        requires_relearning: false,
      }),
    ).toBe(true);
    expect(
      isStudyEligible({
        learning_state: "learning",
        knowledge_category: 4,
        repetition_stage: 1,
        requires_relearning: true,
      }),
    ).toBe(true);
    expect(
      isStudyEligible({
        learning_state: "scheduled",
        knowledge_category: 2,
        repetition_stage: 2,
        requires_relearning: false,
      }),
    ).toBe(false);
  });

  it("routes only scheduled words whose review date has arrived to Review", () => {
    expect(
      isReviewDue(
        {
          repetition_stage: 1,
          next_review_date: "2026-07-28",
          requires_relearning: false,
        },
        "2026-07-28",
      ),
    ).toBe(true);
    expect(
      isReviewDue(
        {
          repetition_stage: 3,
          next_review_date: "2026-07-27",
          requires_relearning: false,
        },
        "2026-07-28",
      ),
    ).toBe(true);
    expect(
      isReviewDue(
        {
          repetition_stage: 1,
          next_review_date: "2026-07-29",
          requires_relearning: false,
        },
        "2026-07-28",
      ),
    ).toBe(false);
    expect(
      isReviewDue(
        {
          repetition_stage: 0,
          next_review_date: null,
          requires_relearning: false,
        },
        "2026-07-28",
      ),
    ).toBe(false);
  });

  it("recognizes only words advanced on the current local date as practice", () => {
    expect(
      isSameDayPracticeAvailable(
        {
          last_stage_advanced_date: "2026-07-28",
          next_review_date: "2026-08-04",
          requires_relearning: false,
        },
        "2026-07-28",
      ),
    ).toBe(true);
    expect(
      isSameDayPracticeAvailable(
        {
          last_stage_advanced_date: "2026-07-27",
          next_review_date: "2026-08-04",
          requires_relearning: false,
        },
        "2026-07-28",
      ),
    ).toBe(false);
  });
});

describe("card session queues", () => {
  it("moves Again to the end without completing the word", () => {
    const queue = ["one", "two", "three"];
    const rotated = rotateCurrentToEnd(queue);

    expect(rotated).toEqual(["two", "three", "one"]);
    expect(getQueueProgress(queue.length, rotated.length).completed).toBe(0);
  });

  it("removes Learned only after server confirmation", () => {
    const queue = ["one", "two"];

    expect(completeCurrentAfterConfirmation(queue, false)).toEqual(queue);
    expect(completeCurrentAfterConfirmation(queue, true)).toEqual(["two"]);
    expect(completeCurrentAfterConfirmation(["two"], true)).toEqual([]);
  });

  it("rotates Later only when at least two review cards remain", () => {
    expect(rotateCurrentToEnd(["one", "two"])).toEqual(["two", "one"]);
    expect(rotateCurrentToEnd(["one"])).toEqual(["one"]);
    expect(getQueueProgress(2, rotateCurrentToEnd(["one", "two"]).length)).toEqual({
      total: 2,
      completed: 0,
      remaining: 2,
      percent: 0,
    });
  });

  it("bases progress on confirmed removals", () => {
    expect(getQueueProgress(4, 4)).toMatchObject({ completed: 0, percent: 0 });
    expect(getQueueProgress(4, 3)).toMatchObject({ completed: 1, percent: 25 });
    expect(getQueueProgress(4, 0)).toMatchObject({ completed: 4, percent: 100 });
  });
});

describe("card shortcuts", () => {
  it("maps study shortcuts only in valid card phases", () => {
    expect(resolveStudyShortcut(shortcutDefaults)).toBe("reveal");
    expect(resolveStudyShortcut({ ...shortcutDefaults, phase: "revealed", key: "1" })).toBe(
      "again",
    );
    expect(resolveStudyShortcut({ ...shortcutDefaults, phase: "revealed", key: "2" })).toBe(
      "learned",
    );
    expect(resolveStudyShortcut({ ...shortcutDefaults, key: "1" })).toBeNull();
  });

  it("maps review shortcuts and requires a rotatable queue for Later", () => {
    expect(resolveReviewShortcut(shortcutDefaults)).toBe("submit");
    expect(
      resolveReviewShortcut({ ...shortcutDefaults, phase: "result", key: "1" }),
    ).toBe("repeat");
    expect(
      resolveReviewShortcut({ ...shortcutDefaults, phase: "result", key: "2" }),
    ).toBe("continue");
    expect(resolveReviewShortcut({ ...shortcutDefaults, key: "s", canRotate: true })).toBe(
      "later",
    );
    expect(resolveReviewShortcut({ ...shortcutDefaults, key: "s", canRotate: false })).toBeNull();
  });

  it.each([
    { pending: true },
    { repeat: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { shiftKey: true },
    { editableTarget: true },
  ])("ignores blocked shortcut context %#", (blockedState) => {
    expect(resolveStudyShortcut({ ...shortcutDefaults, ...blockedState })).toBeNull();
    expect(resolveReviewShortcut({ ...shortcutDefaults, ...blockedState })).toBeNull();
  });
});
