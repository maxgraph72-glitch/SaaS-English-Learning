import type { VocabularyItem } from "./types";

export const STUDY_SESSION_LIMIT = 10;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CardPhase = "front" | "revealed";
export type StudyShortcut = "reveal" | "again" | "learned";
export type ReviewShortcut = "reveal" | "incorrect" | "correct" | "later";

export interface ShortcutInput {
  key: string;
  phase: CardPhase;
  pending: boolean;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  editableTarget: boolean;
  canRotate?: boolean;
}

function isShortcutBlocked(input: ShortcutInput) {
  return (
    input.pending ||
    input.repeat ||
    input.altKey ||
    input.ctrlKey ||
    input.metaKey ||
    input.shiftKey ||
    input.editableTarget
  );
}

export function resolveStudyShortcut(input: ShortcutInput): StudyShortcut | null {
  if (isShortcutBlocked(input)) return null;

  if (input.phase === "front" && input.key === " ") return "reveal";
  if (input.phase === "revealed" && input.key === "1") return "again";
  if (input.phase === "revealed" && input.key === "2") return "learned";
  return null;
}

export function resolveReviewShortcut(input: ShortcutInput): ReviewShortcut | null {
  if (isShortcutBlocked(input)) return null;

  if (input.key.toLocaleLowerCase("en") === "s" && input.canRotate) return "later";
  if (input.phase === "front" && input.key === " ") return "reveal";
  if (input.phase === "revealed" && input.key === "1") return "incorrect";
  if (input.phase === "revealed" && input.key === "2") return "correct";
  return null;
}

export function parseStudyItemIds(
  input: string | string[] | undefined,
): string[] {
  const values = input === undefined ? [] : Array.isArray(input) ? input : [input];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    for (const rawCandidate of value.split(",")) {
      const candidate = rawCandidate.trim().toLocaleLowerCase("en");
      if (!UUID_PATTERN.test(candidate) || seen.has(candidate)) continue;

      seen.add(candidate);
      result.push(candidate);
      if (result.length === STUDY_SESSION_LIMIT) return result;
    }
  }

  return result;
}

export function isStudyEligible(
  item: Pick<
    VocabularyItem,
    "current_group" | "repetition_stage" | "next_review_date"
  >,
) {
  return (
    item.repetition_stage === 0 &&
    item.next_review_date === null &&
    (item.current_group === "unknown" || item.current_group === "learning")
  );
}

export function restoreSelectionOrder<T extends { id: string }>(
  selectedIds: readonly string[],
  items: readonly T[],
): T[] {
  const byId = new Map(items.map((item) => [item.id.toLocaleLowerCase("en"), item]));
  return selectedIds.flatMap((id) => {
    const item = byId.get(id.toLocaleLowerCase("en"));
    return item ? [item] : [];
  });
}

export function rotateCurrentToEnd<T>(queue: readonly T[]): T[] {
  if (queue.length < 2) return [...queue];
  return [...queue.slice(1), queue[0]];
}

export function completeCurrentAfterConfirmation<T>(
  queue: readonly T[],
  confirmed: boolean,
): T[] {
  return confirmed ? queue.slice(1) : [...queue];
}

export function getQueueProgress(total: number, remaining: number) {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeRemaining = Math.min(safeTotal, Math.max(0, Math.floor(remaining)));
  const completed = safeTotal - safeRemaining;

  return {
    total: safeTotal,
    completed,
    remaining: safeRemaining,
    percent: safeTotal === 0 ? 0 : (completed / safeTotal) * 100,
  };
}
