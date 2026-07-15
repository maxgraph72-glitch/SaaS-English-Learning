import {
  CEFR_LEVELS,
  WRITING_MISTAKE_CATEGORIES,
  type WritingFeedbackResult,
  type WritingMistake,
} from "./types";

export const WRITING_MIN_NON_WHITESPACE = 20;
export const WRITING_MAX_CHARACTERS = 5000;
export const WRITING_MAX_ACTIVE_SECONDS = 3600;

export type WritingTextValidation =
  | {
      ok: true;
      text: string;
      characterCount: number;
      nonWhitespaceCount: number;
      wordCount: number;
    }
  | {
      ok: false;
      code: "required" | "too_short" | "too_long";
      message: string;
      characterCount: number;
      nonWhitespaceCount: number;
      wordCount: number;
    };

function countCharacters(value: string) {
  return Array.from(value).length;
}

export function normalizeWritingText(input: unknown): WritingTextValidation {
  const normalized = typeof input === "string"
    ? input.replace(/\r\n?/gu, "\n").trim()
    : "";
  const characterCount = countCharacters(normalized);
  const nonWhitespaceCount = countCharacters(normalized.replace(/\s/gu, ""));
  const wordCount = normalized.match(/\S+/gu)?.length ?? 0;
  const counts = { characterCount, nonWhitespaceCount, wordCount };

  if (!normalized) {
    return {
      ok: false,
      code: "required",
      message: "Write a short entry before asking for feedback.",
      ...counts,
    };
  }
  if (nonWhitespaceCount < WRITING_MIN_NON_WHITESPACE) {
    return {
      ok: false,
      code: "too_short",
      message: `Add at least ${WRITING_MIN_NON_WHITESPACE - nonWhitespaceCount} more non-space characters.`,
      ...counts,
    };
  }
  if (characterCount > WRITING_MAX_CHARACTERS) {
    return {
      ok: false,
      code: "too_long",
      message: `Remove ${characterCount - WRITING_MAX_CHARACTERS} characters to continue.`,
      ...counts,
    };
  }

  return { ok: true, text: normalized, ...counts };
}

export function clampWritingActiveSeconds(input: unknown) {
  if (typeof input !== "number" || !Number.isFinite(input)) return 0;
  return Math.min(WRITING_MAX_ACTIVE_SECONDS, Math.max(0, Math.round(input)));
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const expected = new Set(keys);
  return Object.keys(value).every((key) => expected.has(key))
    && keys.every((key) => Object.hasOwn(value, key));
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function isPlainText(value: string) {
  return !value.includes("\0")
    && !/```/u.test(value)
    && !/<\/?[a-z][^>]*>/iu.test(value);
}

function requirePlainText(value: unknown, name: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`${name} must be text.`);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (!normalized || countCharacters(normalized) > maxLength || !isPlainText(normalized)) {
    throw new Error(`${name} is not valid plain text.`);
  }
  return normalized;
}

function parseMistake(value: unknown, originalText: string): WritingMistake {
  if (!isRecord(value) || !hasOnlyKeys(value, ["original", "correction", "category", "explanation"])) {
    throw new Error("Each mistake must use the expected fields only.");
  }

  const original = requirePlainText(value.original, "Mistake text", 500);
  const correction = requirePlainText(value.correction, "Mistake correction", 500);
  const explanation = requirePlainText(value.explanation, "Mistake explanation", 1000);
  if (typeof value.category !== "string"
      || !WRITING_MISTAKE_CATEGORIES.includes(value.category as WritingMistake["category"])) {
    throw new Error("Mistake category is not supported.");
  }

  if (!normalizeComparable(originalText).includes(normalizeComparable(original))) {
    throw new Error("A listed mistake does not appear in the submitted entry.");
  }

  return {
    original,
    correction,
    category: value.category as WritingMistake["category"],
    explanation,
  };
}

function concreteClaims(value: string) {
  const matches = value.match(
    /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.\w+|\b\d+(?:[.,]\d+)?\b/giu,
  ) ?? [];
  return new Set(matches.map((match) => normalizeComparable(match)));
}

function rejectsIntroducedConcreteClaims(originalText: string, correctedText: string) {
  const sourceClaims = concreteClaims(originalText);
  return [...concreteClaims(correctedText)].some((claim) => !sourceClaims.has(claim));
}

export function validateWritingFeedback(
  value: unknown,
  originalText: string,
): WritingFeedbackResult {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "schemaVersion",
    "correctedText",
    "mistakes",
    "estimatedCefr",
    "cefrRationale",
  ])) {
    throw new Error("Writing feedback does not match schema version 1.");
  }
  if (value.schemaVersion !== 1) throw new Error("Writing feedback schema version is unsupported.");
  if (!Array.isArray(value.mistakes) || value.mistakes.length > 10) {
    throw new Error("Writing feedback contains too many mistakes or an invalid list.");
  }

  const correctedText = requirePlainText(value.correctedText, "Corrected text", 7500);
  const cefrRationale = requirePlainText(value.cefrRationale, "CEFR rationale", 1000);
  if (typeof value.estimatedCefr !== "string"
      || !CEFR_LEVELS.includes(value.estimatedCefr as WritingFeedbackResult["estimatedCefr"])) {
    throw new Error("Estimated CEFR level is not supported.");
  }
  if (rejectsIntroducedConcreteClaims(originalText, correctedText)) {
    throw new Error("Corrected text introduces concrete facts that were not in the entry.");
  }

  return {
    schemaVersion: 1,
    correctedText,
    mistakes: value.mistakes.map((mistake) => parseMistake(mistake, originalText)),
    estimatedCefr: value.estimatedCefr as WritingFeedbackResult["estimatedCefr"],
    cefrRationale,
  };
}
