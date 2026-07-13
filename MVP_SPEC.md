# MVP_SPEC.md

## Purpose

This document describes the first MVP for the daily English learning SaaS.

The MVP is primarily for the owner of the project, but it should be built with user-owned data from the beginning so it can later support multiple users without rewriting core storage and access rules.

The MVP should help a user study English every day through one clear learning loop:

1. Vocabulary cards.
2. Speaking practice.
3. Diary writing.
4. Review.

The product should feel clean, focused, and practical. Avoid a busy interface, decorative complexity, and broad SaaS features that do not help the daily learning loop.

## Target User

Primary MVP user:

- The project owner.

Future users:

- Multiple individual learners, each with their own account, vocabulary, study history, audio recordings, writing entries, progress, and settings.

Important implication:

- Even if the first version is used by one person, all user data should be modeled as user-owned data.

## Authentication

The MVP should include registration and login because the app needs to store personal learning data.

Required login methods:

- Google login.
- Email and password.

Authentication requirements:

- Each user must have a profile.
- User learning data must belong to a specific authenticated user.
- The frontend must never receive service-role keys or server-only secrets.
- Supabase Auth is the preferred authentication layer once the app is implemented.

## MVP Screens

The first version should include these app screens:

- `Dashboard`
- `Vocabulary`
- `Review`
- `Writing`
- `Speaking`
- `Progress`
- `Settings`

Do not build a public marketing landing page for the MVP unless the user explicitly asks for it later.

## Daily Learning Flow

The daily lesson should keep this order:

1. 10 minutes: vocabulary cards.
2. 10 minutes: speaking.
3. 10 minutes: diary writing.
4. 5 minutes: review.

The dashboard should show the daily flow as the main product surface.

Daily flow requirements:

- Show the current step.
- Show completed and remaining steps.
- Track time spent in each block.
- Save completion state for the current day.
- Allow the user to resume the day if they leave and come back.
- Keep the flow simple; do not overload it with many settings or secondary actions.

## Vocabulary

The user should be able to add vocabulary in two ways:

- Import from Google Sheets.
- Add words manually inside the app.

Google Sheets import format:

- First column: English word.
- Second column: translation.
- Additional columns should be ignored in the MVP unless explicitly added later.

Important implementation note:

- Direct import from private Google Sheets requires Google Sheets API access and OAuth scopes beyond a basic login flow.
- For the first implementation, choose the simplest working approach that still matches the product goal, such as importing from a Google Sheets CSV export URL, a published sheet URL, or a user-uploaded CSV exported from Google Sheets.
- If direct private Google Sheets import is implemented, document the required Google OAuth scopes and keep tokens secure.

Manual vocabulary entry:

- The user can add one word and one translation.
- Optional example sentences can be added later, but they are not required for the first MVP.

Vocabulary groups:

- `known`: the user answers in under 3 seconds.
- `repeat`: the user answers in 3 to 5 seconds.
- `weak`: the user answers in 5 to 10 seconds.
- `unknown`: the user has not learned the word yet.
- `learning`: the user selected the word for memorization.

Vocabulary behavior:

- Imported words start as `unknown` unless the user marks them otherwise.
- Words selected for study move to `learning`.
- Review results and response time can update the word group.
- Spaced repetition should prioritize `learning`, `repeat`, and `weak` words.

## Review And Spaced Repetition

The MVP should include a simple spaced repetition system.

Review requirements:

- Show a word card.
- Let the user reveal the translation.
- Track whether the answer was correct.
- Track approximate response time.
- Schedule the next review date.
- Update the vocabulary group based on result and response time.

The first implementation can use a simple local algorithm. It does not need to implement a complex memory model before the product shape is validated.

## Writing

The Writing screen is for diary practice.

User action:

- The user writes a short diary entry in English.

AI feedback should include:

- Corrected version.
- List of mistakes.
- Explanation for each mistake.
- Estimated level for the submitted text.
- Recurring mistake patterns when enough history exists.

MVP behavior:

- Save the original text.
- Save AI feedback.
- Show feedback in a calm, readable format.
- Make the corrected text easy to compare with the original.
- Do not expose AI provider keys in browser code.

## Speaking

The Speaking screen is for spoken English practice.

MVP task:

- Show a generated short text of about five sentences.
- The user records their voice while reading or retelling it.
- The system transcribes the recording.
- The system gives a general speaking score and practical feedback.

MVP feedback should include:

- Transcript.
- General score.
- Short explanation of what was good.
- Short explanation of what needs improvement.
- Optional notes about fluency, completeness, and clarity.

Important scope note:

- The MVP does not need deep phoneme-level pronunciation assessment.
- If precise pronunciation scoring is required later, add a specialized pronunciation assessment provider behind a server-side adapter.

Audio requirements:

- User audio should be stored as user-owned data.
- Supabase Storage is the preferred storage layer once Supabase is implemented.
- Access to audio files must be restricted to the owning user.

## Progress And CEFR

The app should track progress from A1 to C2.

The MVP should start with an entrance level test so the user has a starting point.

Entrance test requirements:

- Estimate the user's starting CEFR level.
- Include vocabulary knowledge.
- Include basic writing ability.
- Optionally include a short speaking task if the first implementation can support it without slowing the MVP too much.

Progress model:

- Progress should increase based on learned vocabulary, review quality, writing quality, and speaking quality.
- Vocabulary should be a major part of the progress score, but not the only part.
- Practical skills from writing and speaking should also contribute.

Initial vocabulary reference points:

- A1 vocabulary target: about 500 to 1000 known words.
- A2 vocabulary target: about 1500 to 2000 known words.

For levels above A2:

- Keep thresholds configurable and refine them later.
- Do not hard-code questionable CEFR assumptions without documenting them.

Progress UI:

- Show the current estimated level.
- Show progress toward the next level, for example `A1 -> A2`.
- Show which factors contributed to progress: vocabulary, writing, speaking, and review consistency.

## Dashboard

The Dashboard should be the first useful screen after login.

Dashboard should show:

- Today's learning flow.
- Current CEFR estimate.
- Progress toward the next level.
- Words due for review.
- Today's completed blocks.
- A short motivation phrase.

Dashboard should not be a marketing page.

## Statistics And Achievements

The MVP should include simple weekly statistics.

Weekly statistics:

- Total study time.
- Peak activity.
- Average session length.
- Learned words.
- Progress toward the next level.

Weekly achievements:

- Short weekly summary.
- Number of learned words.
- Peak activity.
- Progress toward the next level.
- Motivation phrase.

Monthly comparison:

- Planned for later.
- The data model should preserve enough snapshots to support it later.

## Settings

Settings should include:

- Interface language.
- Light/dark theme.
- Heavy/light learning day configuration.
- Account-related settings if needed.

Language behavior:

- Interface language should be switchable.
- The MVP should support a mixed Russian/English product direction, but the implementation should make future localization possible.

Theme behavior:

- Support light and dark themes.
- Use the palette from the project notes as inspiration, but adapt it if needed for readability and accessibility.

Heavy/light days:

- The user can configure which days are heavier and which are lighter.
- Light days should reduce the expected study load while preserving the learning habit.

## Data Areas

Recommended MVP data areas:

- `profiles`: user display data, current CEFR estimate, onboarding state, and active language preference.
- `user_settings`: theme preference, heavy/light learning days, daily learning targets, and notification preferences if added later.
- `vocabulary_items`: user-owned words, translations, examples, status group, source, and timestamps.
- `vocabulary_reviews`: review attempts, response time, correctness, result, and next review date.
- `daily_sessions`: daily study blocks, durations, completion state, and session date.
- `writing_entries`: diary text submitted by the user.
- `writing_feedback`: AI corrections, explanations, score, estimated level, and recurring mistake tags.
- `speaking_prompts`: generated five-sentence speaking prompts.
- `speaking_attempts`: audio metadata, transcript, general speaking feedback, score, and prompt relation.
- `progress_snapshots`: periodic level estimates, vocabulary count, writing score, speaking score, and review consistency.
- `weekly_achievements`: generated weekly summary, learned words, peak activity, level progress, and motivation phrase.

Data ownership rules:

- Every user-owned table must have a stable `user_id`.
- User data must not be visible to other users.
- RLS should be enabled for user-facing tables when Supabase is implemented.
- Update policies must preserve ownership.

## AI Boundaries

AI is part of the MVP, but the app should stay usable and understandable.

AI should be used for:

- Text correction.
- Text explanations.
- Estimated writing level.
- Speaking transcription.
- General speaking feedback.
- Short speaking prompt generation.
- Weekly achievement wording if useful.

AI should not be used for:

- Authorization decisions.
- Hidden grading rules that cannot be explained to the user.
- Replacing all deterministic progress logic.

AI implementation requirements:

- AI calls must run server-side.
- AI provider keys must never be exposed to the browser.
- Store structured AI results where possible.
- Keep prompts and response schemas versioned in code once implementation begins.

## Not In MVP

Do not build these in the MVP:

- Payments.
- Subscriptions.
- Public landing page.
- Complex analytics.
- Mobile application.
- Team accounts.
- Admin panel.
- Marketplace or public content sharing.
- Full pronunciation assessment with phoneme-level scoring.
- Complex notification system.

These can be revisited after the daily learning loop works.

## Acceptance Criteria

The MVP is considered product-complete when:

- A user can register or log in.
- A user can add vocabulary manually.
- A user can import vocabulary from a Google Sheets-compatible source.
- A user can complete the daily flow in the intended order.
- A user can review vocabulary cards and have review results saved.
- A user can write a diary entry and receive AI feedback.
- A user can record speaking practice, receive a transcript, and see general feedback.
- A user can see current level, progress toward the next level, and basic weekly stats.
- A user can switch interface language and theme.
- User data is stored per user and protected from other users.

## Open Questions

These questions do not block the first specification, but they should be resolved before or during implementation:

- Should Google Sheets import use a public/published sheet URL, CSV upload, or direct private Google Sheets API access?
- Should the entrance level test include speaking in the first implementation or start with vocabulary and writing only?
- What exact scoring weights should be used for vocabulary, writing, speaking, and consistency?
- Which interface languages should be fully supported first: Russian, English, or both?
- Should daily timers be strict timers or soft suggested durations?
- Should the user be able to skip a daily block without breaking the daily session?
