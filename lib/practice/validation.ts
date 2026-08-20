import type {
  PracticeReviewRecord,
  PracticeSourceManifest,
  SentenceCandidate,
} from "./types";
import { normalizePracticeAnswer } from "./answer-normalization.ts";

export const PRACTICE_REJECTION_REASONS = [
  "ambiguous_answer",
  "incorrect_grammar",
  "missing_context",
  "unsafe_content",
  "personal_data",
  "duplicate",
  "unnatural_english",
  "level_mismatch",
  "license_unclear",
] as const;

const UNSAFE_PATTERNS = [
  /https?:\/\//iu,
  /\bwww\./iu,
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/iu,
  /\+?\d[\d\s().-]{7,}\d/u,
  /\b(?:kill|murder|porn|nude|racial slur)\b/iu,
];

export function validateSourceManifest(manifest: PracticeSourceManifest): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== 1) errors.push("Unsupported manifest schema version.");
  if (manifest.licenseCode !== "CC0-1.0") errors.push("Package 1 accepts only CC0-1.0 manifests.");
  if (!/^[0-9a-f]{64}$/u.test(manifest.archiveSha256)) errors.push("Manifest SHA-256 is invalid.");
  for (const value of [
    manifest.sourceSlug,
    manifest.sourceName,
    manifest.homepageUrl,
    manifest.licenseUrl,
    manifest.sourceRelease,
    manifest.downloadedAt,
    manifest.importerVersion,
    manifest.attribution,
  ]) {
    if (!value.trim()) errors.push("Manifest contains an empty required field.");
  }
  if (manifest.fixture && !manifest.fixtureNotice?.trim()) {
    errors.push("Fixture manifests must explicitly say they are not corpus releases.");
  }
  return errors;
}

export function screenSentenceCandidate(candidate: SentenceCandidate): string[] {
  const reasons: string[] = [];
  const tokenCount = candidate.normalizedText.match(/[\p{L}\p{N}']+/gu)?.length ?? 0;
  if (tokenCount < 4 || tokenCount > 16) reasons.push("missing_context");
  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(candidate.normalizedText))) {
    reasons.push("unsafe_content");
  }
  if (/^["']|["']$/u.test(candidate.normalizedText)) reasons.push("missing_context");
  if (!/[.!?]$/u.test(candidate.normalizedText)) reasons.push("incorrect_grammar");
  if (candidate.source.licenseCode !== "CC0-1.0") reasons.push("license_unclear");
  return [...new Set(reasons)];
}

export function validateReviewRecord(record: PracticeReviewRecord): string[] {
  const errors: string[] = [];
  if (record.schemaVersion !== 1) errors.push("Unsupported review schema version.");
  if (record.packageVersion !== "present-tenses-package-1") errors.push("Unexpected package version.");
  if (!record.source.externalId.trim()) errors.push("Source external ID is required.");
  if (!record.source.release.trim()) errors.push("Source release is required.");
  if (record.source.licenseCode !== "CC0-1.0") errors.push("Review record is not CC0-1.0.");
  if (!/^[0-9a-f]{64}$/u.test(record.source.archiveSha256)) errors.push("Source checksum is invalid.");
  if (!/^[0-9a-f]{64}$/u.test(record.normalizedHash)) errors.push("Normalized hash is invalid.");
  if ((record.prompt.match(/___/gu) ?? []).length !== 1) errors.push("Prompt must contain exactly one blank.");
  if (!record.lemma.trim()) errors.push("Lemma is required.");
  if (record.acceptedAnswers.length === 0 || record.acceptedAnswers.some((answer) => !answer.trim())) {
    errors.push("Accepted answers must contain non-empty strings.");
  }
  if (record.acceptedAnswers.some((answer) => answer !== normalizePracticeAnswer(answer))) {
    errors.push("Accepted answers must already be normalized.");
  }
  if (!Array.isArray(record.warnings)) errors.push("Warnings must be an array.");
  if (
    record.reviewerDecision !== null
    && !new Set(["approve", "edit_and_approve", "reject", "needs_legal_review"]).has(
      record.reviewerDecision,
    )
  ) {
    errors.push("Reviewer decision is invalid.");
  }
  if (!record.explanation.trim()) errors.push("Explanation is required.");
  if (record.reviewerDecision && (!record.reviewedBy || !record.reviewedAt)) {
    errors.push("A reviewer decision requires reviewer identity and timestamp.");
  }
  if (!record.reviewerDecision && (record.reviewedBy || record.reviewedAt)) {
    errors.push("Pending records cannot contain reviewer metadata.");
  }
  if (
    (record.reviewerDecision === "reject" || record.reviewerDecision === "needs_legal_review")
    && !record.rejectionReason
  ) {
    errors.push("Rejected or quarantined records require a rejection reason.");
  }
  return errors;
}
