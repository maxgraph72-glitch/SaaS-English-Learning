export const STAGE_INTERVAL_DAYS = {
  1: 1,
  2: 2,
  3: 3,
  4: 7,
  5: 30,
} as const;

export type RepetitionStage = 1 | 2 | 3 | 4 | 5;
export type ReviewGroup = "learning" | "weak" | "repeat" | "known";

export interface ReviewInput {
  correct: boolean;
  responseTimeMs: number;
  currentStage: RepetitionStage;
  reviewDate: string;
  missedReview?: boolean;
}

export interface ReviewOutcome {
  group: ReviewGroup;
  stage: RepetitionStage;
  nextReviewDate: string;
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function addCalendarDays(calendarDate: string, days: number): string {
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

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function scheduleNewlyLearned(learnedDate: string): ReviewOutcome {
  return {
    group: "learning",
    stage: 1,
    nextReviewDate: addCalendarDays(learnedDate, 1),
  };
}

export function decayMissedStage(currentStage: RepetitionStage): RepetitionStage {
  if (!(currentStage in STAGE_INTERVAL_DAYS)) {
    throw new Error("Repetition stage must be between 1 and 5.");
  }
  return Math.max(currentStage - 1, 1) as RepetitionStage;
}

export function calculateReviewOutcome(input: ReviewInput): ReviewOutcome {
  if (!Number.isInteger(input.responseTimeMs) || input.responseTimeMs < 0) {
    throw new Error("Response time must be a non-negative integer.");
  }
  if (!(input.currentStage in STAGE_INTERVAL_DAYS)) {
    throw new Error("Repetition stage must be between 1 and 5.");
  }

  let group: ReviewGroup;
  let stage: RepetitionStage;
  const effectiveStage = input.missedReview
    ? decayMissedStage(input.currentStage)
    : input.currentStage;

  if (!input.correct) {
    group = "learning";
    stage = 1;
  } else if (input.responseTimeMs < 3000) {
    group = input.missedReview ? "repeat" : "known";
    stage = input.missedReview
      ? effectiveStage
      : (Math.min(effectiveStage + 1, 5) as RepetitionStage);
  } else if (input.responseTimeMs <= 5000) {
    group = "repeat";
    stage = effectiveStage;
  } else if (input.responseTimeMs <= 10000) {
    group = "weak";
    stage = 1;
  } else {
    group = "learning";
    stage = 1;
  }

  return {
    group,
    stage,
    nextReviewDate: addCalendarDays(input.reviewDate, STAGE_INTERVAL_DAYS[stage]),
  };
}
