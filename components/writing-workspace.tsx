"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  checkWritingEntryAction,
  saveWritingEntryAction,
} from "@/app/actions/writing";
import type { WritingState } from "@/lib/writing/types";
import { normalizeWritingText } from "@/lib/writing/validation";

type WritingPhase = "empty" | "draft" | "saving" | "checking" | "completed" | "failed" | "unavailable";

function initialPhase(state: WritingState): WritingPhase {
  if (state.feedback) return "completed";
  if (state.entry?.failure_code === "configuration" || state.entry?.failure_code === "persistence_error") {
    return "unavailable";
  }
  if (state.entry) return "failed";
  return "empty";
}

export function WritingWorkspace({
  initialState,
  loadError,
}: {
  initialState: WritingState;
  loadError: string;
}) {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<WritingPhase>(() => initialPhase(initialState));
  const [message, setMessage] = useState("");
  const [activeSeconds, setActiveSeconds] = useState(0);
  const focused = useRef(false);
  const draftRef = useRef("");
  const submissionId = useRef<string | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const validation = useMemo(() => normalizeWritingText(draft), [draft]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        focused.current
        && document.visibilityState === "visible"
        && /\S/u.test(draftRef.current)
      ) {
        setActiveSeconds((current) => Math.min(current + 1, 3600));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (phase !== "completed") return;
    const frame = window.requestAnimationFrame(() => resultHeading.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  async function requestFeedback(entryId: string) {
    setPhase("checking");
    setMessage("Your entry is saved. Feedback is being generated now.");
    const result = await checkWritingEntryAction(entryId);
    if ("state" in result && result.state) setState(result.state);

    if (result.ok && result.status === "completed") {
      setMessage("");
      setPhase("completed");
      return;
    }

    setMessage(result.message ?? "Your entry is saved. Please retry the feedback check.");
    setPhase(
      "failureCode" in result
      && (result.failureCode === "configuration" || result.failureCode === "persistence_error")
        ? "unavailable"
        : "failed",
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.ok || phase === "saving" || phase === "checking") return;

    submissionId.current ??= crypto.randomUUID();
    setPhase("saving");
    setMessage("Saving your original entry before the AI check.");
    const result = await saveWritingEntryAction({
      submissionId: submissionId.current,
      originalText: validation.text,
      activeSeconds,
    });

    if (!result.ok || !result.state.entry) {
      setMessage(result.message ?? "Your entry could not be saved. Please try again.");
      setPhase("draft");
      return;
    }

    setState(result.state);
    if (result.state.feedback) {
      setMessage("");
      setPhase("completed");
      return;
    }
    await requestFeedback(result.state.entry.id);
  }

  if (loadError) {
    return (
      <div className="page-container writing-page">
        <section className="empty-review" role="alert">
          <p className="eyebrow">Daily writing</p>
          <h1>Writing is unavailable</h1>
          <p>{loadError}</p>
          <Link className="secondary-button" href="/dashboard">Back to today</Link>
        </section>
      </div>
    );
  }

  if (phase === "completed" && state.entry && state.feedback) {
    return (
      <div className="page-container writing-page">
        <section className="writing-result-heading">
          <div>
            <p className="eyebrow">Writing complete</p>
            <h1 ref={resultHeading} tabIndex={-1}>A clear look at today’s entry.</h1>
            <p>Your original meaning stays at the center of every correction.</p>
          </div>
          <div className="cefr-chip" aria-label={`Estimated CEFR ${state.feedback.estimated_cefr}`}>
            <strong>{state.feedback.estimated_cefr}</strong>
            <span>estimate</span>
          </div>
        </section>

        <section className="writing-comparison" aria-label="Original and corrected writing">
          <article className="panel-card writing-text-card">
            <p className="eyebrow">Your original</p>
            <div className="writing-text">{state.entry.original_text}</div>
            <small>{state.entry.word_count} {state.entry.word_count === 1 ? "word" : "words"}</small>
          </article>
          <article className="panel-card writing-text-card corrected">
            <p className="eyebrow">Corrected version</p>
            <div className="writing-text">{state.feedback.corrected_text}</div>
            <small>Meaning and tone preserved</small>
          </article>
        </section>

        <section className="panel-card writing-feedback-panel" aria-labelledby="mistakes-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Focused feedback</p>
              <h2 id="mistakes-heading">
                {state.feedback.mistakes.length === 0
                  ? "No clear mistakes found"
                  : `${state.feedback.mistakes.length} useful ${state.feedback.mistakes.length === 1 ? "note" : "notes"}`}
              </h2>
            </div>
            <span className="panel-step">03</span>
          </div>

          {state.feedback.mistakes.length > 0 ? (
            <ol className="mistake-list">
              {state.feedback.mistakes.map((mistake, index) => (
                <li key={`${mistake.original}-${index}`}>
                  <div className="mistake-topline">
                    <span className={`mistake-category ${mistake.category}`}>{mistake.category}</span>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <p><del>{mistake.original}</del><span aria-hidden="true">→</span><strong>{mistake.correction}</strong></p>
                  <small>{mistake.explanation}</small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="calm-message">Your entry already reads clearly. Keep writing regularly to make that confidence automatic.</p>
          )}
        </section>

        <section className="writing-cefr-note">
          <div><span aria-hidden="true">{state.feedback.estimated_cefr}</span></div>
          <div>
            <p className="eyebrow">CEFR estimate</p>
            <h2>One entry, one gentle signal.</h2>
            <p>{state.feedback.cefr_rationale}</p>
            <small>This estimate is based only on this entry. It is not an official CEFR assessment.</small>
          </div>
        </section>

        <div className="writing-actions">
          <Link className="primary-button compact" href="/dashboard">Back to today</Link>
        </div>
      </div>
    );
  }

  if (state.entry) {
    const wasProcessing = state.entry.feedback_status === "processing";
    const unavailable = phase === "unavailable";
    return (
      <div className="page-container writing-page">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Daily writing</p>
            <h1>{unavailable ? "Writing feedback is unavailable." : "Your entry is safe."}</h1>
            <p>{unavailable
              ? "The saved original remains private to your account while configuration or storage is checked."
              : wasProcessing
                ? "The previous check did not finish yet."
                : "Feedback can be retried without creating another entry."}</p>
          </div>
        </section>
        <section className="panel-card saved-writing-card">
          <div className="panel-heading">
            <div><p className="eyebrow">Saved original</p><h2>{state.entry.word_count} words from today</h2></div>
            <span className="panel-step">03</span>
          </div>
          <div className="writing-text">{state.entry.original_text}</div>
          <p className={phase === "checking" ? "form-message" : "form-message writing-error"} role={phase === "checking" ? "status" : "alert"} aria-live="polite">
            {message || (wasProcessing
              ? "Feedback may still be processing. Retrying safely checks the same saved entry."
              : "The AI check did not complete, but no writing was lost.")}
          </p>
          <div className="saved-writing-actions">
            <button className="primary-button" type="button" disabled={phase === "checking"} onClick={() => void requestFeedback(state.entry!.id)}>
              {phase === "checking" ? "Checking…" : "Retry feedback"}
            </button>
            <Link className="secondary-button" href="/dashboard">Back to today</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-container writing-page">
      <section className="page-heading writing-intro">
        <div>
          <p className="eyebrow">Daily writing</p>
          <h1>Put today into English.</h1>
          <p>A short, honest entry is enough. The feedback stays focused on language, not your story.</p>
        </div>
        <div className="total-chip lilac-chip"><strong>10</strong><span>min guide</span></div>
      </section>

      <form className="panel-card writing-editor" onSubmit={submit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Today’s prompt</p>
            <h2>What happened today, and how did it make you feel?</h2>
          </div>
          <span className="panel-step">03</span>
        </div>
        <label htmlFor="writing-entry">Your diary entry</label>
        <textarea
          id="writing-entry"
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            setPhase(value ? "draft" : "empty");
            setMessage("");
          }}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; }}
          rows={12}
          aria-describedby="writing-length writing-privacy writing-message"
          placeholder="Today I…"
          disabled={phase === "saving" || phase === "checking"}
        />
        <div className="writing-editor-meta" id="writing-length">
          <span>{validation.wordCount} {validation.wordCount === 1 ? "word" : "words"}</span>
          <span>{validation.characterCount.toLocaleString("en")} / 5,000 characters</span>
        </div>
        <p className="writing-privacy" id="writing-privacy">
          Your original is saved first, then only this entry is sent to Yandex AI Studio for correction. Request logging is disabled.
        </p>
        <div className="writing-submit-row">
          <p className="form-message" id="writing-message" role="status" aria-live="polite">
            {message || (!validation.ok && draft ? validation.message : "At least 20 non-space characters.")}
          </p>
          <button className="primary-button" type="submit" disabled={!validation.ok || phase === "saving" || phase === "checking"}>
            {phase === "saving" ? "Saving…" : phase === "checking" ? "Checking…" : "Check my writing"}
          </button>
        </div>
      </form>
    </div>
  );
}
