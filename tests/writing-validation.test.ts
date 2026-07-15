import { describe, expect, it } from "vitest";
import {
  clampWritingActiveSeconds,
  normalizeWritingText,
  validateWritingFeedback,
} from "../lib/writing/validation";

describe("writing entry validation", () => {
  it("normalizes line endings and preserves paragraph breaks", () => {
    const result = normalizeWritingText("  First paragraph is here.\r\n\r\nSecond paragraph stays.  ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("First paragraph is here.\n\nSecond paragraph stays.");
      expect(result.wordCount).toBe(7);
    }
  });

  it("enforces the 20 non-whitespace character boundary", () => {
    expect(normalizeWritingText("a".repeat(19)).ok).toBe(false);
    expect(normalizeWritingText("a".repeat(20)).ok).toBe(true);
    expect(normalizeWritingText("   \n\t ").ok).toBe(false);
  });

  it("enforces the 5,000 character boundary without truncating", () => {
    const accepted = normalizeWritingText("a".repeat(5000));
    const rejected = normalizeWritingText("a".repeat(5001));
    expect(accepted.ok).toBe(true);
    expect(rejected.ok).toBe(false);
    expect(rejected.characterCount).toBe(5001);
  });

  it("rounds and clamps approximate active writing time", () => {
    expect(clampWritingActiveSeconds(-5)).toBe(0);
    expect(clampWritingActiveSeconds(12.6)).toBe(13);
    expect(clampWritingActiveSeconds(99999)).toBe(3600);
    expect(clampWritingActiveSeconds(Number.NaN)).toBe(0);
  });
});

describe("writing feedback validation", () => {
  const original = "Today I go to the park, and I feel calm about the week.";

  it("accepts every supported feedback category", () => {
    const result = validateWritingFeedback({
      schemaVersion: 1,
      correctedText: "Today I went to the park, and I felt calm about the week.",
      mistakes: [
        { original: "I go", correction: "I went", category: "grammar", explanation: "Use the past tense for a finished event." },
        { original: "the park", correction: "the local park", category: "vocabulary", explanation: "This is an optional specificity suggestion." },
        { original: "Today", correction: "Today", category: "spelling", explanation: "The spelling is already correct." },
        { original: "park,", correction: "park,", category: "punctuation", explanation: "The comma separates the clauses clearly." },
        { original: "feel calm", correction: "felt calm", category: "style", explanation: "Past tense keeps the timeline consistent." },
      ],
      estimatedCefr: "B1",
      cefrRationale: "The entry uses connected clauses and clear everyday vocabulary.",
    }, original);

    expect(result.mistakes.map((mistake) => mistake.category)).toEqual([
      "grammar",
      "vocabulary",
      "spelling",
      "punctuation",
      "style",
    ]);
  });

  it("rejects malformed fields, unknown categories, and excessive lists", () => {
    expect(() => validateWritingFeedback({
      schemaVersion: 1,
      correctedText: original,
      mistakes: [{ original: "Today", correction: "Today", category: "tone", explanation: "No." }],
      estimatedCefr: "B1",
      cefrRationale: "Short estimate.",
    }, original)).toThrow(/category/i);

    expect(() => validateWritingFeedback({
      schemaVersion: 1,
      correctedText: original,
      mistakes: Array.from({ length: 11 }, () => ({
        original: "Today",
        correction: "Today",
        category: "style",
        explanation: "Optional.",
      })),
      estimatedCefr: "B1",
      cefrRationale: "Short estimate.",
    }, original)).toThrow(/too many/i);

    expect(() => validateWritingFeedback({
      schemaVersion: "1",
      correctedText: original,
      mistakes: [],
      estimatedCefr: "B1",
      cefrRationale: "Short estimate.",
    }, original)).toThrow(/version/i);
  });

  it("requires every mistake to relate to the submitted text", () => {
    expect(() => validateWritingFeedback({
      schemaVersion: 1,
      correctedText: original,
      mistakes: [{
        original: "I visited London",
        correction: "I visited Paris",
        category: "grammar",
        explanation: "This text is unrelated.",
      }],
      estimatedCefr: "B1",
      cefrRationale: "Short estimate.",
    }, original)).toThrow(/does not appear/i);
  });

  it("rejects concrete facts introduced by the correction", () => {
    expect(() => validateWritingFeedback({
      schemaVersion: 1,
      correctedText: `${original} I walked 12 kilometres.`,
      mistakes: [],
      estimatedCefr: "B1",
      cefrRationale: "Short estimate.",
    }, original)).toThrow(/concrete facts/i);
  });
});
