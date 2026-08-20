# Daily English

Daily English is an early MVP for a focused English-learning routine. The current implementation includes user-owned vocabulary, spaced repetition, Writing feedback, and short Speaking practice.

## Implemented

- Supabase email/password authentication with cookie-based SSR sessions and optional Google sign-in.
- User-owned vocabulary with case-insensitive duplicate protection.
- Manual vocabulary entry and Google Sheets-compatible CSV import.
- Intake, learning, weak, repeat, and known groups.
- Five repetition stages with 1, 2, 3, 7, and 30-day calendar intervals.
- Timed review cards, immutable review history, and idempotent submissions.
- Due and overdue queue ordering by due date and group priority.
- Daily vocabulary/review block states, including skipped blocks.
- Daily diary writing with server-side structured Yandex AI feedback and safe retry handling.
- Five-sentence Speaking practice with browser recording, private Supabase Storage, Yandex SpeechKit transcription, and explainable feedback.
- Speaking recordings are mono 16 kHz PCM, limited to 28 seconds and 1 MB for synchronous recognition.
- Real due counts on the responsive dashboard.
- Light and dark themes.

## Supabase setup

1. Copy the public variable names from `.env.example` into a local `.env.local` file and provide values from the Supabase project settings.
2. Apply every file in `supabase/migrations` in order through the normal Supabase CLI migration workflow.
3. If Google sign-in is required, enable the Google Auth provider, add `/auth/callback` to the allowed redirect URLs, and set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
4. For Writing and Speaking, configure the Yandex variables shown in `.env.example`. The service-account API key must be allowed to call both AI Studio and SpeechKit STT.

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

The Speaking score measures transcript completeness, recognized-word match, and pace. It is practical learning feedback, not a phoneme-level pronunciation assessment or official CEFR result.
