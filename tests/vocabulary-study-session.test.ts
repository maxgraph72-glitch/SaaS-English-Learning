import { describe, expect, it } from "vitest";
import {
  STUDY_SESSION_LIMIT,
  completeCurrentAfterConfirmation,
  getQueueProgress,
  isPracticeEligible,
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

  it("allows only unscheduled stage-zero intake and learning words", () => {
    expect(
      isStudyEligible({
        current_group: "unknown",
        repetition_stage: 0,
        next_review_date: null,
      }),
    ).toBe(true);
    expect(
      isStudyEligible({
        current_group: "learning",
        repetition_stage: 0,
        next_review_date: null,
      }),
    ).toBe(true);
    expect(
      isStudyEligible({
        current_group: "learning",
        repetition_stage: 1,
        next_review_date: "2026-07-15",
      }),
    ).toBe(false);
  });

  it("allows scheduled learned words to be practiced without making new words eligible", () => {
    expect(
      isPracticeEligible({ repetition_stage: 1, next_review_date: "2026-08-20" }),
    ).toBe(true);
    expect(
      isPracticeEligible({ repetition_stage: 5, next_review_date: "2026-09-18" }),
    ).toBe(true);
    expect(isPracticeEligible({ repetition_stage: 0, next_review_date: null })).toBe(false);
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
    expect(resolveReviewShortcut(shortcutDefaults)).toBe("reveal");
    expect(
      resolveReviewShortcut({ ...shortcutDefaults, phase: "revealed", key: "1" }),
    ).toBe("incorrect");
    expect(
      resolveReviewShortcut({ ...shortcutDefaults, phase: "revealed", key: "2" }),
    ).toBe("correct");
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
