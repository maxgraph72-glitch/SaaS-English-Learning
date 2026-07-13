"use client";

import { useEffect, useMemo, useState } from "react";

const lessons = [
  {
    id: "vocabulary",
    number: "01",
    title: "Vocabulary",
    description: "12 useful words for everyday conversations",
    duration: "10 min",
    action: "Review cards",
    tone: "mint",
  },
  {
    id: "speaking",
    number: "02",
    title: "Speak aloud",
    description: "Talk about a place that makes you feel calm",
    duration: "10 min",
    action: "Start speaking",
    tone: "peach",
  },
  {
    id: "writing",
    number: "03",
    title: "Daily writing",
    description: "Write a short diary entry and get clear feedback",
    duration: "10 min",
    action: "Open diary",
    tone: "lilac",
  },
  {
    id: "review",
    number: "04",
    title: "Quick review",
    description: "Fix recurring mistakes from this week",
    duration: "5 min",
    action: "Review mistakes",
    tone: "sky",
  },
] as const;

const navigation = [
  ["⌂", "Today"],
  ["◇", "Vocabulary"],
  ["◌", "Practice"],
  ["↗", "Progress"],
  ["⚙", "Settings"],
] as const;

const weeklyActivity = [
  { day: "M", value: 52 },
  { day: "T", value: 76 },
  { day: "W", value: 44 },
  { day: "T", value: 88 },
  { day: "F", value: 64 },
  { day: "S", value: 32 },
  { day: "S", value: 18 },
] as const;

export function LearningDashboard() {
  const [activeLesson, setActiveLesson] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem("daily-english-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(storedTheme ? storedTheme === "dark" : prefersDark);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem(
      "daily-english-theme",
      darkMode ? "dark" : "light",
    );
  }, [darkMode]);

  const progress = Math.round((completed.length / lessons.length) * 100);
  const currentLesson = lessons[activeLesson];
  const isCurrentComplete = completed.includes(currentLesson.id);

  const nextLessonIndex = useMemo(
    () => lessons.findIndex((lesson) => !completed.includes(lesson.id)),
    [completed],
  );

  function completeCurrentLesson() {
    if (!isCurrentComplete) {
      setCompleted((current) => [...current, currentLesson.id]);
    }

    const nextIndex = lessons.findIndex(
      (lesson, index) =>
        index > activeLesson && !completed.includes(lesson.id),
    );

    if (nextIndex !== -1) setActiveLesson(nextIndex);
  }

  function continueLearning() {
    if (nextLessonIndex !== -1) setActiveLesson(nextLessonIndex);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Daily English home">
          <span className="brand-mark">D</span>
          <span>
            <strong>Daily</strong>
            <small>English practice</small>
          </span>
        </a>

        <nav className="sidebar-nav">
          {navigation.map(([symbol, label], index) => (
            <a
              className={index === 0 ? "nav-item active" : "nav-item"}
              href={index === 0 ? "#top" : `#${label.toLowerCase()}`}
              key={label}
            >
              <span className="nav-symbol" aria-hidden="true">
                {symbol}
              </span>
              {label}
            </a>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="level-chip">
            <span>A2</span>
            <div>
              <strong>Elementary</strong>
              <small>64% to B1</small>
            </div>
          </div>
          <div className="level-track" aria-hidden="true">
            <span />
          </div>
          <p>Small steps become fluent habits.</p>
        </div>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <a className="mobile-brand" href="#top" aria-label="Daily English home">
            <span className="brand-mark">D</span>
            <strong>Daily</strong>
          </a>
          <div className="topbar-actions">
            <button
              className="theme-toggle"
              type="button"
              aria-label={darkMode ? "Use light theme" : "Use dark theme"}
              aria-pressed={darkMode}
              onClick={() => setDarkMode((value) => !value)}
            >
              <span aria-hidden="true">{darkMode ? "☀" : "☾"}</span>
            </button>
            <button className="profile-button" type="button" aria-label="Open profile">
              <span className="avatar">AK</span>
              <span className="profile-copy">
                <strong>Alex Kim</strong>
                <small>12 day streak</small>
              </span>
              <span aria-hidden="true">⌄</span>
            </button>
          </div>
        </header>

        <div className="dashboard">
          <section className="welcome-row" aria-labelledby="welcome-heading">
            <div>
              <p className="eyebrow">Monday, 13 July</p>
              <h1 id="welcome-heading">Good evening, Alex.</h1>
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
                <span>{completed.length} of 4 complete</span>
              </div>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Daily routine progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>

            <div className="routine-grid">
              <div className="lesson-list">
                {lessons.map((lesson, index) => {
                  const isComplete = completed.includes(lesson.id);
                  const isActive = activeLesson === index;
                  return (
                    <button
                      className={`lesson-row ${isActive ? "selected" : ""}`}
                      type="button"
                      key={lesson.id}
                      onClick={() => setActiveLesson(index)}
                      aria-pressed={isActive}
                    >
                      <span className={`lesson-number ${lesson.tone}`}>
                        {isComplete ? "✓" : lesson.number}
                      </span>
                      <span className="lesson-copy">
                        <strong>{lesson.title}</strong>
                        <small>{lesson.description}</small>
                      </span>
                      <span className="lesson-time">{lesson.duration}</span>
                    </button>
                  );
                })}
              </div>

              <article className={`focus-card ${currentLesson.tone}`}>
                <div className="focus-topline">
                  <span>Up next</span>
                  <span>{currentLesson.duration}</span>
                </div>
                <div className="focus-orbit" aria-hidden="true">
                  <span>{currentLesson.number}</span>
                </div>
                <div>
                  <p>{currentLesson.title}</p>
                  <h3>{currentLesson.description}</h3>
                </div>
                <button type="button" onClick={completeCurrentLesson}>
                  {isCurrentComplete ? "Completed" : currentLesson.action}
                  <span aria-hidden="true">→</span>
                </button>
              </article>
            </div>
          </section>

          <section className="insights-grid" aria-label="Learning insights">
            <article className="insight-card streak-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Consistency</p>
                  <h2>12 day streak</h2>
                </div>
                <span className="streak-badge" aria-hidden="true">✦</span>
              </div>
              <p>You have studied 4 days more than last week.</p>
              <div className="week-dots" aria-label="Activity during the last seven days">
                {weeklyActivity.map((item, index) => (
                  <div key={`${item.day}-${index}`}>
                    <span className={index < 5 ? "done" : index === 5 ? "today" : ""}>
                      {index < 5 ? "✓" : index === 5 ? "•" : ""}
                    </span>
                    <small>{item.day}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="insight-card activity-card" id="progress">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">This week</p>
                  <h2>3h 24m</h2>
                </div>
                <span className="positive-pill">+18%</span>
              </div>
              <div className="activity-bars" aria-label="Minutes studied each day">
                {weeklyActivity.map((item, index) => (
                  <div className="bar-column" key={`${item.day}-${index}`}>
                    <span className="bar-track">
                      <span
                        className={index === 3 ? "bar-fill peak" : "bar-fill"}
                        style={{ height: `${item.value}%` }}
                      />
                    </span>
                    <small>{item.day}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="insight-card word-card" id="vocabulary">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Word of the day</p>
                  <h2>steady</h2>
                </div>
                <span className="sound-button" aria-hidden="true">◖))</span>
              </div>
              <p className="phonetic">/ˈstedi/ · adjective</p>
              <blockquote>“Small, steady practice creates real confidence.”</blockquote>
              <div className="word-footer">
                <span>328 words learned</span>
                <span>+24 this week</span>
              </div>
            </article>
          </section>
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 4).map(([symbol, label], index) => (
          <a className={index === 0 ? "active" : ""} href={index === 0 ? "#top" : `#${label.toLowerCase()}`} key={label}>
            <span aria-hidden="true">{symbol}</span>
            <small>{label}</small>
          </a>
        ))}
      </nav>
    </main>
  );
}
