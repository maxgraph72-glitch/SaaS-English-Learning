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
import type { VocabularyGroup, VocabularyItem } from "@/lib/vocabulary/types";

interface ReviewResult {
  group: VocabularyGroup;
  responseTimeMs: number;
  correct: boolean;
}

type ReviewMode = "scheduled" | "practice";

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

export function ReviewSession({
  initialQueue,
  learnedTodayQueue,
  loadError,
  practiceLoadError,
}: {
  initialQueue: VocabularyItem[];
  learnedTodayQueue: VocabularyItem[];
  loadError: string;
  practiceLoadError: string;
}) {
  const startsWithPractice = initialQueue.length === 0 && learnedTodayQueue.length > 0;
  const [mode, setMode] = useState<ReviewMode>(
    startsWithPractice ? "practice" : "scheduled",
  );
  const [queue, setQueue] = useState(
    startsWithPractice ? learnedTodayQueue : initialQueue,
  );
  const [revealed, setRevealed] = useState(false);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(loadError);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [total, setTotal] = useState(
    startsWithPractice ? learnedTodayQueue.length : initialQueue.length,
  );
  const [practiceStarted, setPracticeStarted] = useState(startsWithPractice);
  const [practiceAgainAttempts, setPracticeAgainAttempts] = useState(0);
  const [practiceRemembered, setPracticeRemembered] = useState(0);
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
    if (mode === "practice" && practiceStarted && total > 0 && queue.length === 0) {
      void setDailyBlockStatusAction("review", "completed");
    }
  }, [mode, practiceStarted, queue.length, total]);

  useEffect(() => {
    if (!current) return;
    startedAt.current = performance.now();
    const frame = window.requestAnimationFrame(() => {
      cardHeading.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [cardAttempt, current]);

  const groupCounts = useMemo(
    () =>
      results.reduce<Partial<Record<VocabularyGroup, number>>>((counts, result) => {
        counts[result.group] = (counts[result.group] ?? 0) + 1;
        return counts;
      }, {}),
    [results],
  );

  const reveal = useCallback(() => {
    if (!current || revealed || pending) return;
    setResponseTimeMs(Math.max(0, Math.round(performance.now() - startedAt.current)));
    setRevealed(true);
    setAnnouncement(`Translation revealed for ${current.english_word}.`);
  }, [current, pending, revealed]);

  const startPractice = useCallback(() => {
    if (learnedTodayQueue.length === 0) return;
    setMode("practice");
    setQueue(learnedTodayQueue);
    setTotal(learnedTodayQueue.length);
    setPracticeStarted(true);
    setPracticeAgainAttempts(0);
    setPracticeRemembered(0);
    setRevealed(false);
    setResponseTimeMs(null);
    setMessage("");
    setCardAttempt((attempt) => attempt + 1);
    setAnnouncement(
      `Practice started with ${learnedTodayQueue.length} ${learnedTodayQueue.length === 1 ? "word" : "words"} learned today.`,
    );
  }, [learnedTodayQueue]);

  const later = useCallback(() => {
    if (!current || queue.length < 2 || pending) return;
    const nextQueue = rotateCurrentToEnd(queue);
    setQueue(nextQueue);
    setRevealed(false);
    setResponseTimeMs(null);
    setMessage("");
    setAnnouncement(`${current.english_word} moved to the end of this queue.`);
  }, [current, pending, queue]);

  const practiceAgain = useCallback(() => {
    if (mode !== "practice" || !current || !revealed || pending) return;
    setQueue((existing) => rotateCurrentToEnd(existing));
    setPracticeAgainAttempts((attempts) => attempts + 1);
    setRevealed(false);
    setResponseTimeMs(null);
    setMessage("");
    setCardAttempt((attempt) => attempt + 1);
    setAnnouncement(`${current.english_word} will appear again in this practice.`);
  }, [current, mode, pending, revealed]);

  const rememberPracticeWord = useCallback(() => {
    if (mode !== "practice" || !current || !revealed || pending) return;
    setQueue((existing) => completeCurrentAfterConfirmation(existing, true));
    setPracticeRemembered((remembered) => remembered + 1);
    setRevealed(false);
    setResponseTimeMs(null);
    setMessage("");
    setAnnouncement(`${current.english_word} completed for today's practice.`);
  }, [current, mode, pending, revealed]);

  const submit = useCallback(async (correct: boolean) => {
    if (
      mode !== "scheduled" ||
      !current ||
      responseTimeMs === null ||
      !revealed ||
      pending
    ) return;
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
        correct,
        responseTimeMs,
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

    submissionIds.current.delete(current.id);
    setResults((existing) => [
      ...existing,
      {
        group: result.outcome.group_after as VocabularyGroup,
        responseTimeMs,
        correct,
      },
    ]);
    setQueue((existing) => completeCurrentAfterConfirmation(existing, true));
    setRevealed(false);
    setResponseTimeMs(null);
    setAnnouncement(`${current.english_word} review saved.`);
  }, [current, mode, pending, responseTimeMs, revealed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const action = resolveReviewShortcut({
        key: event.key,
        phase: revealed ? "revealed" : "front",
        pending,
        repeat: event.repeat,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        editableTarget: isEditableShortcutTarget(event.target),
        canRotate: queue.length > 1,
      });
      if (!action) return;

      if (action === "reveal") {
        event.preventDefault();
        reveal();
      } else if (action === "incorrect") {
        if (mode === "practice") practiceAgain();
        else void submit(false);
      } else if (action === "correct") {
        if (mode === "practice") rememberPracticeWord();
        else void submit(true);
      } else {
        later();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    later,
    mode,
    pending,
    practiceAgain,
    queue.length,
    rememberPracticeWord,
    reveal,
    revealed,
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
            {mode === "practice" ? "Today's practice complete" : "Queue complete"}
          </p>
          <h1>
            {mode === "practice"
              ? "Today's words are reinforced."
              : results.length > 0
              ? "Nicely done. Your schedule is up to date."
              : "Nothing is due right now."}
          </h1>
          <p>
            {mode === "practice"
              ? `${practiceRemembered} ${practiceRemembered === 1 ? "word" : "words"} practiced without changing tomorrow's schedule. You used Again ${practiceAgainAttempts} ${practiceAgainAttempts === 1 ? "time" : "times"}.`
              : results.length > 0
              ? `${results.length} ${results.length === 1 ? "word" : "words"} reviewed. New dates were scheduled from today.`
              : learnedTodayQueue.length > 0
                ? `${learnedTodayQueue.length} ${learnedTodayQueue.length === 1 ? "word learned" : "words learned"} today are ready for extra practice.`
                : "Learn a new word or come back on the next scheduled day."}
          </p>
          {mode === "scheduled" && results.length > 0 ? (
            <div className="result-groups">
              {(["known", "repeat", "weak", "learning"] as const).map((group) => (
                <div key={group}>
                  <strong>{groupCounts[group] ?? 0}</strong>
                  <span>{group}</span>
                </div>
              ))}
            </div>
          ) : null}
          {mode === "scheduled" && practiceLoadError ? (
            <p className="form-message centered" role="status">
              {practiceLoadError}
            </p>
          ) : null}
          <div className="completion-actions">
            {mode === "scheduled" && learnedTodayQueue.length > 0 ? (
              <button
                className="primary-button compact"
                type="button"
                onClick={startPractice}
              >
                {"Practice today's words"}
              </button>
            ) : (
              <Link className="primary-button compact" href="/">
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
            {mode === "practice" ? "Today's practice" : "Review queue"}
          </p>
          <h1>
            {mode === "practice"
              ? "Reinforce the words you learned today."
              : "Recall first. Reveal second."}
          </h1>
          <p>
            {mode === "practice"
              ? "Use Again until each fresh word feels familiar."
              : "The timer stops as soon as you reveal the translation."}
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
        <article className={revealed ? "review-card revealed" : "review-card"}>
          <div className="card-meta">
            <span>
              {mode === "practice" ? "Learned today" : `Stage ${current.repetition_stage}`}
            </span>
            <div className="card-meta-actions">
              <span className={`group-badge ${current.current_group}`}>
                {current.current_group}
              </span>
              <button
                className="later-button"
                type="button"
                onClick={later}
                disabled={queue.length < 2 || pending}
                aria-label={`${mode === "practice" ? "Practice" : "Review"} ${current.english_word} later in this session`}
              >
                Later <kbd>S</kbd>
              </button>
            </div>
          </div>
          <p className="eyebrow">English word</p>
          <h2 id="review-card-heading" ref={cardHeading} tabIndex={-1}>
            {current.english_word}
          </h2>
          {!revealed ? (
            <button className="reveal-button" type="button" onClick={reveal}>
              Reveal translation <kbd>Space</kbd>
            </button>
          ) : (
            <div className="revealed-answer" aria-live="polite">
              <span>Translation</span>
              <strong>{current.translation}</strong>
              <small>Recall time: {((responseTimeMs ?? 0) / 1000).toFixed(1)} s</small>
            </div>
          )}
        </article>
        <div className="review-outcomes" aria-hidden={!revealed}>
          <button
            className="incorrect-button"
            type="button"
            disabled={!revealed || pending}
            onClick={mode === "practice" ? practiceAgain : () => void submit(false)}
          >
            <strong>{mode === "practice" ? "Again" : "Incorrect"}</strong>
            <span>
              {mode === "practice" ? "Return to this word" : "Reset to tomorrow"}{" "}
              <kbd>1</kbd>
            </span>
          </button>
          <button
            className="correct-button"
            type="button"
            disabled={!revealed || pending}
            onClick={
              mode === "practice" ? rememberPracticeWord : () => void submit(true)
            }
          >
            <strong>{mode === "practice" ? "Remembered" : "Correct"}</strong>
            <span>
              {mode === "practice" ? "Complete this card" : "Use recall time"}{" "}
              <kbd>2</kbd>
            </span>
          </button>
        </div>
        {message ? (
          <p className="form-message centered" role="status">
            {message}
          </p>
        ) : null}
        <p className="review-note">
          {mode === "practice"
            ? "This extra practice does not change the first review already scheduled for tomorrow."
            : "Correctness has priority over time. Reading the revealed answer is never timed."}
        </p>
      </section>
    </div>
  );
}
