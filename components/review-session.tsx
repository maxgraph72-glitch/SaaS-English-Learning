"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { setDailyBlockStatusAction, submitVocabularyReviewAction } from "@/app/actions/vocabulary";
import type { VocabularyGroup, VocabularyItem } from "@/lib/vocabulary/types";

interface ReviewResult {
  group: VocabularyGroup;
  responseTimeMs: number;
  correct: boolean;
}

export function ReviewSession({ initialQueue, loadError }: { initialQueue: VocabularyItem[]; loadError: string }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(loadError);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const startedAt = useRef(0);
  const submissionId = useRef<string | null>(null);
  const current = initialQueue[index];

  useEffect(() => {
    if (!current) return;
    startedAt.current = performance.now();
    void setDailyBlockStatusAction("review", "in_progress");
  }, [current]);

  const groupCounts = useMemo(() => results.reduce<Partial<Record<VocabularyGroup, number>>>((counts, result) => {
    counts[result.group] = (counts[result.group] ?? 0) + 1;
    return counts;
  }, {}), [results]);

  function reveal() {
    if (revealed) return;
    setResponseTimeMs(Math.max(0, Math.round(performance.now() - startedAt.current)));
    setRevealed(true);
  }

  async function submit(correct: boolean) {
    if (!current || responseTimeMs === null || !revealed) return;
    submissionId.current ??= crypto.randomUUID();
    setPending(true);
    setMessage("");
    const result = await submitVocabularyReviewAction({ itemId: current.id, correct, responseTimeMs, submissionId: submissionId.current });
    setPending(false);
    if (!result.ok || !result.outcome) {
      setMessage(result.ok ? "The saved result was incomplete." : result.message);
      return;
    }
    setResults((existing) => [...existing, { group: result.outcome.group_after as VocabularyGroup, responseTimeMs, correct }]);
    setRevealed(false);
    setResponseTimeMs(null);
    submissionId.current = null;
    setIndex((currentIndex) => currentIndex + 1);
  }

  if (loadError) return <div className="page-container"><section className="empty-review"><h1>Review is unavailable</h1><p>{loadError}</p></section></div>;

  if (!current) {
    return (
      <div className="page-container review-page">
        <section className="review-complete">
          <span className="completion-mark">✓</span><p className="eyebrow">Queue complete</p>
          <h1>{results.length > 0 ? "Nicely done. Your schedule is up to date." : "Nothing is due right now."}</h1>
          <p>{results.length > 0 ? `${results.length} ${results.length === 1 ? "word" : "words"} reviewed. New dates were scheduled from today.` : "Learn a new word or come back on the next scheduled day."}</p>
          {results.length > 0 ? <div className="result-groups">{(["known", "repeat", "weak", "learning"] as const).map((group) => <div key={group}><strong>{groupCounts[group] ?? 0}</strong><span>{group}</span></div>)}</div> : null}
          <div className="completion-actions"><Link className="primary-button compact" href="/">Back to today</Link><Link className="secondary-button" href="/vocabulary">Open vocabulary</Link></div>
        </section>
      </div>
    );
  }

  const progress = (index / initialQueue.length) * 100;
  return (
    <div className="page-container review-page">
      <section className="review-heading">
        <div><p className="eyebrow">Review queue</p><h1>Recall first. Reveal second.</h1><p>The timer stops as soon as you reveal the translation.</p></div>
        <div className="queue-count"><strong>{initialQueue.length - index}</strong><span>remaining</span></div>
      </section>
      <section className="review-workspace" aria-live="polite">
        <div className="review-progress-line"><span>Card {index + 1} of {initialQueue.length}</span><span>{Math.round(progress)}%</span></div>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        <article className={revealed ? "review-card revealed" : "review-card"}>
          <div className="card-meta"><span>Stage {current.repetition_stage}</span><span className={`group-badge ${current.current_group}`}>{current.current_group}</span></div>
          <p className="eyebrow">English word</p><h2>{current.english_word}</h2>
          {!revealed ? <button className="reveal-button" type="button" onClick={reveal}>Reveal translation</button> : <div className="revealed-answer"><span>Translation</span><strong>{current.translation}</strong><small>Recall time: {((responseTimeMs ?? 0) / 1000).toFixed(1)} s</small></div>}
        </article>
        <div className="review-outcomes" aria-hidden={!revealed}>
          <button className="incorrect-button" type="button" disabled={!revealed || pending} onClick={() => submit(false)}><strong>Incorrect</strong><span>Reset to tomorrow</span></button>
          <button className="correct-button" type="button" disabled={!revealed || pending} onClick={() => submit(true)}><strong>Correct</strong><span>Use recall time</span></button>
        </div>
        {message ? <p className="form-message centered" role="status">{message}</p> : null}
        <p className="review-note">Correctness has priority over time. Reading the revealed answer is never timed.</p>
      </section>
    </div>
  );
}
