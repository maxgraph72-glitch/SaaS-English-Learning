export type VocabularyGroup =
  | "unknown"
  | "learning"
  | "weak"
  | "repeat"
  | "known";

export interface VocabularyItem {
  id: string;
  user_id: string;
  english_word: string;
  translation: string;
  source: "manual" | "csv";
  current_group: VocabularyGroup;
  repetition_stage: number;
  learned_at: string | null;
  last_reviewed_at: string | null;
  next_review_date: string | null;
  overdue_stage_decay_pending?: boolean;
  created_at: string;
  updated_at: string;
}

export type DailyBlockStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

export interface DailySession {
  vocabulary_status: DailyBlockStatus;
  speaking_status: DailyBlockStatus;
  writing_status: DailyBlockStatus;
  review_status: DailyBlockStatus;
}
