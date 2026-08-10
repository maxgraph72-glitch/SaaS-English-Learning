export type KnowledgeCategory = 1 | 2 | 3 | 4;
export type RepetitionStage = 1 | 2 | 3 | 4 | 5 | 6;
export type OverdueAction = "none" | "rollback" | "forgotten";
export type ReviewAttemptKind = "scheduled" | "practice";

export interface ReviewAttemptInput {
  responseTimeMs: number;
  currentStage: RepetitionStage;
  nextReviewDate: string;
  localDate: string;
  lastStageAdvancedDate?: string | null;
  overdueAlreadyProcessed?: boolean;
}

export interface ReviewAttemptOutcome {
  category: KnowledgeCategory;
  stage: RepetitionStage;
  nextReviewDate: string | null;
  attemptKind: ReviewAttemptKind;
  overdueAction: OverdueAction;
  requiresRelearning: boolean;
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseCalendarDate(calendarDate: string): Date {
  const match = CALENDAR_DATE.exec(calendarDate);
  if (!match) throw new Error("Expected a calendar date in YYYY-MM-DD format.");

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error("Invalid calendar date.");
  }

  return date;
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function assertStage(stage: number): asserts stage is RepetitionStage {
  if (!Number.isInteger(stage) || stage < 1 || stage > 6) {
    throw new Error("Repetition stage must be between 1 and 6.");
  }
}

export function addCalendarDays(calendarDate: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error("Calendar days must be an integer.");
  const date = parseCalendarDate(calendarDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatCalendarDate(date);
}

export function addCalendarMonth(calendarDate: string): string {
  const date = parseCalendarDate(calendarDate);
  const originalDay = date.getUTCDate();
  const targetYear =
    date.getUTCFullYear() + (date.getUTCMonth() === 11 ? 1 : 0);
  const targetMonth = (date.getUTCMonth() + 1) % 12;
  const lastTargetDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();

  return formatCalendarDate(
    new Date(Date.UTC(targetYear, targetMonth, Math.min(originalDay, lastTargetDay))),
  );
}

export function classifyResponse(responseTimeMs: number): KnowledgeCategory {
  if (
    !Number.isFinite(responseTimeMs) ||
    !Number.isInteger(responseTimeMs) ||
    responseTimeMs < 0
  ) {
    throw new Error("Response time must be a non-negative integer.");
  }

  if (responseTimeMs <= 1000) return 1;
  if (responseTimeMs <= 3000) return 2;
  if (responseTimeMs <= 5000) return 3;
  return 4;
}

export function advanceStage(currentStage: RepetitionStage): RepetitionStage {
  assertStage(currentStage);
  return Math.min(currentStage + 1, 6) as RepetitionStage;
}

export function calculateNextReviewDate(
  completedStage: RepetitionStage,
  localDate: string,
): string {
  assertStage(completedStage);
  parseCalendarDate(localDate);

  if (completedStage === 1) return addCalendarDays(localDate, 1);
  if (completedStage === 2) return addCalendarDays(localDate, 3);
  if (completedStage === 3) return addCalendarDays(localDate, 7);
  if (completedStage === 4) return addCalendarDays(localDate, 14);
  return addCalendarMonth(localDate);
}

export function calculateOverdueAction(
  stage: RepetitionStage,
  dueDate: string,
  localDate: string,
): OverdueAction {
  assertStage(stage);
  const due = parseCalendarDate(dueDate);
  const local = parseCalendarDate(localDate);
  const overdueDays = Math.floor((local.getTime() - due.getTime()) / 86_400_000);

  if (overdueDays < 1) return "none";
  if (overdueDays < 7) return "rollback";
  return "forgotten";
}

export function rollbackStage(currentStage: RepetitionStage): RepetitionStage {
  assertStage(currentStage);
  return Math.max(currentStage - 1, 1) as RepetitionStage;
}

export function scheduleNewlyLearned(localDate: string) {
  parseCalendarDate(localDate);
  return {
    learningState: "learning" as const,
    category: null,
    stage: 1 as const,
    nextReviewDate: localDate,
  };
}

export function calculateReviewAttempt(
  input: ReviewAttemptInput,
): ReviewAttemptOutcome {
  assertStage(input.currentStage);
  const category = classifyResponse(input.responseTimeMs);
  parseCalendarDate(input.nextReviewDate);
  parseCalendarDate(input.localDate);

  if (input.lastStageAdvancedDate === input.localDate) {
    return {
      category,
      stage: input.currentStage,
      nextReviewDate: input.nextReviewDate,
      attemptKind: "practice",
      overdueAction: "none",
      requiresRelearning: false,
    };
  }

  if (input.nextReviewDate > input.localDate) {
    throw new Error("Vocabulary item is not due yet.");
  }

  const overdueAction = calculateOverdueAction(
    input.currentStage,
    input.nextReviewDate,
    input.localDate,
  );
  if (overdueAction === "forgotten") {
    return {
      category: 4,
      stage: 1,
      nextReviewDate: null,
      attemptKind: "scheduled",
      overdueAction,
      requiresRelearning: true,
    };
  }

  const completedStage =
    overdueAction === "rollback" && !input.overdueAlreadyProcessed
      ? rollbackStage(input.currentStage)
      : input.currentStage;

  return {
    category,
    stage: advanceStage(completedStage),
    nextReviewDate: calculateNextReviewDate(completedStage, input.localDate),
    attemptKind: "scheduled",
    overdueAction,
    requiresRelearning: false,
  };
}
