export const WRITING_MISTAKE_CATEGORIES = [
  "grammar",
  "vocabulary",
  "spelling",
  "punctuation",
  "style",
] as const;

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type WritingMistakeCategory = (typeof WRITING_MISTAKE_CATEGORIES)[number];
export type CefrLevel = (typeof CEFR_LEVELS)[number];
export type WritingEntryStatus = "pending" | "processing" | "completed" | "failed";

export interface WritingMistake {
  original: string;
  correction: string;
  category: WritingMistakeCategory;
  explanation: string;
}

export interface WritingFeedbackResult {
  schemaVersion: 1;
  correctedText: string;
  mistakes: WritingMistake[];
  estimatedCefr: CefrLevel;
  cefrRationale: string;
}

export interface WritingEntry {
  id: string;
  user_id: string;
  submission_id: string;
  entry_date: string;
  original_text: string;
  word_count: number;
  feedback_status: WritingEntryStatus;
  active_seconds: number;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface WritingFeedback {
  id: string;
  user_id: string;
  writing_entry_id: string;
  corrected_text: string;
  mistakes: WritingMistake[];
  estimated_cefr: CefrLevel;
  cefr_rationale: string;
  schema_version: 1;
  prompt_version: string;
  provider: string;
  model: string;
  created_at: string;
}

export interface WritingState {
  entry: WritingEntry | null;
  feedback: WritingFeedback | null;
}
