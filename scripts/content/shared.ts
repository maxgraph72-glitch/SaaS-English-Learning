import { createHash } from "node:crypto";
import type { PracticeSourceManifest, SentenceCandidate } from "../../lib/practice/types.ts";
import {
  normalizeSentence,
  normalizedSentenceHash,
} from "../../lib/practice/sentence-normalization.ts";
import { validateSourceManifest } from "../../lib/practice/validation.ts";

export function decodeUtf8(input: Uint8Array | string): string {
  return typeof input === "string" ? input : new TextDecoder().decode(input);
}

export function verifyManifestForInput(
  input: Uint8Array | string,
  manifest: PracticeSourceManifest,
): void {
  const errors = validateSourceManifest(manifest);
  if (errors.length > 0) throw new Error(errors.join(" "));
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== manifest.archiveSha256) {
    throw new Error(`Input checksum ${actual} does not match the pinned manifest.`);
  }
}

export function createSentenceCandidate(input: {
  externalId: string;
  sentence: string;
  manifest: PracticeSourceManifest;
  sourceUrl?: string;
  sourceCreator?: string;
}): SentenceCandidate {
  const normalizedText = normalizeSentence(input.sentence);
  return {
    externalId: input.externalId.trim(),
    language: "en",
    originalText: input.sentence.trim(),
    normalizedText,
    normalizedHash: normalizedSentenceHash(normalizedText),
    source: input.manifest,
    sourceUrl: input.sourceUrl,
    sourceCreator: input.sourceCreator,
  };
}
