import { readFileSync } from "node:fs";
import type { PracticeSourceManifest, SentenceCandidate } from "../../lib/practice/types.ts";
import { createSentenceCandidate, decodeUtf8, verifyManifestForInput } from "./shared.ts";

export function importTatoebaCc0Tsv(
  input: Uint8Array | string,
  manifest: PracticeSourceManifest,
): SentenceCandidate[] {
  verifyManifestForInput(input, manifest);
  return decodeUtf8(input)
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, rowIndex) => {
      const [externalId, language, sentence, lastModified, ...unexpected] = line.split("\t");
      if (!externalId?.trim() || !sentence?.trim() || unexpected.length > 0) {
        throw new Error(`Invalid Tatoeba CC0 row ${rowIndex + 1}.`);
      }
      if (!new Set(["en", "eng"]).has(language?.trim().toLocaleLowerCase("en"))) {
        throw new Error(`Tatoeba row ${rowIndex + 1} is not English.`);
      }
      if (lastModified && !/^\d{4}-\d{2}-\d{2}/u.test(lastModified)) {
        throw new Error(`Tatoeba row ${rowIndex + 1} has an invalid modified date.`);
      }
      return createSentenceCandidate({
        externalId,
        sentence,
        manifest,
        sourceUrl: /^\d+$/u.test(externalId)
          ? `https://tatoeba.org/en/sentences/show/${externalId}`
          : undefined,
      });
    });
}

export function importTatoebaCc0File(
  inputPath: string,
  manifest: PracticeSourceManifest,
): SentenceCandidate[] {
  return importTatoebaCc0Tsv(readFileSync(inputPath), manifest);
}
