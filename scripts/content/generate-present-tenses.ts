import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePresentTenseExercise } from "../../lib/practice/present-tenses.ts";
import type {
  PracticeReviewRecord,
  PracticeSourceManifest,
  SentenceCandidate,
} from "../../lib/practice/types.ts";
import { screenSentenceCandidate } from "../../lib/practice/validation.ts";
import { importCommonVoiceFile } from "./import-common-voice.ts";
import { importTatoebaCc0File } from "./import-tatoeba-cc0.ts";
import { deduplicateCandidates } from "./normalize-sentences.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readManifest(path: string): PracticeSourceManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PracticeSourceManifest;
}

export function buildReviewRecords(candidates: readonly SentenceCandidate[]): PracticeReviewRecord[] {
  const { accepted } = deduplicateCandidates(candidates);
  const records: PracticeReviewRecord[] = [];
  for (const candidate of accepted) {
    const rejectionReasons = screenSentenceCandidate(candidate);
    if (rejectionReasons.length > 0) continue;
    const exercise = generatePresentTenseExercise(candidate.normalizedText);
    if (!exercise) continue;
    records.push({
      schemaVersion: 1,
      packageVersion: "present-tenses-package-1",
      ...exercise,
      source: {
        slug: candidate.source.sourceSlug,
        name: candidate.source.sourceName,
        release: candidate.source.sourceRelease,
        downloadedAt: candidate.source.downloadedAt,
        externalId: candidate.externalId,
        homepageUrl: candidate.source.homepageUrl,
        termsUrl: candidate.source.termsUrl,
        sourceUrl: candidate.sourceUrl,
        creator: candidate.sourceCreator,
        licenseCode: candidate.source.licenseCode,
        licenseUrl: candidate.source.licenseUrl,
        attribution: candidate.source.attribution,
        archiveSha256: candidate.source.archiveSha256,
        importerVersion: candidate.source.importerVersion,
        fixture: candidate.source.fixture,
        fixtureNotice: candidate.source.fixtureNotice,
      },
      originalSentence: candidate.originalText,
      normalizedSentence: candidate.normalizedText,
      normalizedHash: candidate.normalizedHash,
      reviewerDecision: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      rejectionReason: null,
    });
  }
  return records;
}

export function generateFixtureReviewPackage(outputPath = resolve(
  projectRoot,
  "content/review/present-tenses-package-1.jsonl",
)): PracticeReviewRecord[] {
  const commonVoiceManifest = readManifest(resolve(projectRoot, "content/manifests/common-voice-fixture-2026-08-20.json"));
  const tatoebaManifest = readManifest(resolve(projectRoot, "content/manifests/tatoeba-cc0-fixture-2026-08-20.json"));
  const candidates = [
    ...importCommonVoiceFile(
      resolve(projectRoot, "tests/fixtures/practice/common-voice-validated.tsv"),
      commonVoiceManifest,
    ),
    ...importTatoebaCc0File(
      resolve(projectRoot, "tests/fixtures/practice/tatoeba-cc0.tsv"),
      tatoebaManifest,
    ),
  ];
  const records = buildReviewRecords(candidates);
  writeReviewPackage(outputPath, records);
  return records;
}

export function generateReviewPackage(input: {
  commonVoicePath?: string;
  commonVoiceManifestPath?: string;
  tatoebaPath?: string;
  tatoebaManifestPath?: string;
  outputPath: string;
}): PracticeReviewRecord[] {
  const candidates: SentenceCandidate[] = [];
  if (input.commonVoicePath && input.commonVoiceManifestPath) {
    candidates.push(
      ...importCommonVoiceFile(input.commonVoicePath, readManifest(input.commonVoiceManifestPath)),
    );
  }
  if (input.tatoebaPath && input.tatoebaManifestPath) {
    candidates.push(
      ...importTatoebaCc0File(input.tatoebaPath, readManifest(input.tatoebaManifestPath)),
    );
  }
  if (candidates.length === 0) {
    throw new Error("Real generation requires at least one corpus and pinned manifest pair.");
  }
  const records = buildReviewRecords(candidates);
  writeReviewPackage(input.outputPath, records);
  return records;
}

function writeReviewPackage(outputPath: string, records: readonly PracticeReviewRecord[]): void {
  if (existsSync(outputPath)) {
    const existing = readFileSync(outputPath, "utf8");
    if (/"reviewerDecision":"(?:approve|edit_and_approve|reject|needs_legal_review)"/u.test(existing)) {
      throw new Error("Refusing to overwrite a package that already contains human review decisions.");
    }
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

function flagValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? resolve(projectRoot, process.argv[index + 1]) : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commonVoicePath = flagValue("--common-voice");
  const commonVoiceManifestPath = flagValue("--common-voice-manifest");
  const tatoebaPath = flagValue("--tatoeba");
  const tatoebaManifestPath = flagValue("--tatoeba-manifest");
  const outputPath = flagValue("--output")
    ?? resolve(projectRoot, "content/review/present-tenses-package-1.jsonl");
  if (Boolean(commonVoicePath) !== Boolean(commonVoiceManifestPath)) {
    throw new Error("Common Voice generation requires both corpus and manifest paths.");
  }
  if (Boolean(tatoebaPath) !== Boolean(tatoebaManifestPath)) {
    throw new Error("Tatoeba generation requires both corpus and manifest paths.");
  }
  const hasRealSource = Boolean(commonVoicePath || tatoebaPath);
  const records = hasRealSource
    ? generateReviewPackage({
        commonVoicePath: commonVoicePath ?? undefined,
        commonVoiceManifestPath: commonVoiceManifestPath ?? undefined,
        tatoebaPath: tatoebaPath ?? undefined,
        tatoebaManifestPath: tatoebaManifestPath ?? undefined,
        outputPath,
      })
    : generateFixtureReviewPackage(outputPath);
  const fixture = records.every((record) => record.source.fixture);
  process.stdout.write(`Generated ${records.length} pending ${fixture ? "fixture " : ""}review records.\n`);
}
