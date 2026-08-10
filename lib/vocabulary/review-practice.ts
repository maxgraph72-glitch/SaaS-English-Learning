export function selectSameDayPracticeItems<
  T extends {
    id: string;
    last_stage_advanced_date: string | null;
    next_review_date: string | null;
    requires_relearning: boolean;
  },
>(
  items: readonly T[],
  today: string,
  excludedItemIds: readonly string[] = [],
): T[] {
  const excluded = new Set(excludedItemIds);

  return items.filter(
    (item) =>
      item.last_stage_advanced_date === today &&
      item.next_review_date !== null &&
      !item.requires_relearning &&
      !excluded.has(item.id),
  );
}
