"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { submitPracticeAttemptAction } from "@/app/actions/practice";
import {
  canSubmitPracticeAnswer,
  completePracticePrompt,
  currentPracticeExercise,
  displayedPracticeExercise,
  getOrCreateSubmissionId,
  practiceSessionProgress,
  type PracticeSessionResult,
} from "@/lib/practice/session";
import type { PracticeAttemptOutcome, PracticeExercise } from "@/lib/practice/types";

interface PracticeFeedback {
  outcome: PracticeAttemptOutcome;
  exercise: PracticeExercise;
  submittedAnswer: string;
}

export function PracticeSession({
  exercises,
  loadError = "",
}: {
  exercises: PracticeExercise[];
  loadError?: string;
}) {
  const [completed, setCompleted] = useState(0);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<PracticeSessionResult[]>([]);
  const submissionIds = useRef(new Map<string, string>());
  const startedAt = useRef(0);
  const answerInput = useRef<HTMLInputElement>(null);
  const feedbackHeading = useRef<HTMLHeadingElement>(null);
  const current = currentPracticeExercise(exercises, completed);
  const displayedExercise = displayedPracticeExercise(
    exercises,
    completed,
    feedback?.exercise ?? null,
  );
  const progress = practiceSessionProgress(exercises.length, completed);

  useEffect(() => {
    if (!current) return;
    startedAt.current = performance.now();
    const frame = window.requestAnimationFrame(() => answerInput.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [current]);

  useEffect(() => {
    if (!feedback) return;
    const frame = window.requestAnimationFrame(() => {
      feedbackHeading.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [feedback]);

  async function submitAnswer() {
    if (!current || !canSubmitPracticeAnswer({ answer, pending, hasFeedback: Boolean(feedback) })) return;
    const submissionId = getOrCreateSubmissionId(
      submissionIds.current,
      current.id,
      () => crypto.randomUUID(),
    );
    setPending(true);
    setMessage("");
    try {
      const result = await submitPracticeAttemptAction({
        exerciseId: current.id,
        answer,
        responseMs: performance.now() - startedAt.current,
        submissionId,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setFeedback({
        outcome: result.outcome,
        exercise: current,
        submittedAnswer: answer.trim(),
      });
      setResults((existing) => [
        ...existing,
        { exerciseId: current.id, correct: result.outcome.is_correct },
      ]);
    } catch {
      setMessage("Your answer could not be saved. Retry to use the same safe submission ID.");
    } finally {
      setPending(false);
    }
  }

  function nextExercise() {
    if (!feedback) return;
    submissionIds.current.delete(feedback.exercise.id);
    setCompleted((value) => value + 1);
    setAnswer("");
    setFeedback(null);
    setMessage("");
  }

  if (loadError) {
    return (
      <div className="page-container review-page">
        <section className="empty-review" role="alert">
          <p className="eyebrow">Grammar practice</p>
          <h1>Practice is unavailable</h1>
          <p>{loadError}</p>
          <div className="completion-actions">
            <Link className="primary-button compact" href="/dashboard">Back to today</Link>
            <Link className="secondary-button" href="/practice/sources">Sources and licenses</Link>
          </div>
        </section>
      </div>
    );
  }

  if (!displayedExercise) {
    const correct = results.filter((result) => result.correct).length;
    return (
      <div className="page-container review-page">
        <section className="review-complete">
          <span className="completion-mark" aria-hidden="true">✓</span>
          <p className="eyebrow">Practice complete</p>
          <h1>{exercises.length > 0 ? "Your ten-item session is complete." : "Practice content is being prepared."}</h1>
          <p>
            {exercises.length > 0
              ? `You answered ${correct} of ${results.length} correctly. Previously missed exercises will be prioritized in a later session.`
              : "No human-reviewed, published exercises are available yet. Draft and fixture content stays hidden from learners."}
          </p>
          {exercises.length > 0 ? (
            <div className="result-groups">
              <div><strong>{results.length}</strong><span>answered</span></div>
              <div><strong>{correct}</strong><span>correct</span></div>
              <div><strong>{results.length - correct}</strong><span>to revisit</span></div>
              <div><strong>0</strong><span>remaining</span></div>
            </div>
          ) : null}
          <div className="completion-actions">
            <Link className="primary-button compact" href="/dashboard">Back to today</Link>
            <Link className="secondary-button" href="/practice/sources">Sources and licenses</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-container review-page">
      <section className="review-heading">
        <div>
          <p className="eyebrow">Grammar practice · {displayedExercise.cefr_estimate}</p>
          <h1>Choose the exact grammar form.</h1>
          <p>Complete one sentence at a time. Your answer is checked deterministically.</p>
        </div>
        <div className="queue-count"><strong>{progress.remaining}</strong><span>remaining</span></div>
      </section>

      <section className="review-workspace" aria-labelledby="practice-prompt">
        <div className="review-progress-line">
          <span>Exercise {completed + 1} of {progress.total}</span>
          <span>{Math.round(progress.percent)}%</span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progress.percent}%` }} />
        </div>

        <article className={feedback ? "review-card revealed" : "review-card"}>
          <div className="card-meta">
            <span>{displayedExercise.grammar_topic.replaceAll("_", " ")}</span>
            <span className="group-badge repeat">{displayedExercise.exercise_type.replaceAll("_", " ")}</span>
          </div>
          <p className="eyebrow">Fill in the blank</p>
          <h2 id="practice-prompt">{displayedExercise.prompt}</h2>

          {!feedback ? (
            <form
              className="management-form"
              style={{ width: "min(100%, 560px)" }}
              onSubmit={(event) => {
                event.preventDefault();
                void submitAnswer();
              }}
            >
              <label htmlFor="practice-answer">
                {`Answer for: ${displayedExercise.prompt}`}
                <input
                  id="practice-answer"
                  ref={answerInput}
                  value={answer}
                  maxLength={200}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={pending}
                  onChange={(event) => setAnswer(event.target.value)}
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!canSubmitPracticeAnswer({ answer, pending, hasFeedback: false })}
              >
                {pending ? "Saving…" : "Check answer"}
              </button>
            </form>
          ) : (
            <div className="revealed-answer" role="status" aria-live="polite">
              <span
                className={feedback.outcome.is_correct
                  ? "practice-feedback-status correct"
                  : "practice-feedback-status incorrect"}
              >
                {feedback.outcome.is_correct ? "Correct ✓" : "Incorrect ✕"}
              </span>
              <strong ref={feedbackHeading} tabIndex={-1}>
                {feedback.outcome.is_correct
                  ? "Your answer is correct."
                  : "Your answer is not correct yet."}
              </strong>
              <p>Your answer: <strong>{feedback.submittedAnswer}</strong></p>
              <p>Correct answer: <strong>{feedback.outcome.correct_answer}</strong></p>
              <p>
                Complete sentence:{" "}
                <strong>
                  {completePracticePrompt(
                    feedback.exercise.prompt,
                    feedback.outcome.correct_answer,
                  )}
                </strong>
              </p>
              <small>{feedback.outcome.explanation || feedback.exercise.explanation || "Use the form shown in the answer."}</small>
              <button className="primary-button" type="button" onClick={nextExercise}>
                {completed + 1 === exercises.length ? "Finish session" : "Next exercise"}
              </button>
            </div>
          )}
        </article>

        {message ? <p className="form-message centered" role="alert">{message}</p> : null}
        <p className="review-note">
          Press Enter in the answer field to submit. Failed saves keep this exercise and reuse the same submission ID. ·{" "}
          <Link href="/practice/sources">Sources and licenses</Link>
        </p>
      </section>
    </div>
  );
}
