export interface VocabularyImportRow {
  word: string;
  translation: string;
}

export interface ParsedVocabularyCsv {
  rows: VocabularyImportRow[];
  invalidRows: number;
  headerDetected: boolean;
}

const WORD_HEADERS = new Set([
  "word",
  "english",
  "english word",
  "vocabulary",
  "term",
]);
const TRANSLATION_HEADERS = new Set([
  "translation",
  "meaning",
  "definition",
  "russian",
  "перевод",
]);

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseVocabularyCsv(input: string): ParsedVocabularyCsv {
  const parsedRows = parseCsv(input.replace(/^\uFEFF/, ""));
  let headerDetected = false;
  let invalidRows = 0;
  const rows: VocabularyImportRow[] = [];

  parsedRows.forEach((columns, index) => {
    const word = (columns[0] ?? "").trim();
    const translation = (columns[1] ?? "").trim();

    if (
      index === 0 &&
      WORD_HEADERS.has(word.toLocaleLowerCase("en")) &&
      TRANSLATION_HEADERS.has(translation.toLocaleLowerCase("en"))
    ) {
      headerDetected = true;
      return;
    }

    if (columns.every((column) => column.trim() === "")) return;
    if (!word || !translation) {
      invalidRows += 1;
      return;
    }

    rows.push({ word, translation });
  });

  return { rows, invalidRows, headerDetected };
}
