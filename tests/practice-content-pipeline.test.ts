import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PracticeSourceManifest } from "../lib/practice/types";
import { normalizedSentenceHash } from "../lib/practice/sentence-normalization";
import { screenSentenceCandidate, validateReviewRecord } from "../lib/practice/validation";
import { buildReviewRecords } from "../scripts/content/generate-present-tenses";
import { importCommonVoiceTsv } from "../scripts/content/import-common-voice";
import { importTatoebaCc0Tsv } from "../scripts/content/import-tatoeba-cc0";
import { deduplicateCandidates } from "../scripts/content/normalize-sentences";
import { buildPublicationSql } from "../scripts/content/publish-package";
import { auditPracticePackage } from "../scripts/content/audit-package";
import { PACKAGE_BUCKETS } from "../scripts/content/select-package";
import { readReviewPackage, validateReviewPackage } from "../scripts/content/validate-package";

const commonVoiceBytes = readFileSync(
  new URL("./fixtures/practice/common-voice-validated.tsv", import.meta.url),
);
const tatoebaBytes = readFileSync(
  new URL("./fixtures/practice/tatoeba-cc0.tsv", import.meta.url),
);
const commonVoiceManifest = JSON.parse(readFileSync(
  new URL("../content/manifests/common-voice-fixture-2026-08-20.json", import.meta.url),
  "utf8",
)) as PracticeSourceManifest;
const tatoebaManifest = JSON.parse(readFileSync(
  new URL("../content/manifests/tatoeba-cc0-fixture-2026-08-20.json", import.meta.url),
  "utf8",
)) as PracticeSourceManifest;

describe("practice content pipeline", () => {
  it("imports pinned Common Voice and Tatoeba-shaped CC0 fixtures", () => {
    const commonVoice = importCommonVoiceTsv(commonVoiceBytes, commonVoiceManifest);
    const tatoeba = importTatoebaCc0Tsv(tatoebaBytes, tatoebaManifest);
    expect(commonVoice).toHaveLength(11);
    expect(tatoeba).toHaveLength(10);
    expect(commonVoice[0].externalId).toBe("fixture-cv-001");
    expect(tatoeba[0].language).toBe("en");
  });

  it("rejects a file whose checksum does not match the manifest", () => {
    expect(() => importTatoebaCc0Tsv("1\teng\tThey work here.\n", tatoebaManifest)).toThrow(/checksum/i);
  });

  it("deduplicates candidates by normalized hash", () => {
    const [candidate] = importCommonVoiceTsv(commonVoiceBytes, commonVoiceManifest);
    const result = deduplicateCandidates([candidate, { ...candidate, externalId: "duplicate" }]);
    expect(result.accepted).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(candidate.normalizedHash).toBe(normalizedSentenceHash(candidate.originalText));
  });

  it("filters malformed, unsafe, and context-dependent candidates", () => {
    const [candidate] = importCommonVoiceTsv(commonVoiceBytes, commonVoiceManifest);
    expect(screenSentenceCandidate({ ...candidate, normalizedText: "Call +1 555 123 4567 now." })).toContain("unsafe_content");
    expect(screenSentenceCandidate({ ...candidate, normalizedText: "Too short." })).toContain("missing_context");
    expect(screenSentenceCandidate({ ...candidate, normalizedText: "They work from home" })).toContain("incorrect_grammar");
  });

  it("builds a structurally valid, pending review package with full provenance", () => {
    const records = buildReviewRecords([
      ...importCommonVoiceTsv(commonVoiceBytes, commonVoiceManifest),
      ...importTatoebaCc0Tsv(tatoebaBytes, tatoebaManifest),
    ]);
    expect(records).toHaveLength(21);
    expect(records.every((record) => record.reviewerDecision === null)).toBe(true);
    expect(records.every((record) => record.source.fixture)).toBe(true);
    expect(records.flatMap(validateReviewRecord)).toEqual([]);
    expect(validateReviewPackage(records)).toEqual([]);
  });

  it("blocks fixture and unreviewed records from publication", () => {
    const records = buildReviewRecords(importTatoebaCc0Tsv(tatoebaBytes, tatoebaManifest));
    const errors = validateReviewPackage(records, { forPublication: true });
    expect(errors.some((error) => /human review/i.test(error))).toBe(true);
    expect(errors.some((error) => /fixtures cannot be published/i.test(error))).toBe(true);
    expect(errors.some((error) => /at least 800/i.test(error))).toBe(true);
    expect(() => buildPublicationSql(records)).toThrow(/human review/i);
  });

  it("keeps the personal 800-item package balanced and editorially approved", () => {
    const records = readReviewPackage(fileURLToPath(new URL(
      "../content/review/present-tenses-package-1.jsonl",
      import.meta.url,
    )));
    expect(records).toHaveLength(800);
    expect(records.every((record) => !record.source.fixture)).toBe(true);
    expect(records.every((record) => record.reviewerDecision === "approve")).toBe(true);
    expect(validateReviewPackage(records)).toEqual([]);
    expect(auditPracticePackage(records)).toEqual([]);

    for (const bucket of PACKAGE_BUCKETS) {
      expect(records.filter((record) =>
        record.grammarTopic === bucket.grammarTopic
        && record.exerciseType === bucket.exerciseType
        && record.cefrEstimate === bucket.cefrEstimate
      )).toHaveLength(bucket.count);
    }
  });
});
