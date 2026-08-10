"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  setDailyBlockStatusAction,
  submitVocabularyReviewAction,
} from "@/app/actions/vocabulary";
import {
  completeCurrentAfterConfirmation,
  getQueueProgress,
  resolveReviewShortcut,
  rotateCurrentToEnd,
} from "@/lib/vocabulary/study-session";
import type {
  KnowledgeCategory,
  VocabularyItem,
  VocabularyReviewOutcome,
} from "@/lib/vocabulary/types";

interface ReviewResult {
  category: KnowledgeCategory;
  responseTimeMs: number;
  attemptKind: "scheduled" | "practice";
}

type ReviewMode = "scheduled" | "practice";

const categoryLabels: Record<KnowledgeCategory, string> = {
  1: "Known",
  2: "Satisfactory",
  3: "Weak",
  4: "Unknown",
};

function isEditableShortcutTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'input, textarea, select, button, [contenteditable="true"], [role="textbox"]',
      ),
    )
  );
}

function formatDueDate(date: string | null) {
  if (!date) return "Study this word again before another review.";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function applyOutcome(
  item: VocabularyItem,
  outcome: VocabularyReviewOutcome,
): VocabularyItem {
  return {
    ...item,
    learning_state: outcome.requires_relearning ? "learning" : "scheduled",
    knowledge_category: outcome.category_after,
    repetition_stage: outcome.stage_after,
    next_review_date: outcome.next_review_date_after,
    requires_relearning: outcome.requires_relearning,
  };
}

export function ReviewSession({
  initialQueue,
  practiceQueue,
  loadError,
  practiceLoadError,
}: {
  initialQueue: VocabularyItem[];
  practiceQueue: VocabularyItem[];
  loadError: string;
  practiceLoadError: string;
}) {
  const startsWithPractice = initialQueue.length === 0 && practiceQueue.length > 0;
  const [mode, setMode] = useState<ReviewMode>(
    startsWithPractice ? "practice" : "scheduled",
  );
  const [queue, setQueue] = useState(
    startsWithPractice ? practiceQueue : initialQueue,
  );
  const [todayPracticeItems, setTodayPracticeItems] = useState(practiceQueue);
  const [outcome, setOutcome] = useState<VocabularyReviewOutcome | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [frozenResponseTimeMs, setFrozenResponseTimeMs] = useState<number | null>(
    null,
  );
  const [timerReady, setTimerReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(loadError);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [total, setTotal] = useState(
    startsWithPractice ? practiceQueue.length : initialQueue.length,
  );
  const [cardAttempt, setCardAttempt] = useState(0);
  const startedAt = useRef(0);
  const submissionIds = useRef(new Map<string, string>());
  const cardHeading = useRef<HTMLHeadingElement>(null);

  const current = queue[0];
  const progress = getQueueProgress(total, queue.length);

  useEffect(() => {
    if (total > 0) void setDailyBlockStatusAction("review", "in_progress");
  }, [mode, total]);

  useEffect(() => {
    if (total > 0 && queue.length === 0) {
      void setDailyBlockStatusAction("review", "completed");
    }
  }, [queue.length, total]);

  useEffect(() => {
    if (!current || outcome) return;
    const frame = window.requestAnimationFrame(() => {
      startedAt.current = performance.now();
      setTimerReady(true);
      cardHeading.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [cardAttempt, current, outcome]);

  const categoryCounts = useMemo(
    () =>
      results.reduce<Partial<Record<KnowledgeCategory, number>>>(
        (counts, result) => {
          counts[result.category] = (counts[result.category] ?? 0) + 1;
          return counts;
        },
        {},
      ),
    [results],
  );

  const submit = useCallback(async () => {
    if (!current || outcome || pending || !timerReady) return;

    const measuredTime =
      frozenResponseTimeMs ??
      Math.max(0, Math.round(performance.now() - startedAt.current));
    if (frozenResponseTimeMs === null) setFrozenResponseTimeMs(measuredTime);

    let submissionId = submissionIds.current.get(current.id);
    if (!submissionId) {
      submissionId = crypto.randomUUID();
      submissionIds.current.set(current.id, submissionId);
    }

    setPending(true);
    setMessage("");
    let result: Awaited<ReturnType<typeof submitVocabularyReviewAction>>;
    try {
      result = await submitVocabularyReviewAction({
        itemId: current.id,
        responseTimeMs: measuredTime,
        submissionId,
      });
    } catch {
      setPending(false);
      setMessage("The review could not be saved. Try again.");
      return;
    }
    setPending(false);
    if (!result.ok || !result.outcome) {
      setMessage(result.ok ? "The saved result was incomplete." : result.message);
      return;
    }

    const savedOutcome = result.outcome;
    submissionIds.current.delete(current.id);
    setResponseTimeMs(measuredTime);
    setOutcome(savedOutcome);
    setResults((existing) => [
      ...existing,
      {
        category: savedOutcome.category_after,
        responseTimeMs: measuredTime,
        attemptKind: savedOutcome.attempt_kind,
      },
    ]);
    const updatedItem = applyOutcome(current, savedOutcome);
    if (!savedOutcome.requires_relearning) {
      setTodayPracticeItems((existing) => {
        const withoutCurrent = existing.filter((item) => item.id !== current.id);
        return [...withoutCurrent, updatedItem];
      });
    }
    setAnnouncement(
      `${current.english_word} saved as category ${savedOutcome.category_after}.`,
    );
  }, [
    current,
    frozenResponseTimeMs,
    outcome,
    pending,
    timerReady,
  ]);

  const continueToNext = useCallback(() => {
    if (!current || !outcome || pending) return;
    const updatedItem = applyOutcome(current, outcome);
    setQueue((existing) =>
      completeCurrentAfterConfirmation(
        [updatedItem, ...existing.slice(1)],
        true,
      ),
    );
    setOutcome(null);
    setResponseTimeMs(null);
    setFrozenResponseTimeMs(null);
    setTimerReady(false);
    setMessage("");
    setCardAttempt((attempt) => attempt + 1);
    setAnnouncement(`${current.english_word} complete. Moving to the next card.`);
  }, [current, outcome, pending]);

  const repeatToday = useCallback(() => {
    if (!current || !outcome || pending || outcome.requires_relearning) return;
    const updatedItem = applyOutcome(current, outcome);
    setQueue((existing) => [updatedItem, ...existing.slice(1)]);
    setOutcome(null);
    setResponseTimeMs(null);
    setFrozenResponseTimeMs(null);
    setTimerReady(false);
    setMessage("");
    setCardAttempt((attempt) => attempt + 1);
    setAnnouncement(`${current.english_word} is ready for another timed attempt.`);
  }, [current, outcome, pending]);

  const later = useCallback(() => {
    if (
      !current ||
      queue.length < 2 ||
      pending ||
      outcome ||
      frozenResponseTimeMs !== null
    ) {
      return;
    }
    setQueue((existing) => rotateCurrentToEnd(existing));
    setMessage("");
    setTimerReady(false);
    setCardAttempt((attempt) => attempt + 1);
    setAnnouncement(`${current.english_word} moved to the end of this queue.`);
  }, [current, frozenResponseTimeMs, outcome, pending, queue.length]);

  const startPractice = useCallback(() => {
    if (todayPracticeItems.length === 0) return;
    setMode("practice");
    setQueue(todayPracticeItems);
    setTotal(todayPracticeItems.length);
    setResults([]);
    setOutcome(null);
    setResponseTimeMs(null);
    setFrozenResponseTimeMs(null);
    setTimerReady(false);
    setMessage("");
    setCardAttempt((attempt) => attempt + 1);
    setAnnouncement(
      `Same-day practice started with ${todayPracticeItems.length} ${
        todayPracticeItems.length === 1 ? "word" : "words"
      }.`,
    );
  }, [todayPracticeItems]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const action = resolveReviewShortcut({
        key: event.key,
        phase: outcome ? "result" : "front",
        pending,
        repeat: event.repeat,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        editableTarget: isEditableShortcutTarget(event.target),
        canRotate:
          queue.length > 1 &&
          !outcome &&
          frozenResponseTimeMs === null,
      });
      if (!action) return;

      if (action === "submit") {
        event.preventDefault();
        void submit();
      } else if (action === "repeat") {
        repeatToday();
      } else if (action === "continue") {
        continueToNext();
      } else {
        later();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    continueToNext,
    frozenResponseTimeMs,
    later,
    outcome,
    pending,
    queue.length,
    repeatToday,
    submit,
  ]);

  if (loadError) {
    return (
      <div className="page-container">
        <section className="empty-review">
          <h1>Review is unavailable</h1>
          <p>{loadError}</p>
        </section>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="page-container review-page">
        <section className="review-complete">
          <span className="completion-mark" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">
            {mode === "practice" ? "Same-day practice complete" : "Queue complete"}
          </p>
          <h1>
            {results.length > 0
              ? "Nicely done. Every saved attempt is in your history."
              : "Nothing is due right now."}
          </h1>
          <p>
            {results.length > 0
              ? `${results.length} ${
                  results.length === 1 ? "attempt was" : "attempts were"
                } saved. A word advanced at most once today.`
              : todayPracticeItems.length > 0
                ? `${todayPracticeItems.length} ${
                    todayPracticeItems.length === 1 ? "word is" : "words are"
                  } available for optional same-day practice.`
                : "Study a new word or come back on the next scheduled day."}
          </p>
          {results.length > 0 ? (
            <div className="result-groups">
              {([1, 2, 3, 4] as const).map((category) => (
                <div key={category}>
                  <strong>{categoryCounts[category] ?? 0}</strong>
                  <span>Category {category}</span>
                </div>
              ))}
            </div>
          ) : null}
          {practiceLoadError ? (
            <p className="form-message centered" role="status">
              {practiceLoadError}
            </p>
          ) : null}
          <div className="completion-actions">
            {todayPracticeItems.length > 0 ? (
              <button
                className="primary-button compact"
                type="button"
                onClick={startPractice}
              >
                Repeat again today
              </button>
            ) : (
              <Link className="primary-button compact" href="/dashboard">
                Back to today
              </Link>
            )}
            <Link className="secondary-button" href="/vocabulary">
              Open vocabulary
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-container review-page">
      <section className="review-heading">
        <div>
          <p className="eyebrow">
            {mode === "practice" ? "Repeat again today" : "Review queue"}
          </p>
          <h1>Recall the meaning, then reveal the answer.</h1>
          <p>
            The timer starts when the card is ready and stops before the
            translation appears.
          </p>
        </div>
        <div className="queue-count">
          <strong>{progress.remaining}</strong>
          <span>remaining</span>
        </div>
      </section>

      <section className="review-workspace" aria-labelledby="review-card-heading">
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
        <div className="review-progress-line">
          <span>
            Card {progress.completed + 1} of {progress.total}
          </span>
          <span>{Math.round(progress.percent)}%</span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progress.percent}%` }} />
        </div>

        <article className={outcome ? "review-card revealed" : "review-card"}>
          <div className="card-meta">
            <span>Stage {current.repetition_stage} of 6</span>
            <div className="card-meta-actions">
              <span className="group-badge">
                {current.knowledge_category
                  ? `Category ${current.knowledge_category}`
                  : "Not tested"}
              </span>
              <button
                className="later-button"
                type="button"
                onClick={later}
                disabled={
                  queue.length < 2 ||
                  pending ||
                  Boolean(outcome) ||
                  frozenResponseTimeMs !== null
                }
                aria-label={`Review ${current.english_word} later in this session`}
              >
                Later <kbd>S</kbd>
              </button>
            </div>
          </div>
          <p className="eyebrow">English word</p>
          <h2 id="review-card-heading" ref={cardHeading} tabIndex={-1}>
            {current.english_word}
          </h2>

          {!outcome ? (
            <div className="card-primary-action">
              <button
                className="reveal-button"
                type="button"
                onClick={() => void submit()}
                disabled={pending || !timerReady}
              >
                {pending
                  ? "Saving answer…"
                  : frozenResponseTimeMs === null
                    ? "Show translation"
                    : "Try saving again"}{" "}
                <kbd>Space</kbd>
              </button>
              <small className="review-timer-status" role="status">
                {frozenResponseTimeMs === null
                  ? timerReady
                    ? "Recall timer is running."
                    : "Preparing timer…"
                  : `Recall stopped at ${(frozenResponseTimeMs / 1000).toFixed(1)} s.`}
              </small>
            </div>
          ) : (
            <div className="revealed-answer" aria-live="polite">
              <span>Translation</span>
              <strong>{current.translation}</strong>
              <small>
                Recall time: {((responseTimeMs ?? 0) / 1000).toFixed(1)} s
              </small>
              <div className="review-result-details">
                <span>
                  Category {outcome.category_after}:{" "}
                  {categoryLabels[outcome.category_after]}
                </span>
                <span>Current stage: {outcome.stage_after} of 6</span>
                <span>
                  {outcome.requires_relearning
                    ? "This word needs to be studied again."
                    : `Next review: ${formatDueDate(
                        outcome.next_review_date_after,
                      )}`}
                </span>
                {outcome.overdue_action === "rollback" ? (
                  <span>A missed review rolled this word back by one stage.</span>
                ) : null}
              </div>
            </div>
          )}
        </article>

        {outcome ? (
          <div className="review-outcomes">
            {outcome.requires_relearning ? (
              <Link className="incorrect-button" href="/vocabulary">
                <strong>Study again</strong>
                <span>Return to Vocabulary</span>
              </Link>
            ) : (
              <button
                className="incorrect-button"
                type="button"
                disabled={pending}
                onClick={repeatToday}
              >
                <strong>Repeat again today</strong>
                <span>
                  Keep the same schedule <kbd>1</kbd>
                </span>
              </button>
            )}
            <button
              className="correct-button"
              type="button"
              disabled={pending}
              onClick={continueToNext}
            >
              <strong>Continue</strong>
              <span>
                Next card <kbd>2</kbd>
              </span>
            </button>
          </div>
        ) : null}

        {message ? (
          <p className="form-message centered" role="status">
            {message}
          </p>
        ) : null}
        <p className="review-note">
          Your category is calculated on the server from recall time. Extra
          attempts today update the category without moving the stage again.
        </p>
      </section>
    </div>
  );
}
