# Vocabulary And Flashcards — Package 1 Specification

## Status

- Product scope approved: 2026-07-14.
- This document is implementation-ready.
- This package extends the existing Vocabulary and Review modules.
- `SPACED_REPETITION_SPEC.md` remains authoritative for repetition groups,
  timing boundaries, stages, due dates, and review history.
- `DESIGN_BASELINE.md` remains the locked visual source of truth. This package
  does not approve a redesign or a new design baseline.

## Goal

Turn the current single-word study interaction into a complete flashcard
session while preserving the existing spaced-repetition behavior.

After this package, a learner can:

1. Select up to 10 eligible words in Vocabulary.
2. Study the selected words as a focused card session.
3. reveal each translation before choosing an outcome.
4. Mark a word as learned or return it to the end of the session.
5. Leave the session without losing already saved learned results.
6. Use keyboard shortcuts in both new-word study and scheduled review.
7. Move a scheduled review card to the end of the current queue without
   changing its database state.

## Current Behavior To Preserve

- Users must be authenticated before vocabulary data is loaded or changed.
- Manual and CSV vocabulary input continue to work as currently implemented.
- Search, group filters, counts, stages, and next-review dates remain available.
- New words begin in `unknown`, stage `0`, with no review date.
- A word selected for learning moves to `learning`, stage `0`, but is not yet
  scheduled.
- `Mark as learned` remains the only action that starts the repetition schedule.
- A newly learned word is scheduled for the next local calendar day at stage 1.
- Scheduled review outcomes, response-time thresholds, due ordering, duplicate
  submission protection, and review history remain unchanged.
- Existing Supabase ownership and RLS boundaries remain authoritative.
- The interface language remains English for this package.

## Scope

### 1. Multi-select In Vocabulary

Add selection controls to the existing vocabulary collection.

Eligible items:

- `unknown` words at stage `0`;
- `learning` words at stage `0`.

Ineligible items:

- any word with repetition stage `1` through `5`;
- any word that already has a next review date;
- words that do not belong to the authenticated user.

Selection rules:

- The user can select between 1 and 10 eligible words.
- Selection order determines the initial study order.
- Selection remains intact when the user changes a client-side search query or
  group filter, as long as the selected item is still present in the loaded
  collection.
- An eleventh word cannot be selected. Show a calm inline message explaining
  the 10-word limit.
- Scheduled rows keep their current non-interactive status presentation.
- The primary action is labelled `Study selected` and includes the current
  count, for example `Study selected (4)`.
- The action is disabled when no eligible word is selected.
- This package does not add automatic selection, select-all, or a configurable
  session-size preference.

Selection must use real accessible checkbox controls. A visual checkbox may be
styled to match the approved interface, but the semantic input and its label
must remain available to assistive technology.

### 2. Study Route

Create a dedicated authenticated route at:

```text
/vocabulary/study
```

The Vocabulary screen navigates to this route with no more than 10 selected
item IDs. The transport format may use URL search parameters, but it is never a
security boundary.

Server loading rules:

- Parse and de-duplicate the requested IDs.
- Reject or ignore malformed IDs.
- Enforce a maximum of 10 IDs on the server, even if the client is modified.
- Query the items through the authenticated Supabase client so RLS remains in
  effect.
- Load only items that are still eligible at request time.
- Restore the user's selection order after the database result is returned.
- Never trust client-provided words, translations, groups, stages, or ownership.
- If none of the requested words is available, show a calm empty state with a
  link back to Vocabulary.

The new route must use the existing `AppShell`. It must not add a new sidebar or
mobile-navigation destination in this package.

### 3. New-Word Study Session

The session shows one card at a time.

Front state:

- show the English word;
- keep the translation hidden;
- show progress through the selected set;
- provide a `Show translation` action;
- provide a visible exit action back to Vocabulary.

Revealed state:

- show the translation;
- show `Again` and `Learned` actions;
- keep the current card visible while a server mutation is pending;
- prevent double submission while pending.

The user must reveal the translation before `Again` or `Learned` can be used.

#### First Display Of A Word

When an `unknown` word becomes the active visible card for the first time, call
the existing `startVocabularyLearningAction` flow before an outcome can be
saved. This changes the word to `learning`, stage `0`, without assigning a due
date.

Important consequences:

- A selected word that the user never reaches remains `unknown`.
- A word already in `learning`, stage `0`, does not need to be started again.
- If starting the word fails, keep the card in place, show a retryable error,
  and do not expose an enabled `Learned` action.

#### `Again`

`Again` means the learner is not ready to schedule the word.

- Do not call `markVocabularyLearnedAction`.
- Do not create review history.
- Do not assign a next review date.
- Keep the item at `learning`, stage `0`.
- Move the card to the end of the current in-memory session queue.
- Hide the translation when it appears again.
- Increment the session's repeated-attempt count.

There is no automatic failure or maximum number of `Again` attempts. The user
can continue until the word is learned or leave the session.

#### `Learned`

`Learned` means the learner is ready to start scheduled repetition.

- Call the existing `markVocabularyLearnedAction` flow.
- Use a stable client-generated submission ID for retry protection.
- Reuse the same submission ID when retrying the same failed request.
- On success, remove the card from the current session queue.
- The word becomes `learning`, stage `1`.
- Its first review is due on the next local calendar day.
- Advance to the next card only after the server confirms success.
- Do not create a scheduled-review history row for this learning action; retain
  the existing data contract.

#### Leaving And Resuming

- The user can leave through an explicit `Back to vocabulary` or `Finish for
  now` action.
- Learned results already confirmed by the server remain saved and scheduled.
- Unsaved UI state, queue position, and `Again` attempt counts do not need to be
  persisted across navigation or a browser refresh.
- On refresh, the route may rebuild a session from the still-eligible requested
  IDs. Items already learned elsewhere are omitted.
- Do not use `localStorage` or `sessionStorage` for study progress in this
  package.
- Do not show a destructive-navigation confirmation because there is no
  partially edited record to discard.

### 4. Study Completion

The completion state appears when every card in the current queue has been
successfully marked as learned.

Show:

- the number of words learned in this session;
- the number of `Again` attempts;
- a short explanation that the first reviews are scheduled for tomorrow;
- a primary link back to Vocabulary;
- a secondary link back to Today.

The completion state must not claim that scheduled review is available today
unless the server actually reports due words.

### 5. Study Keyboard Shortcuts

Support these shortcuts on the new study route:

| Key | Action | Availability |
| --- | --- | --- |
| `Space` | Reveal translation | Front state only |
| `1` | Again | Revealed state only |
| `2` | Learned | Revealed state only |

Shortcut rules:

- Buttons remain the primary accessible controls; keyboard shortcuts are an
  enhancement.
- Show the shortcut hint near or inside the corresponding action.
- Ignore shortcuts while a server request is pending.
- Ignore held-key repeats.
- Ignore shortcuts when focus is inside an input, textarea, select, button, or
  editable element.
- Ignore shortcuts when `Alt`, `Ctrl`, `Meta`, or an unrelated modifier is
  pressed.
- `Space` must not scroll the page when it is used to reveal the card.

### 6. Scheduled Review Improvements

Extend the existing Review session without changing its scheduling algorithm or
database contract.

#### Review Keyboard Shortcuts

| Key | Action | Availability |
| --- | --- | --- |
| `Space` | Reveal translation and stop the recall timer | Front state only |
| `1` | Incorrect | Revealed state only |
| `2` | Correct | Revealed state only |
| `S` | Later | When at least two cards remain |

Use the same shortcut safety rules as the new-word study session.

#### `Later`

`Later` postpones the active card only within the currently loaded review
session.

- Move the active card to the end of the remaining queue.
- Do not submit a review result.
- Do not update the vocabulary item.
- Do not create review history.
- Do not change the next review date.
- Reset the reveal state and response timer when the card becomes active again.
- Do not increase completed progress.
- Disable `Later` when it is the only remaining card because rotating a
  one-item queue has no effect.

The review implementation should move from an index over an immutable initial
array to an explicit remaining queue. The original queue size remains available
for progress and completion copy.

### 7. Progress Semantics

New-word study:

- `total` is the number of eligible selected words loaded by the server;
- `completed` is the number successfully marked as learned;
- `remaining` is the current queue length;
- `Again` does not increase `completed`;
- progress is `completed / total`.

Scheduled review:

- `total` is the initial due queue size;
- `completed` is the number of successfully submitted review results;
- `remaining` is the current queue length;
- `Later` does not increase `completed`;
- progress is `completed / total`.

The first active card can therefore correctly show 0% completed. Completion
shows 100% only after the final server-confirmed result.

## UI And Design Constraints

This package is a functional extension of approved design baseline version 1.

Required constraints:

- Reuse the current page background, surface colors, typography, borders,
  shadows, radii, button patterns, badges, and responsive spacing.
- Reuse the focused one-card composition already established on Review.
- Keep translation hidden until reveal.
- Keep primary learning actions visually stronger than metadata.
- Use the existing mint direction for positive actions and peach direction for
  retry or incorrect actions.
- Preserve desktop sidebar, top bar, and mobile bottom navigation.
- Do not add a new navigation item for Study.
- Preserve light and dark themes.
- Preserve the existing Vocabulary page composition: input cards, study area,
  and collection card.
- Add only the minimum selection and session controls required by this package.
- Do not update `DESIGN_BASELINE.md`, its version, or its Git reference.
- Do not replace `public/og.png` or change site metadata for this functional
  package.

Suggested interface copy:

- Selection action: `Study selected`
- Study heading: `Learn the words you chose.`
- Reveal action: `Show translation`
- Retry action: `Again`
- Success action: `Learned`
- Review queue action: `Later`
- Exit action: `Finish for now`

Copy may be refined for clarity during implementation, but the interface
language must remain English and the meaning of each action must not change.

## Accessibility Requirements

- All selection controls have programmatic labels containing the English word.
- Every shortcut action is also available as a visible button.
- Disabled and pending states are communicated semantically, not only by color.
- Status and error messages use an appropriate live region without announcing
  the entire card on every minor state change.
- After a card transition, move focus to a stable card heading or announce the
  new active word without trapping focus.
- Revealing a translation makes the new content available to screen readers.
- Touch targets remain practical on mobile.
- Focus indicators remain visible in both themes.
- Motion, if any, must respect `prefers-reduced-motion` and remain within the
  existing restrained visual language.

## Data And Security Design

### No New Persistence Model

This package should be implemented with the current data model and existing
server mutations.

No new table, view, storage bucket, or durable study-session record is required.
No database migration is planned for this package.

Reuse:

- `vocabulary_items` for current group, stage, and next review date;
- `start_vocabulary_learning` for moving an owned word into `learning`, stage
  `0`;
- `mark_vocabulary_learned` for idempotently scheduling the first review;
- `submit_vocabulary_review` for scheduled review outcomes;
- the existing authenticated server-action boundary.

If implementation discovers that the existing action contract cannot safely
support the approved behavior, stop and update this specification before adding
a migration or broadening database privileges.

### Ownership And Authorization

- Treat all IDs received from the browser as untrusted.
- Load and mutate data only with an authenticated viewer.
- Keep explicit ownership enforcement in the database functions.
- Do not expose a service-role or secret key to the browser.
- Do not use user-editable metadata for authorization.
- Do not add direct client update or delete grants to `vocabulary_items`.
- Do not weaken or bypass existing RLS policies.
- Preserve current function execution grants: authenticated users only, with
  `PUBLIC` and `anon` denied where applicable.

### Idempotency And Concurrency

- Generate one submission ID per word being marked learned.
- Keep that ID stable across retries for the same UI action.
- Advance the client queue only after a confirmed server result.
- If an item becomes ineligible in another tab, handle the server response
  calmly and refresh or omit it rather than overwriting its newer state.
- Never derive a trusted stage, group, or due date in the browser.

## Error Handling

- Invalid or inaccessible IDs are omitted without exposing whether another
  user's record exists.
- An empty or fully ineligible selection shows a return path to Vocabulary.
- A failed start action keeps the current card and offers retry.
- A failed learned action keeps the revealed card and reuses its submission ID.
- A failed scheduled-review submission keeps the current revealed card and
  response time so the user can retry safely.
- Error copy must be calm, concise, and non-technical.
- Pending actions disable conflicting controls and keyboard shortcuts.

## Recommended Implementation Shape

Expected files:

```text
app/
  vocabulary/
    study/
      page.tsx                         # Authenticated server route and item load
components/
  vocabulary-workspace.tsx             # Eligible row selection and navigation
  vocabulary-study-session.tsx         # New client-side card session
  review-session.tsx                   # Queue rotation and shortcuts
lib/
  vocabulary/
    study-session.ts                   # Optional pure queue helpers
tests/
  vocabulary-study-session.test.ts     # Pure session/queue behavior
app/
  globals.css                          # Minimal baseline-compatible additions
```

`app/actions/vocabulary.ts` should reuse its existing actions unless a small
type-safe return-value improvement is required. A new dependency is not
expected.

Recommended implementation order:

1. Add and test pure queue operations for complete and rotate-to-end behavior.
2. Add eligible item selection to Vocabulary with the 10-item limit.
3. Add the authenticated `/vocabulary/study` server route.
4. Build the new-word study session with idempotent learned submissions.
5. Add study keyboard shortcuts and focus handling.
6. Refactor Review to an explicit remaining queue.
7. Add `Later` and review keyboard shortcuts.
8. Add minimal responsive styles using existing design tokens.
9. Run the complete verification set.

## Test Requirements

### Unit Tests

Cover at minimum:

- selected IDs are de-duplicated and capped at 10;
- selection order is preserved;
- `Again` moves the current word to the end of the queue;
- `Again` does not mark a word complete;
- `Learned` removes the current word after success;
- a failed learned request does not advance the queue;
- the final learned result produces completion;
- `Later` rotates a review queue with two or more remaining cards;
- `Later` does nothing or is unavailable for a one-card queue;
- `Later` does not increase completed progress;
- progress remains based on server-confirmed completions;
- shortcut mapping respects front, revealed, pending, repeated-key, modifier,
  and editable-target states.

Keep all existing CSV and spaced-repetition tests passing.

### Database Tests

No new database behavior is planned, but existing database tests remain
relevant. When a local Supabase environment is available, verify that:

- one learner cannot load or start another learner's selected word;
- marking a word learned remains idempotent;
- scheduled review history remains isolated by owner;
- review submission duplicate protection still works after the Review UI
  refactor.

Do not claim database or RLS verification if the local or remote Supabase test
environment is unavailable.

### Interaction Checks

Verify manually during implementation:

- desktop and mobile selection controls;
- the 10-word limit;
- front and revealed card states;
- repeated `Again` cycles;
- exit after partially completing a session;
- refresh after one or more words are learned;
- all study and review shortcuts;
- shortcut suppression inside interactive controls;
- `Later` with two cards and with one card;
- pending and error states;
- light and dark themes;
- visible focus and screen-reader labels.

Browser-driven visual QA is not part of this document-only task and should be
performed during implementation only when explicitly requested.

## Verification Commands

Run the commands that already exist in `package.json`:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

When a local Supabase instance is available:

```powershell
npm run test:db
```

If a command cannot run because an external service or local database is not
available, report that limitation honestly. Do not substitute an invented
verification command.

## Acceptance Criteria

This package is complete when all of the following are true:

- An authenticated learner can select 1 to 10 eligible vocabulary items.
- The learner cannot select an ineligible scheduled item.
- The server revalidates the selected IDs, ownership, eligibility, and limit.
- The selected words open in a focused study session in selection order.
- Translation remains hidden until explicitly revealed.
- `Again` returns a word to the end of the session without scheduling it.
- `Learned` schedules the word for the next local calendar day exactly once.
- A failed mutation never silently advances the session.
- Leaving preserves every result already confirmed by the server.
- The completion screen reports learned words and repeated attempts accurately.
- Study shortcuts work only in valid states and have visible button
  alternatives.
- Review shortcuts preserve the existing timer and correctness behavior.
- `Later` moves a review card to the end without writing a review or changing
  its schedule.
- Review progress is based on submitted results, not queue rotations.
- Existing repetition logic, review history, due ordering, and RLS behavior are
  unchanged.
- Desktop, mobile, light theme, and dark theme preserve the approved design.
- No unrelated writing-module or user work is changed.
- Tests, type checking, lint, and build pass; database verification is reported
  accurately according to environment availability.

## Out Of Scope

- Editing a word or translation.
- Deleting or archiving vocabulary.
- Sorting controls beyond the current collection order.
- Example sentences, notes, definitions, parts of speech, images, or audio.
- AI-generated vocabulary content.
- Automatic selection or a configurable number of cards per session.
- Persisting an unfinished study-session queue across devices or refreshes.
- Shuffling cards.
- Undoing an already submitted scheduled review.
- Changing the spaced-repetition thresholds or intervals.
- Changing daily target rules or the meaning of dashboard completion.
- Adding a Study navigation destination.
- Redesigning Vocabulary, Review, the application shell, or navigation.
- Updating the approved design baseline.
- Database schema changes, new policies, or broader table grants.
- Analytics, telemetry, notifications, billing, or deployment changes.

