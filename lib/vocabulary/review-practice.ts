import { calendarDateInTimeZone } from "../learning/calendar";

export function selectLearnedTodayPracticeItems<
  T extends { id: string; learned_at: string | null },
>(
  items: readonly T[],
  today: string,
  timeZone: string,
  excludedItemIds: readonly string[] = [],
): T[] {
  const excluded = new Set(excludedItemIds);

  return items.filter((item) => {
    if (!item.learned_at || excluded.has(item.id)) return false;
    return calendarDateInTimeZone(new Date(item.learned_at), timeZone) === today;
  });
}
