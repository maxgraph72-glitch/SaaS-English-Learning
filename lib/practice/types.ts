export type PracticeGrammarTopic =
  | "present_simple"
  | "present_continuous"
  | "present_simple_vs_continuous";

export type PracticeExerciseType =
  | "affirmative"
  | "negative"
  | "question"
  | "tense_contrast";

export type PracticeCefr = "A1" | "A2" | "B1";

export interface PracticeSourceManifest {
  schemaVersion: 1;
  sourceSlug: string;
  sourceName: string;
  homepageUrl: string;
  licenseCode: "CC0-1.0";
  licenseUrl: string;
  termsUrl?: string;
  sourceRelease: string;
  downloadedAt: string;
  archiveSha256: string;
  importerVersion: string;
  attribution: string;
  fixture: boolean;
  fixtureNotice?: string;
}

export interface SentenceCandidate {
  externalId: string;
  language: "en";
  originalText: string;
  normalizedText: string;
  normalizedHash: string;
  source: PracticeSourceManifest;
  sourceUrl?: string;
  sourceCreator?: string;
}

export interface GeneratedExercise {
  exerciseType: PracticeExerciseType;
  grammarTopic: PracticeGrammarTopic;
  cefrEstimate: PracticeCefr;
  prompt: string;
  hint: string;
  lemma: string;
  acceptedAnswers: string[];
  distractors: string[];
  explanation: string;
  transformation: Record<string, string | boolean | number>;
  analysis: Record<string, string | boolean | number>;
  warnings: string[];
}

export type ReviewDecision =
  | "approve"
  | "edit_and_approve"
  | "reject"
  | "needs_legal_review";

export interface PracticeReviewRecord extends GeneratedExercise {
  schemaVersion: 1;
  packageVersion: "present-tenses-package-1";
  source: {
    slug: string;
    name: string;
    release: string;
    downloadedAt: string;
    externalId: string;
    homepageUrl: string;
    termsUrl?: string;
    sourceUrl?: string;
    creator?: string;
    licenseCode: "CC0-1.0";
    licenseUrl: string;
    attribution: string;
    archiveSha256: string;
    importerVersion: string;
    fixture: boolean;
    fixtureNotice?: string;
  };
  originalSentence: string;
  normalizedSentence: string;
  normalizedHash: string;
  reviewerDecision: ReviewDecision | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  rejectionReason: string | null;
}

export interface PracticeExercise {
  id: string;
  content_version: number;
  exercise_type: PracticeExerciseType;
  grammar_topic: PracticeGrammarTopic;
  cefr_estimate: PracticeCefr;
  prompt: string;
  hint: string | null;
  lemma: string | null;
  accepted_answers: string[];
  distractors: string[];
  explanation: string | null;
  license_code: string;
  source_credit: string;
}

export interface PracticeAttemptOutcome {
  attempt_id: string;
  exercise_id: string;
  is_correct: boolean;
  duplicate: boolean;
  correct_answer: string;
  explanation: string | null;
}
