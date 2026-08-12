# Vocabulary And Spaced Repetition Specification

## Status

- Approved product direction: 2026-07-13.
- Automatic daily queue revision: 2026-08-12.
- Intended implementation branch: `feature/spaced-repetition`.
- This document refines the `Vocabulary` and `Review And Spaced Repetition` sections of `MVP_SPEC.md`.
- If this document conflicts with the general MVP description for vocabulary review behavior, this document is authoritative for this implementation stage.

## Goal

Build the first complete learning loop around user-owned vocabulary:

1. A user signs in.
2. The user adds words manually or imports a CSV exported from Google Sheets.
3. New words start as `unknown` and can be selected for learning.
4. After a word is learned, its first review is scheduled for the next local calendar day.
5. Each review records correctness and response time.
6. The system assigns the word to a learning group and schedules its next review.
7. The dashboard shows the real number of words due and links to the review queue.

The feature should preserve the current clean dashboard style and remain usable on desktop and mobile.

## Product Decisions For This Stage

- Use Supabase Auth and user-owned Supabase data rather than device-only learning data.
- Support email/password and Google sign-in as required by `MVP_SPEC.md`. Google sign-in may require project-level provider configuration outside the repository.
- Use manual entry and user-uploaded CSV for vocabulary input.
- Do not add direct access to private Google Sheets or request Google Sheets OAuth scopes in this stage.
- Treat learning timers as guidance. A timer must not block or automatically fail a user.
- Allow a daily block to be skipped, but record it as skipped rather than completed.
- Keep the current interface language in English while structuring new copy so future Russian/English localization is possible.

## Vocabulary Groups

These values record the most recent recall quality for scheduling and history. They
are not permanent library folders and must not be presented as the daily review
queue.

Each vocabulary item has exactly one current group:

- `unknown`: imported or manually added, but not selected for active learning.
- `learning`: selected for learning, newly learned, or returned to the start of the repetition cycle after a failed review.
- `weak`: recalled correctly, but only after more than 5 and no more than 10 seconds.
- `repeat`: recalled correctly in 3 to 5 seconds and should repeat the current interval stage.
- `known`: recalled correctly in under 3 seconds and can advance to the next interval stage.

`unknown` is an intake state, not a possible review result. Once a word enters active learning, a failed review returns it to `learning`, not `unknown`.

## Repetition Stages And Intervals

The repetition schedule has five stages:

| Stage | Interval from the scheduling event |
| --- | --- |
| 1 | 1 calendar day |
| 2 | 2 calendar days |
| 3 | 3 calendar days |
| 4 | 7 calendar days |
| 5 | 30 calendar days |

The interval is counted from the date on which the word was learned or the review was submitted. It is not counted from the previous due date.

Example for a word learned on 2026-07-13 with five consecutive `known` results:

| Event | Date |
| --- | --- |
| Word learned | 2026-07-13 |
| Review 1 | 2026-07-14 |
| Review 2 | 2026-07-16 |
| Review 3 | 2026-07-19 |
| Review 4 | 2026-07-26 |
| Review 5 | 2026-08-25 |

After a successful stage 5 review, the word remains at stage 5 and is scheduled every 30 days. A later slower or failed result can move it back into `repeat`, `weak`, or `learning` according to the rules below.

## Starting The Schedule

Manual and imported words begin with:

- group: `unknown`;
- repetition stage: `0`;
- next review date: `null`.

Selecting a word for study changes its group to `learning` but does not schedule a review by itself.

When the user explicitly finishes studying the word with a `Mark as learned` action:

- group becomes `learning`;
- repetition stage becomes `1`;
- the learned timestamp is saved;
- next review date becomes the next local calendar day.

Repeated clicks or retried requests must not create duplicate review history or advance the schedule twice.

## Review Measurement

The response timer starts when the front of the active word card becomes visible and ready for interaction.

The timer stops when the user reveals the translation. Time spent reading the revealed translation or choosing `Correct` or `Incorrect` is not included.

Store response time as integer milliseconds. The interface can display a rounded value.

Correctness is an explicit user choice after the translation is revealed. A user cannot submit a result before revealing the translation.

## Review Outcome Rules

Correctness takes priority over response time.

| Result | New group | New stage | Next review |
| --- | --- | --- | --- |
| Correct in less than 3 seconds | `known` | Advance by 1, capped at stage 5 | Use the interval for the new stage; at stage 5 use 30 days |
| Correct in 3 to 5 seconds, inclusive | `repeat` | Keep the current stage | Repeat the interval for the current stage |
| Correct in more than 5 and no more than 10 seconds | `weak` | Reset to stage 1 | Next local calendar day |
| Incorrect at any response time | `learning` | Reset to stage 1 | Next local calendar day |
| Correct after more than 10 seconds | `learning` | Reset to stage 1 | Next local calendar day |

Boundary examples:

- `2999 ms`, correct: `known`.
- `3000 ms`, correct: `repeat`.
- `5000 ms`, correct: `repeat`.
- `5001 ms`, correct: `weak`.
- `10000 ms`, correct: `weak`.
- `10001 ms`, correct: `learning`.

When a stage 1 word receives a `known` result, it advances to stage 2 and is due 2 calendar days after that review. When a stage 5 word receives a `known` result, it stays at stage 5 and is due 30 calendar days after that review.

## Date And Queue Rules

- Due dates are calendar dates in the user's configured timezone, not rolling 24-hour durations.
- Store event timestamps with timezone and store the next due value as a calendar date.
- If the user has no configured timezone yet, use the timezone detected during onboarding and save it to the user settings. Do not continually recalculate old due dates from the device timezone.
- A word is due when `next_review_date` is equal to or earlier than the user's current local date.
- The daily review queue is generated automatically from all due words. The user
  does not select individual due words before starting Review.
- Loading or reloading the queue is read-only. It must not change a word's group,
  stage, or next review date.
- Overdue words remain in the queue until reviewed.
- A word appears at most once in a generated daily review queue.
- Order due words by oldest due date first, then by creation date for a stable order.
- A result schedules from the actual submission date. Do not backdate the next interval from an overdue due date.
- After a confirmed answer, remove the word from today's queue immediately and
  assign a future review date from the actual submission date.

## Library Progress Status

The Vocabulary library derives a simple learner-facing status from the schedule:

- `New`: stage 0 with no review date.
- `Learning`: stages 1 through 4.
- `Mastered`: stage 5, which remains on the 30-day maintenance interval.
- `Due today`: a temporary, overlapping filter for any scheduled word whose review
  date has arrived. It is not a permanent progress status.

A reviewed word leaves `Due today` as soon as its next review date moves into the
future. It remains visible in the permanent library under `Learning` or `Mastered`.

## Vocabulary Management

### Manual entry

- Require an English word and a translation.
- Trim surrounding whitespace.
- Reject rows where either required value is empty after trimming.
- Treat duplicate English words case-insensitively per user.
- A duplicate must not silently overwrite existing progress. Show a clear message instead.

### CSV import

- Accept a user-uploaded CSV file that can be exported from Google Sheets.
- Read the English word from the first column and the translation from the second column.
- Ignore additional columns.
- Support a conventional header row when the first two cells identify word and translation columns.
- Skip blank rows.
- Skip duplicates without overwriting existing items.
- Show an import summary: added, skipped as duplicates, and invalid rows.
- Imported words start as `unknown` at stage `0` with no next review date.
- Do not upload the original CSV to permanent storage after parsing unless a later requirement explicitly asks for it.
- Insert valid rows in bounded batches rather than one database request per word.
- Enforce duplicates with a database constraint and conflict handling. Do not use a race-prone select-then-insert sequence.

## Required Product Surfaces

### Vocabulary

- List the user's words with search and `New`, `Learning`, `Mastered`, and
  `Due today` filtering.
- Show progress-status counts and a temporary due count.
- Add a word manually.
- Import CSV.
- Select `unknown` words for learning.
- Provide a clear `Mark as learned` action after the study interaction.
- Show the next review date for scheduled words.

### Review

- Show the number of words due today.
- Open the complete due queue automatically; URL parameters and library selection
  must not narrow the scheduled queue.
- Present one word card at a time.
- Reveal the translation before accepting an outcome.
- Record `Correct` or `Incorrect` plus measured response time.
- Show progress through the current queue.
- Show a calm completion summary with the number reviewed and resulting groups.

### Dashboard

- Replace the demo due count with the authenticated user's real due count.
- Link the vocabulary and review actions to their real screens.
- Reflect today's vocabulary/review completion in the daily routine.
- Preserve the current responsive layout, theme behavior, and visual language.

## Data Model Requirements

The implementation should extend the MVP data areas rather than introduce a separate storage model.

### `vocabulary_items`

Required logical fields:

- stable item ID;
- `user_id` ownership;
- English word;
- translation;
- source (`manual` or `csv`);
- current group;
- repetition stage constrained to `0` through `5`;
- learned timestamp, nullable;
- last reviewed timestamp, nullable;
- next review date, nullable;
- created and updated timestamps.

Use a per-user normalized-word constraint or equivalent transaction-safe protection against duplicates. Index `user_id`, and add an index suitable for the due queue, such as user plus next review date. A partial index that excludes rows with a null next review date is appropriate if it matches the implemented due query.

### `vocabulary_reviews`

Each submitted review creates an immutable history row containing:

- stable review ID;
- `user_id` ownership;
- vocabulary item relation;
- review timestamp;
- correctness;
- response time in milliseconds;
- group before and after;
- stage before and after;
- calculated next review date.

The vocabulary item update and review-history insert must succeed atomically. Do not leave the current item state updated without the corresponding history row, or vice versa.

Index the vocabulary item foreign key used by review history, as well as ownership columns used by RLS and user-scoped history queries. Keep the review transaction short and do not perform external network calls while it holds database locks.

### `daily_sessions`

Record the daily vocabulary and review block state using the existing MVP data area. At minimum distinguish `not_started`, `in_progress`, `completed`, and `skipped`.

## Supabase Ownership And Security

- Every user-owned table must include `user_id`.
- Enable RLS on every user-facing table in an exposed schema.
- Policies must target `authenticated` and check `(select auth.uid()) = user_id`.
- Update policies must include both `USING` and `WITH CHECK` ownership checks, and a corresponding select policy.
- Index ownership columns used by RLS.
- Never use `user_metadata` for authorization.
- Never expose a secret or service-role key to the browser.
- Verify whether the configured Supabase project exposes new tables to the Data API automatically. If it does not, add only the required grants for `authenticated` while keeping RLS enabled.
- Create migrations through the project's Supabase CLI workflow once the CLI is introduced. Do not invent migration filenames manually.

## Learning Logic Boundary

Implement the scheduling and classification rules as a pure, deterministic server-safe function independent of React and Supabase.

Conceptual input:

- correctness;
- response time in milliseconds;
- current repetition stage;
- actual review calendar date.

Conceptual output:

- new group;
- new repetition stage;
- next review date.

The server-side mutation remains authoritative. The client can preview UI state but must not be trusted to provide the resulting group, stage, or next date.

## Verification Requirements

Add unit tests for the pure learning logic. Use Vitest as directed by `AGENTS.md` when the dependency is introduced.

Required test coverage:

- a newly learned word is due on the next local calendar day;
- every response-time boundary listed above;
- incorrect answers override response time;
- stage advancement through `1, 2, 3, 4, 5`;
- stage 5 remains monthly after a `known` result;
- `repeat` keeps the current stage and interval;
- `weak` resets to stage 1 and tomorrow;
- failed reviews reset to stage 1 and tomorrow;
- overdue reviews schedule from the actual review date;
- month-end and year-end calendar-date calculations;
- duplicate submission protection;
- one user's vocabulary is inaccessible to another user under RLS.

Run every script that exists for the implemented project, including build, lint, and relevant tests. Do not claim Supabase persistence or RLS is verified without exercising it against a configured local or remote Supabase environment.

## Acceptance Criteria

This stage is complete when:

- an authenticated user can add and import vocabulary;
- imported and manual words are isolated per user;
- the user can move a word from intake into active learning;
- learning a word schedules its first review for the next local calendar day;
- the review UI measures recall time and records correctness;
- every review deterministically updates the group, stage, and next due date according to this document;
- the fifth successful stage continues on a 30-day maintenance interval;
- history is saved for every submitted review;
- due and overdue words appear in the correct queue order;
- reviewed words immediately leave `Due today` while remaining in the library;
- the dashboard shows real due data and routes to the new screens;
- responsive layout, keyboard access, focus states, and light/dark themes continue to work;
- unit tests cover the learning algorithm;
- persistence and RLS are verified when a Supabase environment is available;
- build and lint pass.

## Out Of Scope

- Direct private Google Sheets API access.
- Editing the interval sequence in Settings.
- AI-generated vocabulary definitions or examples.
- Writing feedback.
- Speaking transcription or pronunciation feedback.
- Complex memory models such as SM-2 or FSRS.
- Payments, subscriptions, analytics, or notifications.
