import { createHash } from "node:crypto";

const APOSTROPHES = /[\u2018\u2019\u02bc\uff07]/g;
const LEFT_DOUBLE_QUOTES = /[\u201c\u00ab]/g;
const RIGHT_DOUBLE_QUOTES = /[\u201d\u00bb]/g;

export function normalizeSentence(value: string): string {
  return value
    .normalize("NFKC")
    .replace(APOSTROPHES, "'")
    .replace(LEFT_DOUBLE_QUOTES, '"')
    .replace(RIGHT_DOUBLE_QUOTES, '"')
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizedSentenceHash(value: string): string {
  const canonical = normalizeSentence(value).toLocaleLowerCase("en");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
