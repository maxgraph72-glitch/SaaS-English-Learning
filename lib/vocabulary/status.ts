import type { VocabularyItem } from "./types";

export type VocabularyProgressStatus = "new" | "learning" | "mastered";
export type VocabularyFilter = "all" | VocabularyProgressStatus | "due";

type ScheduleFields = Pick<
  VocabularyItem,
  "repetition_stage" | "next_review_date"
>;

export function isReviewDue(item: ScheduleFields, today: string) {
  return (
    item.repetition_stage >= 1 &&
    item.next_review_date !== null &&
    item.next_review_date <= today
  );
}

export function getVocabularyProgressStatus(
  item: ScheduleFields,
): VocabularyProgressStatus {
  if (item.repetition_stage === 0 || item.next_review_date === null) return "new";
  if (item.repetition_stage >= 5) return "mastered";
  return "learning";
}

export function matchesVocabularyFilter(
  item: ScheduleFields,
  filter: VocabularyFilter,
  today: string,
) {
  if (filter === "all") return true;
  if (filter === "due") return isReviewDue(item, today);
  return getVocabularyProgressStatus(item) === filter;
}
