# Daily English

Daily English is an early MVP for a focused English-learning routine. The current implementation includes the complete user-owned vocabulary and spaced-repetition loop.

## Implemented

- Supabase email/password and Google authentication with cookie-based SSR sessions.
- User-owned vocabulary with case-insensitive duplicate protection.
- Manual vocabulary entry and Google Sheets-compatible CSV import.
- Intake, learning, weak, repeat, and known groups.
- Five repetition stages with 1, 2, 3, 7, and 30-day calendar intervals.
- Timed review cards, immutable review history, and idempotent submissions.
- Due and overdue queue ordering by due date and group priority.
- Daily vocabulary/review block states, including skipped blocks.
- Real due counts on the responsive dashboard.
- Light and dark themes.

## Supabase setup

1. Copy the public variable names from `.env.example` into a local `.env.local` file and provide values from the Supabase project settings.
2. Apply `supabase/migrations/20260713134023_vocabulary_spaced_repetition.sql` through the normal Supabase CLI migration workflow.
3. Enable the Google Auth provider in the Supabase dashboard and add `/auth/callback` to the allowed redirect URLs if Google sign-in is required.

The application uses a publishable browser key only. Do not put a secret or service-role key in a `NEXT_PUBLIC_` variable.

## Local development

The project uses the npm lockfile in this repository.

```bash
npm install
npm run dev
```

Available checks:

```bash
npm test
npm run test:db
npm run typecheck
npm run lint
npm run build
```

`npm run test:db` requires a running local Supabase stack (and therefore Docker).
