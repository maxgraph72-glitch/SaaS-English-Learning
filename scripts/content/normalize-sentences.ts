import type { SentenceCandidate } from "../../lib/practice/types.ts";

export interface CandidateNormalizationResult {
  accepted: SentenceCandidate[];
  duplicates: SentenceCandidate[];
}

export function deduplicateCandidates(
  candidates: readonly SentenceCandidate[],
): CandidateNormalizationResult {
  const hashes = new Set<string>();
  const accepted: SentenceCandidate[] = [];
  const duplicates: SentenceCandidate[] = [];
  for (const candidate of candidates) {
    if (hashes.has(candidate.normalizedHash)) duplicates.push(candidate);
    else {
      hashes.add(candidate.normalizedHash);
      accepted.push(candidate);
    }
  }
  return { accepted, duplicates };
}
