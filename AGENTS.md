# AGENTS.md

## Project Description

This repository is intended to become a SaaS product for daily English learning.

The product plan from Obsidian describes a clean, minimal interface for studying English every day. Planned learning modules include:

- Vocabulary flashcards.
- AI text checking.
- Speaking practice with pronunciation feedback.
- Spaced repetition.
- Daily learning blocks: 10 minutes of cards, 10 minutes of speaking, 10 minutes of diary writing, and 5 minutes of review.
- CEFR progress from A1 to C2.
- Weekly statistics, weekly achievements, monthly comparison with the user's past level, motivation phrases, light/dark themes, and configurable heavy/light learning days.

Current source of the product plan:

- The user's Obsidian vault, in `Obsidian Vault/Project` outside this repository.

## Current Repository State

At the time of this analysis, the project root is:

- `SaaS English`

The root directory contains no application code yet. There is no detected frontend, backend, database schema, or deployment configuration in this repository.

Important current facts:

- No `package.json` was found.
- No lockfile was found.
- A `.git` directory exists, but `git status` reports that this is not a valid Git repository.
- A `.agents` directory may exist as local Codex metadata; it is not app source.
- No app source folders were found.
- No Supabase config or migrations were found.
- This `AGENTS.md` file is the first project documentation file in the root.

## Real Stack

No implemented application stack is currently detectable from the repository.

Planned stack signals from the Obsidian notes:

- Supabase is planned as the data storage layer.
- AI-assisted text checking is planned.
- AI-assisted speaking/pronunciation checking is planned.

Do not describe the project as Next.js, React, Vite, Supabase, Tailwind, Stripe, OpenAI, or any other stack until the relevant files, dependencies, and configuration exist in the repository.

## Folder Structure

Current structure:

```text
SaaS English/
  .agents/   # Local Codex metadata, not app source.
  .git/      # Present, but not a valid Git repository at analysis time.
  AGENTS.md
```

The Obsidian vault is not part of the app source tree. Treat it as planning material unless the user explicitly asks to migrate notes into the repository.

## Commands

No project commands are currently available because there is no `package.json` or other build configuration.

Current command status:

- Install: none detected.
- Development server: none detected.
- Build: none detected.
- Lint/check: none detected.
- Test: none detected.
- Deploy: none detected.

Rules for future command documentation:

- Only document commands that actually exist in project files.
- If a command is not present in `package.json`, do not invent it.
- When a package manager is introduced, infer it from the committed lockfile.
- If multiple package manager artifacts appear, stop and ask which one should be canonical.

## Code Work Rules

- Do not change application architecture without a clear reason tied to the task.
- Prefer the existing framework, folder layout, naming conventions, and helper APIs once they exist.
- Keep changes scoped to the user request.
- Do not add dependencies unless they are necessary and the reason is explained.
- Do not create large abstractions before the product shape requires them.
- Do not change the site's existing design, visual system, layout, styling, or overall look and feel without the user's explicit prior approval.
- For UI work, keep the SaaS interface clean, focused, and practical rather than decorative.
- For learning features, preserve the product intent: daily practice, measurable progress, and low-friction repetition.
- Keep Obsidian planning notes separate from app code unless the task explicitly asks to import or sync them.

## Git Rules

- A `.git` directory is present, but `git status` currently reports that this folder is not a valid Git repository.
- Treat Git as unavailable until repository initialization is fixed or confirmed by the user.
- If Git is initialized later, check `git status` before editing.
- Never overwrite, revert, or delete user changes unless the user explicitly asks.
- Do not use destructive commands such as `git reset --hard` or `git checkout --` without explicit user approval.
- Do not commit unless the user asks for a commit.
- When committing is requested, summarize the actual changed files and avoid bundling unrelated changes.

## Security Rules

- Do not read, print, modify, or commit `.env` files or secrets.
- Do not expose API keys, service-role keys, tokens, cookies, or private URLs in logs or final answers.
- Keep server-only credentials out of browser-exposed code.
- Treat any AI provider keys, Supabase service keys, Stripe keys, and OAuth secrets as sensitive.
- Do not add telemetry, analytics, or external network calls without explaining the reason.

## Supabase And Environment Rules

Supabase is planned but not implemented in this repository yet.

When Supabase is introduced:

- Keep Supabase URL and publishable client key in environment variables.
- Never expose the Supabase service role key in frontend code.
- Do not edit `.env` files directly unless the user explicitly requests it.
- Provide `.env.example` entries for required variables, but never include real secret values.
- Put database changes in migrations once a Supabase project structure exists.
- Do not invent migration filenames manually; use the Supabase CLI migration command if the CLI is part of the project workflow.
- Enable RLS for tables in exposed schemas and write policies that match the real ownership/access model.
- Do not use `user_metadata` for authorization decisions.
- Prefer `TO authenticated` plus explicit row ownership checks in RLS policies.
- For update policies, include both `USING` and `WITH CHECK` where ownership must be preserved.
- Be careful with views and privileged functions because they can bypass RLS.

Before implementing Supabase features, verify current Supabase docs or project-local conventions rather than relying on memory.

## Comparison With Obsidian Plan

The Obsidian plan describes a SaaS learning product, but the repository does not yet contain implementation for it.

Planned but not implemented yet:

- User accounts.
- Database storage.
- Vocabulary upload and classification.
- Flashcards.
- Spaced repetition.
- AI text checking.
- Speaking/pronunciation checking.
- Daily lesson flow.
- CEFR level tracking.
- Weekly statistics.
- Weekly achievement summary.
- Monthly comparison with past progress.
- Motivation phrases.
- Light/dark theme switching.
- Heavy/light learning day configuration.
- Subscription, billing, or SaaS access control.

Contradiction to keep in mind:

- The plan says data should be stored in Supabase, but the repository currently has no Supabase configuration, schema, client, migrations, or environment template.

## Definition Of Done

A task is complete only when:

- The requested behavior or document change is implemented.
- The change is limited to the requested scope.
- Relevant commands have been run if they exist.
- Missing commands are reported honestly instead of substituted with guessed commands.
- No secrets or `.env` contents were exposed.
- The final response explains what changed and what could not be verified.

## Final Response Checklist For Codex

Before sending the final answer, Codex should check:

- Did I modify only files that the task required?
- Did I avoid touching `.env` and secrets?
- Did I check for `package.json` before naming npm scripts?
- Did I distinguish implemented code from the Obsidian plan?
- Did I mention any missing commands or missing repo setup?
- Did I run available verification commands, or explain why none exist?
- Did I avoid claiming a stack that is not present in the repository?
- Did I avoid overwriting user changes?

## Stack Selection Rules

The repository still has no implemented stack until real project files are added. Treat the choices below as the preferred stack direction for the first implementation, not as current repository facts.

When the user asks to scaffold or implement the application, prefer this stack unless there is a clear reason to choose otherwise:

- Use Next.js with TypeScript and the App Router as the main application framework.
- Keep frontend pages, dashboard UI, and server-side API routes in one application at the MVP stage.
- Use Supabase for authentication, Postgres data storage, and file storage for user audio.
- Use server-only routes or server actions for AI calls. Never expose AI provider keys in browser code.
- Use Tailwind CSS, shadcn/ui-style components, lucide-react icons, and next-themes for a clean light/dark SaaS interface.
- Use react-hook-form and zod for forms, validation, and typed request/response boundaries.
- Use Recharts or a similarly lightweight charting library for weekly statistics and progress views.
- Use Vitest for core learning logic such as spaced repetition and progress calculations.
- Use Playwright for critical user flows once the app has real screens.
- Defer Stripe or other billing integrations until subscription rules and access limits are explicitly requested.

Avoid these choices at the MVP stage unless the user explicitly asks for them or the product requirements change:

- Do not add a separate backend service such as Express, NestJS, or FastAPI before the Next.js server layer is insufficient.
- Do not add Prisma, Drizzle, or another ORM before Supabase migrations, generated types, and SQL conventions are established.
- Do not add Redux or a global state framework before local state, URL state, and server state become insufficient.
- Do not introduce queues, microservices, background workers, or complex infrastructure before there is a real operational need.
- Do not add analytics, telemetry, payments, or third-party integrations without explaining the reason and data flow.

When dependencies are introduced:

- Choose one package manager based on the first committed lockfile.
- Pin dependencies through the lockfile.
- Document only scripts that actually exist in `package.json`.
- Keep `.env.example` limited to variable names and safe placeholder values.
- Continue to distinguish planned stack decisions from implemented repository facts.

## MVP Structure

The MVP should focus on one daily English learning loop before broader SaaS features. The first product version should make it possible for a user to sign in, study vocabulary, practice speaking, write a short diary entry, receive AI feedback, and see simple progress.

Recommended MVP product modules:

- Authentication and user profile.
- Daily learning dashboard.
- Vocabulary list upload or manual entry.
- Flashcards and spaced repetition review.
- AI text checking for diary writing.
- Speaking practice with a short generated prompt and recorded user answer.
- Basic CEFR progress estimate from A1 to C2.
- Weekly statistics: total study time, peak activity, average session length, learned words, and progress toward the next level.
- Light/dark theme switching.
- Heavy/light learning day settings.

Recommended MVP application folders once a Next.js project is created:

```text
src/
  app/
    (auth)/
    (app)/
      dashboard/
      vocabulary/
      review/
      writing/
      speaking/
      progress/
      settings/
    api/
      ai/
      speaking/
      writing/
  components/
    ui/
    layout/
    learning/
    charts/
  lib/
    supabase/
    ai/
    learning/
    validation/
  styles/
```

Recommended MVP data areas:

- `profiles`: user display data, current CEFR estimate, and onboarding state.
- `user_settings`: theme preference, heavy/light learning days, and daily learning targets.
- `vocabulary_items`: user-owned words, translations, examples, status group, and timestamps.
- `vocabulary_reviews`: review attempts, response time, result, and next review date.
- `daily_sessions`: daily study blocks, durations, completion state, and session date.
- `writing_entries`: diary text submitted by the user.
- `writing_feedback`: AI corrections, explanations, score, and detected recurring mistakes.
- `speaking_prompts`: generated five-sentence speaking prompts.
- `speaking_attempts`: recorded audio metadata, transcript, pronunciation feedback, and score.
- `progress_snapshots`: periodic CEFR/progress values for weekly and monthly comparison.
- `weekly_achievements`: generated weekly summary, learned words, peak activity, level progress, and motivation phrase.

Supabase implementation rules for the MVP:

- Every user-owned table must include a stable `user_id` ownership column.
- Enable RLS on user-facing tables before exposing them to client code.
- Use `TO authenticated` policies with explicit ownership checks.
- For updates, include both `USING` and `WITH CHECK` when ownership must be preserved.
- Store user audio in Supabase Storage with access policies tied to the owning user.
- Keep service-role access server-only and never expose it in frontend code.
