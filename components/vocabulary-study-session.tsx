"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  markVocabularyLearnedAction,
  startVocabularyLearningAction,
} from "@/app/actions/vocabulary";
import {
  completeCurrentAfterConfirmation,
  getQueueProgress,
  resolveStudyShortcut,
  rotateCurrentToEnd,
} from "@/lib/vocabulary/study-session";
import type { VocabularyItem } from "@/lib/vocabulary/types";

type StartStatus = "ready" | "starting" | "error";

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

export function VocabularyStudySession({
  initialQueue,
  loadError,
}: {
  initialQueue: VocabularyItem[];
  loadError: string;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [startStatus, setStartStatus] = useState<StartStatus>(
    initialQueue[0]?.current_group === "unknown" ? "starting" : "ready",
  );
  const [message, setMessage] = useState(loadError);
  const [againAttempts, setAgainAttempts] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const submissionIds = useRef(new Map<string, string>());
  const startingItemIds = useRef(new Set<string>());
  const cardHeading = useRef<HTMLHeadingElement>(null);

  const total = initialQueue.length;
  const current = queue[0];
  const progress = getQueueProgress(total, queue.length);

  const startWord = useCallback(async (itemId: string) => {
    if (startingItemIds.current.has(itemId)) return;
    startingItemIds.current.add(itemId);
    setPending(true);
    setStartStatus("starting");
    setMessage("");

    let result: Awaited<ReturnType<typeof startVocabularyLearningAction>>;
    try {
      result = await startVocabularyLearningAction(itemId);
    } catch {
      startingItemIds.current.delete(itemId);
      setPending(false);
      setStartStatus("error");
      setMessage("This word could not be opened. Try again when you are ready.");
      return;
    }
    setPending(false);
    if (!result.ok) {
      startingItemIds.current.delete(itemId);
      setStartStatus("error");
      setMessage(`${result.message} Try again when you are ready.`);
      return;
    }

    setQueue((existing) =>
      existing.map((item) =>
        item.id === itemId ? { ...item, current_group: "learning" } : item,
      ),
    );
    setStartStatus("ready");
    setAnnouncement("The word is ready to study.");
  }, []);

  useEffect(() => {
    if (!current) return;
    const frame = window.requestAnimationFrame(() => {
      if (current.current_group === "unknown") void startWord(current.id);
      cardHeading.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current, startWord]);

  const reveal = useCallback(() => {
    if (!current || revealed || pending || startStatus !== "ready") return;
    setRevealed(true);
    setAnnouncement(`Translation revealed for ${current.english_word}.`);
  }, [current, pending, revealed, startStatus]);

  const again = useCallback(() => {
    if (!current || !revealed || pending || startStatus !== "ready") return;
    const nextQueue = rotateCurrentToEnd(queue);
    const next = nextQueue[0];

    setQueue(nextQueue);
    setAgainAttempts((count) => count + 1);
    setRevealed(false);
    setMessage("");
    setStartStatus(next?.current_group === "unknown" ? "starting" : "ready");
    setAnnouncement(`${current.english_word} moved to the end of this session.`);

    if (next?.id === current.id) {
      window.requestAnimationFrame(() => cardHeading.current?.focus({ preventScroll: true }));
    }
  }, [current, pending, queue, revealed, startStatus]);

  const learned = useCallback(async () => {
    if (!current || !revealed || pending || startStatus !== "ready") return;
    let submissionId = submissionIds.current.get(current.id);
    if (!submissionId) {
      submissionId = crypto.randomUUID();
      submissionIds.current.set(current.id, submissionId);
    }

    setPending(true);
    setMessage("");
    let result: Awaited<ReturnType<typeof markVocabularyLearnedAction>>;
    try {
      result = await markVocabularyLearnedAction(current.id, submissionId);
    } catch {
      setPending(false);
      setMessage("The review date could not be saved. Try again.");
      return;
    }
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    submissionIds.current.delete(current.id);
    const nextQueue = completeCurrentAfterConfirmation(queue, true);
    const next = nextQueue[0];
    setQueue(nextQueue);
    setRevealed(false);
    setStartStatus(next?.current_group === "unknown" ? "starting" : "ready");
    setAnnouncement(`${current.english_word} learned. Its first review is tomorrow.`);
  }, [current, pending, queue, revealed, startStatus]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const action = resolveStudyShortcut({
        key: event.key,
        phase: revealed ? "revealed" : "front",
        pending: pending || startStatus !== "ready",
        repeat: event.repeat,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        editableTarget: isEditableShortcutTarget(event.target),
      });
      if (!action) return;

      if (action === "reveal") {
        event.preventDefault();
        reveal();
      } else if (action === "again") {
        again();
      } else {
        void learned();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [again, learned, pending, reveal, revealed, startStatus]);

  if (loadError) {
    return (
      <div className="page-container review-page">
        <section className="empty-review">
          <h1>Study is unavailable</h1>
          <p>{loadError}</p>
          <div className="completion-actions">
            <Link className="primary-button compact" href="/vocabulary">
              Back to vocabulary
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="page-container review-page">
        <section className="empty-review">
          <p className="eyebrow">Study session</p>
          <h1>No selected words are available.</h1>
          <p>They may already be scheduled, or the selection link may no longer be current.</p>
          <div className="completion-actions">
            <Link className="primary-button compact" href="/vocabulary">
              Back to vocabulary
            </Link>
          </div>
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
          <p className="eyebrow">Study complete</p>
          <h1>You learned {total} {total === 1 ? "word" : "words"}.</h1>
          <p>
            Your first {total === 1 ? "review is" : "reviews are"} scheduled for tomorrow.
            You used Again {againAttempts} {againAttempts === 1 ? "time" : "times"}.
          </p>
          <div className="completion-actions">
            <Link className="primary-button compact" href="/vocabulary">
              Back to vocabulary
            </Link>
            <Link className="secondary-button" href="/dashboard">
              Back to today
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-container review-page study-session-page">
      <section className="review-heading">
        <div>
          <p className="eyebrow">Vocabulary study</p>
          <h1>Learn the words you chose.</h1>
          <p>Reveal each translation, then decide whether to repeat or schedule the word.</p>
        </div>
        <Link className="secondary-button" href="/vocabulary">
          Finish for now
        </Link>
      </section>

      <section className="review-workspace" aria-labelledby="study-card-heading">
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
            <span>New word</span>
            <span className={`group-badge ${current.current_group}`}>
              {current.current_group}
            </span>
          </div>
          <p className="eyebrow">English word</p>
          <h2 id="study-card-heading" ref={cardHeading} tabIndex={-1}>
            {current.english_word}
          </h2>
          {!revealed ? (
            <div className="card-primary-action">
              <button
                className="reveal-button"
                type="button"
                onClick={reveal}
                disabled={pending || startStatus !== "ready"}
              >
                {startStatus === "starting" ? "Preparing word…" : "Show translation"}
                <kbd>Space</kbd>
              </button>
              {startStatus === "error" ? (
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={() => startWord(current.id)}
                  disabled={pending}
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : (
            <div className="revealed-answer" aria-live="polite">
              <span>Translation</span>
              <strong>{current.translation}</strong>
            </div>
          )}
        </article>
        <div className="review-outcomes" aria-hidden={!revealed}>
          <button
            className="incorrect-button"
            type="button"
            disabled={!revealed || pending || startStatus !== "ready"}
            onClick={again}
          >
            <strong>Again</strong>
            <span>
              Move to the end <kbd>1</kbd>
            </span>
          </button>
          <button
            className="correct-button"
            type="button"
            disabled={!revealed || pending || startStatus !== "ready"}
            onClick={() => void learned()}
          >
            <strong>{pending ? "Saving…" : "Learned"}</strong>
            <span>
              Review tomorrow <kbd>2</kbd>
            </span>
          </button>
        </div>
        {message ? (
          <p className="form-message centered" role="status">
            {message}
          </p>
        ) : null}
        <div className="study-session-footer">
          <p className="review-note">
            Again keeps the word in this session. Learned starts its repetition schedule.
          </p>
          <Link className="table-action" href="/vocabulary">
            Back to vocabulary
          </Link>
        </div>
      </section>
    </div>
  );
}
