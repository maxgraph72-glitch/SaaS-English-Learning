import { describe, expect, it } from "vitest";
import { parseCsv, parseVocabularyCsv } from "../lib/vocabulary/csv";

describe("Google Sheets-compatible CSV import", () => {
  it("supports a conventional header and ignores extra columns", () => {
    expect(
      parseVocabularyCsv(
        "English word,Translation,Note\nsteady,устойчивый,adjective\ncalm,спокойный,",
      ),
    ).toEqual({
      headerDetected: true,
      invalidRows: 0,
      rows: [
        { word: "steady", translation: "устойчивый" },
        { word: "calm", translation: "спокойный" },
      ],
    });
  });

  it("parses quoted commas, newlines, escaped quotes, and a UTF-8 BOM", () => {
    expect(
      parseVocabularyCsv(
        '\uFEFFword,translation\r\n"take, off","взлетать"\r\n"say ""hello""","сказать\nпривет"',
      ).rows,
    ).toEqual([
      { word: "take, off", translation: "взлетать" },
      { word: 'say "hello"', translation: "сказать\nпривет" },
    ]);
  });

  it("skips blank rows and counts invalid rows", () => {
    expect(parseVocabularyCsv("word,translation\n\nempty,\n,пусто\nvalid,верный")).toEqual({
      headerDetected: true,
      invalidRows: 2,
      rows: [{ word: "valid", translation: "верный" }],
    });
  });

  it("rejects an unclosed quoted field", () => {
    expect(() => parseCsv('word,"translation')).toThrow(/unclosed/);
  });
});
