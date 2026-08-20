import { readFileSync } from "node:fs";
import type { PracticeSourceManifest, SentenceCandidate } from "../../lib/practice/types.ts";
import { createSentenceCandidate, decodeUtf8, verifyManifestForInput } from "./shared.ts";

export function importCommonVoiceTsv(
  input: Uint8Array | string,
  manifest: PracticeSourceManifest,
): SentenceCandidate[] {
  verifyManifestForInput(input, manifest);
  const lines = decodeUtf8(input).replace(/^\uFEFF/u, "").split(/\r?\n/u).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  const sentenceIndex = headers.indexOf("sentence");
  const idIndex = ["sentence_id", "sentenceId", "path"].map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  if (sentenceIndex < 0 || idIndex < 0) {
    throw new Error("Common Voice TSV requires sentence and sentence_id (or path) columns.");
  }

  return lines.slice(1).map((line, rowIndex) => {
    const columns = line.split("\t");
    const externalId = columns[idIndex]?.trim();
    const sentence = columns[sentenceIndex]?.trim();
    if (!externalId || !sentence) throw new Error(`Invalid Common Voice row ${rowIndex + 2}.`);
    return createSentenceCandidate({ externalId, sentence, manifest });
  });
}

export function importCommonVoiceFile(
  inputPath: string,
  manifest: PracticeSourceManifest,
): SentenceCandidate[] {
  return importCommonVoiceTsv(readFileSync(inputPath), manifest);
}
