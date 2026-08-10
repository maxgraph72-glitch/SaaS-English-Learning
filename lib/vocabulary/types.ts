export type VocabularyGroup =
  | "unknown"
  | "learning"
  | "weak"
  | "repeat"
  | "known";

export type VocabularyLearningState = "new" | "learning" | "scheduled";
export type KnowledgeCategory = 1 | 2 | 3 | 4;
export type VocabularyAttemptKind = "scheduled" | "practice";
export type VocabularyOverdueAction = "none" | "rollback" | "forgotten";

export const VOCABULARY_ITEM_SELECT =
  "id,user_id,english_word,translation,source,current_group,learning_state,knowledge_category,repetition_stage,learned_at,last_reviewed_at,last_attempt_at,last_stage_advanced_date,next_review_date,requires_relearning,overdue_processed_for_date,overdue_stage_decay_pending,created_at,updated_at";

export interface VocabularyItem {
  id: string;
  user_id: string;
  english_word: string;
  translation: string;
  source: "manual" | "csv";
  current_group: VocabularyGroup;
  learning_state: VocabularyLearningState;
  knowledge_category: KnowledgeCategory | null;
  repetition_stage: number;
  learned_at: string | null;
  last_reviewed_at: string | null;
  last_attempt_at: string | null;
  last_stage_advanced_date: string | null;
  next_review_date: string | null;
  requires_relearning: boolean;
  overdue_processed_for_date: string | null;
  overdue_stage_decay_pending: boolean;
  created_at: string;
  updated_at: string;
}

export interface VocabularyReviewOutcome {
  review_id: string;
  vocabulary_item_id: string;
  category_after: KnowledgeCategory;
  stage_after: number;
  next_review_date_after: string | null;
  attempt_kind: VocabularyAttemptKind;
  overdue_action: VocabularyOverdueAction;
  requires_relearning: boolean;
  duplicate: boolean;
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
