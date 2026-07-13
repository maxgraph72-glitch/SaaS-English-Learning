"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { setDailyBlockStatusAction } from "@/app/actions/vocabulary";
import type { DailySession } from "@/lib/vocabulary/types";

const lessons = [
  { id: "vocabulary", number: "01", title: "Vocabulary", description: "Choose useful words and learn them at your pace", duration: "10 min", action: "Open vocabulary", tone: "mint", href: "/vocabulary" },
  { id: "speaking", number: "02", title: "Speak aloud", description: "Speaking practice is planned for the next learning stage", duration: "10 min", action: "Coming later", tone: "peach", href: null },
  { id: "writing", number: "03", title: "Daily writing", description: "Diary feedback is planned for the next learning stage", duration: "10 min", action: "Coming later", tone: "lilac", href: null },
  { id: "review", number: "04", title: "Quick review", description: "Review every word that is due or overdue", duration: "5 min", action: "Open review", tone: "sky", href: "/review" },
] as const;

const stageIntervals = [
  { label: "1", value: 24 },
  { label: "2", value: 38 },
  { label: "3", value: 52 },
  { label: "4", value: 72 },
  { label: "5", value: 100 },
] as const;

export function Dashboard({ displayName, cefr, dueCount, vocabularyCount, initialSession, today }: {
  displayName: string;
  cefr: string;
  dueCount: number;
  vocabularyCount: number;
  initialSession: DailySession;
  today: string;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const firstOpenLesson = lessons.findIndex((lesson) => {
    const status = session[`${lesson.id}_status` as keyof DailySession];
    return status !== "completed" && status !== "skipped";
  });
  const [activeLesson, setActiveLesson] = useState(firstOpenLesson === -1 ? 0 : firstOpenLesson);

  const statuses = lessons.map((lesson) => session[`${lesson.id}_status` as keyof DailySession]);
  const completed = statuses.filter((status) => status === "completed").length;
  const handled = statuses.filter((status) => status === "completed" || status === "skipped").length;
  const skipped = statuses.filter((status) => status === "skipped").length;
  const progress = Math.round((handled / lessons.length) * 100);
  const currentLesson = lessons[activeLesson];
  const currentStatus = session[`${currentLesson.id}_status` as keyof DailySession];

  const displayDate = useMemo(() => new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`)), [today]);

  function continueLearning() {
    const nextIndex = lessons.findIndex((lesson) => {
      const status = session[`${lesson.id}_status` as keyof DailySession];
      return status !== "completed" && status !== "skipped";
    });
    if (nextIndex === -1) return router.push(dueCount > 0 ? "/review" : "/vocabulary");
    setActiveLesson(nextIndex);
    const nextLesson = lessons[nextIndex];
    if (nextLesson.href) router.push(nextLesson.href);
  }

  function openCurrentLesson() {
    if (currentLesson.href) router.push(currentLesson.href);
  }

  async function skipCurrentLesson() {
    const result = await setDailyBlockStatusAction(currentLesson.id, "skipped");
    if (!result.ok) return;
    setSession((current) => ({ ...current, [`${currentLesson.id}_status`]: "skipped" }));
    const nextIndex = lessons.findIndex((lesson, index) => {
      if (index <= activeLesson) return false;
      const status = session[`${lesson.id}_status` as keyof DailySession];
      return status !== "completed" && status !== "skipped";
    });
    if (nextIndex !== -1) setActiveLesson(nextIndex);
  }

  return (
    <div className="dashboard">
      <section className="welcome-row" aria-labelledby="welcome-heading">
        <div>
          <p className="eyebrow">{displayDate}</p>
          <h1 id="welcome-heading">Good evening, {displayName}.</h1>
          <p>Your 35-minute English routine is ready when you are.</p>
        </div>
        <button className="continue-button" type="button" onClick={continueLearning}>
          <span aria-hidden="true">▶</span>
          {progress === 100 ? "Review today" : "Continue learning"}
        </button>
      </section>

      <section className="routine-card" aria-labelledby="routine-heading">
        <div className="routine-summary">
          <div>
            <p className="eyebrow">Today’s routine</p>
            <h2 id="routine-heading">Make English part of your day</h2>
          </div>
          <div className="progress-copy">
            <strong>{progress}%</strong>
            <span>{completed} of 4 complete{skipped ? ` · ${skipped} skipped` : ""}</span>
          </div>
        </div>
        <div className="progress-track" role="progressbar" aria-label="Daily routine progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="routine-grid">
          <div className="lesson-list">
            {lessons.map((lesson, index) => {
              const status = session[`${lesson.id}_status` as keyof DailySession];
              const isHandled = status === "completed" || status === "skipped";
              return (
                <button className={`lesson-row ${activeLesson === index ? "selected" : ""}`} type="button" key={lesson.id} onClick={() => setActiveLesson(index)} aria-pressed={activeLesson === index}>
                  <span className={`lesson-number ${lesson.tone}`}>{status === "completed" ? "✓" : status === "skipped" ? "—" : lesson.number}</span>
                  <span className="lesson-copy">
                    <strong>{lesson.title}</strong>
                    <small>{isHandled ? (status === "completed" ? "Completed today" : "Skipped today") : lesson.description}</small>
                  </span>
                  <span className="lesson-time">{lesson.duration}</span>
                </button>
              );
            })}
          </div>

          <article className={`focus-card ${currentLesson.tone}`}>
            <div className="focus-topline"><span>{currentStatus === "not_started" ? "Up next" : currentStatus.replace("_", " ")}</span><span>{currentLesson.duration}</span></div>
            <div className="focus-orbit" aria-hidden="true"><span>{currentLesson.number}</span></div>
            <div><p>{currentLesson.title}</p><h3>{currentLesson.description}</h3></div>
            <button type="button" onClick={openCurrentLesson} disabled={!currentLesson.href}>
              {currentStatus === "completed" ? "Completed" : currentLesson.action}<span aria-hidden="true">→</span>
            </button>
            {(currentStatus === "not_started" || currentStatus === "in_progress") ? <button className="focus-skip" type="button" onClick={skipCurrentLesson}>Skip for today</button> : null}
          </article>
        </div>
      </section>

      <section className="insights-grid" aria-label="Learning insights">
        <article className="insight-card streak-card">
          <div className="card-heading"><div><p className="eyebrow">Review queue</p><h2>{dueCount} {dueCount === 1 ? "word due" : "words due"}</h2></div><span className="streak-badge" aria-hidden="true">✦</span></div>
          <p>{dueCount > 0 ? "Due and overdue cards stay here until you review them." : "Your schedule is clear. Newly learned words appear tomorrow."}</p>
          <div className="week-dots" aria-label="Current review queue">
            {["N", "L", "W", "R", "K", "•", "•"].map((label, index) => <div key={`${label}-${index}`}><span className={index < Math.min(dueCount, 5) ? "done" : index === Math.min(dueCount, 5) ? "today" : ""}>{index < Math.min(dueCount, 5) ? "✓" : ""}</span><small>{label}</small></div>)}
          </div>
        </article>

        <article className="insight-card activity-card">
          <div className="card-heading"><div><p className="eyebrow">Review schedule</p><h2>1 → 30 days</h2></div><span className="positive-pill">5 stages</span></div>
          <div className="activity-bars" aria-label="Spaced repetition intervals">
            {stageIntervals.map((item, index) => <div className="bar-column" key={item.label}><span className="bar-track"><span className={index === 4 ? "bar-fill peak" : "bar-fill"} style={{ height: `${item.value}%` }} /></span><small>{item.label}</small></div>)}
          </div>
        </article>

        <article className="insight-card word-card">
          <div className="card-heading"><div><p className="eyebrow">Your vocabulary</p><h2>{vocabularyCount} words</h2></div><span className="sound-button" aria-hidden="true">◇</span></div>
          <p className="phonetic">Private · synced · {cefr}</p>
          <blockquote>“Small, steady practice creates real confidence.”</blockquote>
          <div className="word-footer"><span>{vocabularyCount} words saved</span><span>{dueCount} due now</span></div>
        </article>
      </section>
    </div>
  );
}
