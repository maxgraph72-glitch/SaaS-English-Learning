# Practice Exercise Bank — Stage Specification

## Status

- Created: 2026-08-20.
- This document is an implementation-ready plan for the first grammar-practice
  content stage.
- The repository currently contains a Next.js/TypeScript application, Supabase
  migrations, Vitest tests, and an authenticated application shell.
- This stage must reuse the existing application structure and the locked
  visual baseline in `DESIGN_BASELINE.md`. It does not approve a redesign.
- No source archive, exercise dataset, migration, route, or dependency is added
  by this document alone.

## Goal

Create a legally traceable, quality-controlled exercise bank that can support
daily grammar practice without copying protected exercises from commercial or
free-to-use teaching websites.

The first shipped package must let an authenticated learner complete short
Present Simple and Present Continuous exercises such as:

```text
She ___ from home every Friday. (work)
```

Accepted answer:

```text
works
```

```text
Look! The children ___ in the garden. (play)
```

Accepted answer:

```text
are playing
```

The content system must be reusable for later tense, vocabulary, listening,
speaking, word-order, and error-correction packages.

## Stage Outcome

This stage is complete when:

1. At least 800 exercises have been published: 500 Present Simple exercises,
   240 Present Continuous exercises, and 60 exercises contrasting the two
   tenses.
2. Every published exercise has a stored source, source item identifier,
   license, transformation record, and review status.
3. Every exercise has been reviewed by a human before publication.
4. Authenticated users can load published exercises and save their own
   attempts.
5. Browser clients cannot insert, update, or delete shared source content or
   exercises.
6. RLS, migration, unit, and critical practice-flow tests pass.
7. Source acknowledgements are visible inside the product.

## Scope

### Included

- A source and license registry.
- Import of English sentence candidates from approved open sources.
- Normalization, de-duplication, safety filtering, and grammar analysis.
- Generation of Present Simple, Present Continuous, and tense-contrast
  fill-in-the-gap exercises.
- Human editorial review before publication.
- A read-only shared exercise catalog.
- User-owned attempt history.
- A focused authenticated `/practice` route using the existing `AppShell`.
- Source acknowledgements and license metadata.
- Tests for generation, database constraints, RLS, and the learner flow.

### Not Included

- Scraping or copying exercises from teaching websites without an explicit
  reusable license.
- An automatic claim that an exercise has an official CEFR classification.
- AI-only publication without human review.
- Listening or speaking exercises using imported audio.
- Adaptive learning, spaced repetition for grammar, achievements, or billing.
- A public exercise-authoring interface.
- An admin dashboard; the first editorial workflow may use a local review file
  and a controlled import command.
- Changes to the existing visual system or navigation design.

## Approved Content Sources

### Tier 1 — Primary Sources

#### Mozilla Common Voice Scripted Speech

- Dataset page: <https://commonvoice.mozilla.org/en/datasets>
- Terms: <https://commonvoice.mozilla.org/terms>
- Sentence guidelines: <https://commonvoice.mozilla.org/en/guidelines>
- Required license for this stage: `CC0-1.0`.
- Intended use: modern sentence candidates; audio is out of scope for this
  package.
- Import only validated English sentence text and the stable source metadata
  provided by the downloaded release.
- Pin the release identifier and checksum in the import manifest.

#### Tatoeba CC0 Export

- Download page: <https://tatoeba.org/en/downloads>
- Required input: the separate `Sentences (CC0)` export.
- Intended use: short English sentence candidates and, where useful, linked
  translations.
- Do not mix the general CC BY export into the first package.
- Do not import audio in this stage because audio licenses vary by item.

### Tier 2 — Manually Selected Sources

#### VOA Learning English

- Content page: <https://learningenglish.voanews.com/p/6861.html>
- Intended use: manually selected modern, simplified contexts.
- Import only items explicitly covered by the Learning English public-domain
  statement.
- Exclude embedded or linked third-party material and retain the original URL
  and access date.
- Do not build an automated crawler in the first package.

### Reference Sources

- Open Textbook Library: <https://open.umn.edu/opentextbooks/>
- Open ELA (`CC0`):
  <https://open.umn.edu/opentextbooks/textbooks/1744>
- Advanced Academic Grammar for ESL Students (`CC BY`):
  <https://open.umn.edu/opentextbooks/textbooks/advanced-academic-grammar-for-esl-students>

Reference sources may guide exercise structure or provide individually reviewed
material when their item-level license permits commercial adaptation. Embedded
videos, images, readings, and other third-party components are not assumed to
inherit the book-level license.

## Prohibited And Restricted Sources

Do not copy exercises, answer keys, explanations, or collections from:

- British Council LearnEnglish;
- Cambridge, Oxford, Pearson, Murphy, or similar commercial publications;
- Perfect English Grammar, EnglishPage, or similar free practice sites;
- worksheets labelled only for personal or classroom use;
- PDFs, repositories, or datasets without a clear content license;
- any `CC BY-NC`, `CC BY-NC-SA`, or equivalent non-commercial source;
- any source whose license or attribution cannot be tied to an individual
  imported item or a pinned release.

Free access is not sufficient permission for SaaS reuse.

## License Policy

The first package should prefer `CC0-1.0` content so the exercise catalog has a
simple commercial-use posture.

| License | Package 1 decision | Requirement |
| --- | --- | --- |
| `CC0-1.0` | Approved | Preserve provenance even though attribution is not required. |
| Public domain | Approved after review | Record the source statement, URL, jurisdiction note, and access date. |
| `CC BY` | Deferred by default | Requires creator/source credit, license link, and change notice. |
| `CC BY-SA` | Deferred | Requires a product-level decision about licensing derivative exercise data. |
| Any `NC` license | Rejected | Not suitable for a commercial SaaS without separate permission. |
| Missing or unclear license | Rejected | Obtain permission or select another source. |

Before each dataset release:

1. Recheck the live source terms.
2. Save a plain-text license snapshot or immutable reference outside the raw
   exercise rows.
3. Record the source release, download date, checksum, and importer version.
4. Confirm that every exercise can be traced back to its imported candidate.
5. Review attribution copy before enabling the dataset in production.

This policy is an engineering safeguard, not a substitute for legal review.

## Content Package 1

### Topics

- `present_simple`
- `present_continuous`
- `present_simple_vs_continuous`

### Exercise Types

The initial 800-exercise package should contain:

| Type | Target count | Example |
| --- | ---: | --- |
| Present Simple: affirmative lexical verb | 250 | `He ___ early. (leave)` → `leaves` |
| Present Simple: negative form | 125 | `They ___ coffee. (not/drink)` → `do not drink`, `don't drink` |
| Present Simple: question form | 125 | `___ she work here? (do)` → `Does` |
| Present Continuous: affirmative form | 120 | `The children ___ now. (play)` → `are playing` |
| Present Continuous: negative form | 60 | `She ___ today. (not/work)` → `is not working`, `isn't working` |
| Present Continuous: question form | 60 | `___ they coming with us? (be)` → `Are` |
| Present Simple vs Continuous | 60 | `Look! It ___. (snow)` → `is snowing` |

The exact mix may move by no more than 10% during editorial review if a category
does not have enough unambiguous, high-quality candidates.

### Difficulty Mix

Use provisional internal labels:

- 60% `A1`;
- 30% `A2`;
- 10% `B1`.

These labels are product estimates, not official CEFR certifications. The
editor must consider sentence length, vocabulary, clause count, idioms, and the
grammar operation required from the learner.

### Candidate Rules

A candidate sentence must:

- contain 4–16 word tokens after normalization;
- be self-contained and understandable without a previous sentence;
- contain exactly one intended blank;
- have one unambiguous accepted answer set;
- use contemporary, neutral English suitable for an adult learner;
- retain normal capitalization and punctuation;
- avoid sensitive personal data, URLs, email addresses, and phone numbers;
- avoid slurs, explicit sexual content, graphic violence, and targeted abuse;
- avoid advertising, calls to action, and brand-dependent context;
- avoid unexplained proper names when a neutral noun or pronoun is available;
- avoid incomplete quotations, transcript fragments, and obvious transcription
  errors.

### Present Simple Rules

For affirmative lexical-verb items:

- the target must be a finite present-tense lexical verb;
- the stored lemma must be the base form;
- subject person and number must determine the answer;
- third-person singular spelling must be verified, including `-s`, `-es`, and
  consonant + `y` → `-ies`;
- irregular forms such as `has` and `does` must be stored explicitly;
- modal verbs and imperative clauses are excluded;
- ambiguous base-form sentences must be rejected rather than guessed.

For negative items:

- accept both contracted and full forms when both are grammatically valid;
- normalize apostrophe variants before comparison;
- the main lexical verb must remain in the base form after `do not` or `does
  not`;
- do not create a blank whose expected answer crosses unrelated clause
  boundaries.

For question items:

- limit the first package to unambiguous `Do`/`Does` formation;
- preserve the base form of the lexical verb;
- exclude subject questions such as `Who works here?`;
- exclude questions requiring contextual choice between multiple auxiliaries.

### Present Continuous Rules

For affirmative items:

- the expected form must contain the present-tense auxiliary `am`, `is`, or
  `are` plus a present participle;
- the auxiliary must agree with the explicit subject;
- the stored lemma must be the base lexical verb, not the `-ing` form;
- spelling must be verified for ordinary `-ing`, silent `e` removal, `ie` →
  `ying`, and consonant doubling where applicable;
- a spelling rule must not be applied automatically when stress or dialect
  makes doubling ambiguous; such items require an explicit reviewed form;
- exclude passive constructions and gerunds that are not part of a continuous
  verb phrase.

For negative items:

- accept both the full and standard contracted forms when the blank boundaries
  make both answers grammatically valid;
- support `am not`, `is not`/`isn't`, and `are not`/`aren't`;
- do not generate or accept non-standard `amn't`;
- the negative particle and present participle must remain part of the same
  intended answer span.

For question items:

- limit the first package to direct inversion of `am`, `is`, or `are` with an
  explicit subject;
- exclude indirect questions and questions whose correct auxiliary depends on
  missing context;
- if only the auxiliary is blanked, the visible sentence must already contain
  the present participle.

For tense-contrast items:

- the sentence must contain enough lexical or situational evidence to select
  Present Simple or Present Continuous without guessing;
- time expressions such as `always`, `now`, or `today` are signals, not proof by
  themselves;
- Present Simple should represent a routine, repeated event, stable state, or
  general fact;
- Present Continuous should represent an activity in progress or a clearly
  temporary current situation;
- avoid elementary continuous forms of stative verbs such as `know`, `believe`,
  `own`, `need`, and `understand` unless the reviewed context supports a valid
  dynamic meaning;
- reject sentences in which both tenses are plausible with different intended
  meanings;
- the explanation must identify the contextual signal and meaning, not merely
  repeat the correct tense name.

## Data Architecture

### Separation Of Trust Boundaries

Use two storage layers:

1. A non-exposed `private` schema for source registry data, raw sentence
   candidates, import runs, checksums, and editorial notes.
2. The exposed `public` schema for published exercises and user-owned attempts.

Raw source material must not be readable through the browser Data API. Shared
exercise content is read-only for application users. Attempts are owned by the
authenticated learner.

### Proposed Tables

#### `private.practice_content_sources`

- `id uuid primary key`
- `slug text unique not null`
- `name text not null`
- `homepage_url text not null`
- `license_code text not null`
- `license_url text not null`
- `terms_url text`
- `attribution_template text`
- `commercial_use_allowed boolean not null`
- `approved boolean not null default false`
- `approved_at timestamptz`
- `created_at timestamptz not null default now()`

#### `private.practice_import_runs`

- `id uuid primary key`
- `source_id uuid not null`
- `source_release text not null`
- `downloaded_at timestamptz not null`
- `archive_sha256 text not null`
- `importer_version text not null`
- `candidate_count integer not null`
- `rejected_count integer not null`
- `status text not null`
- `created_at timestamptz not null default now()`

#### `private.practice_sentence_candidates`

- `id uuid primary key`
- `source_id uuid not null`
- `import_run_id uuid not null`
- `external_id text not null`
- `language text not null default 'en'`
- `original_text text not null`
- `normalized_text text not null`
- `normalized_hash text not null`
- `license_code text not null`
- `source_url text`
- `source_creator text`
- `analysis jsonb not null default '{}'::jsonb`
- `screening_status text not null`
- `rejection_reasons jsonb not null default '[]'::jsonb`
- `created_at timestamptz not null default now()`
- unique constraint on `(source_id, external_id)`
- unique constraint on `(normalized_hash)` for exact normalized duplicates

#### `public.practice_exercises`

- `id uuid primary key`
- `candidate_id uuid not null`
- `content_version integer not null default 1`
- `exercise_type text not null`
- `grammar_topic text not null`
- `cefr_estimate text not null`
- `prompt text not null`
- `hint text`
- `lemma text`
- `accepted_answers jsonb not null`
- `distractors jsonb not null default '[]'::jsonb`
- `explanation text`
- `transformation jsonb not null`
- `license_code text not null`
- `source_credit text not null`
- `status text not null default 'draft'`
- `reviewed_by text`
- `reviewed_at timestamptz`
- `published_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`accepted_answers` must be a non-empty JSON array of normalized strings.
`status` must be one of `draft`, `in_review`, `rejected`, `published`, or
`retired`. Only `published` rows may be returned to learners.

#### `public.practice_attempts`

- `id uuid primary key`
- `submission_id uuid not null`
- `user_id uuid not null references auth.users (id) on delete cascade`
- `exercise_id uuid not null`
- `submitted_answer text not null`
- `is_correct boolean not null`
- `response_ms integer not null`
- `attempt_date date not null`
- `created_at timestamptz not null default now()`
- unique constraint on `(user_id, submission_id)` for retry protection

Index `(user_id, attempt_date desc, created_at desc)` and the foreign-key index
on `exercise_id`.

### Database Access Rules

- Enable RLS on every table in `public`.
- Do not expose the `private` schema through the Data API.
- Revoke all privileges on shared catalog tables from `anon`.
- Grant authenticated users only `SELECT` on `practice_exercises`.
- Add an authenticated `SELECT` policy limited to `status = 'published'`.
- Do not grant authenticated users `INSERT`, `UPDATE`, or `DELETE` on
  `practice_exercises`.
- Grant authenticated users only the attempt operations required by the real
  product flow.
- Attempt policies must use `TO authenticated` and explicit
  `(select auth.uid()) = user_id` ownership checks.
- If attempt updates are introduced, require both `USING` and `WITH CHECK` plus
  a corresponding `SELECT` policy.
- Never use `user_metadata` for authorization.
- Import and publication must run only through a trusted server or database
  maintenance role. No service-role key may enter browser code.
- Bundle explicit grants and RLS policies in the same migration. Supabase is
  moving new tables to opt-in Data API exposure, so code must not depend on
  historical automatic grants.

Relevant current documentation:

- <https://supabase.com/docs/guides/api/securing-your-api>
- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/changelog?types=breaking-change>

## Import And Generation Pipeline

### Repository Layout

Add during implementation:

```text
content/
  manifests/
    common-voice-<release>.json
    tatoeba-cc0-<date>.json
  review/
    present-tenses-package-1.jsonl
scripts/
  content/
    import-common-voice.ts
    import-tatoeba-cc0.ts
    normalize-sentences.ts
    generate-present-tenses.ts
    validate-package.ts
    publish-package.ts
lib/
  practice/
    types.ts
    answer-normalization.ts
    present-simple.ts
    present-continuous.ts
    tense-contrast.ts
    validation.ts
```

Raw downloaded archives must be ignored by Git. Commit only small manifests,
reviewed exercise records, source acknowledgements, and reproducible scripts.

### Pipeline Steps

1. Download a pinned source release outside the runtime application.
2. Calculate SHA-256 before processing.
3. Register the source, license, release, checksum, and importer version.
4. Import English candidates while retaining their external identifiers.
5. Normalize Unicode, whitespace, quotation marks, and apostrophes without
   changing sentence meaning.
6. Reject exact duplicates by normalized hash.
7. Apply safety and sentence-quality filters.
8. Analyze tokens, lemmas, parts of speech, subject agreement, and tense.
9. Generate only exercises that pass deterministic grammar rules.
10. Export candidates to a reviewable JSONL file.
11. Have an editor approve, correct, or reject every candidate.
12. Run package validation and duplicate checks.
13. Publish approved records in one controlled transaction.
14. Store the published package version and counts in the import audit trail.

The production application must never fetch Tatoeba, Common Voice, or VOA at
request time.

### Deterministic Generation First

The first package should use deterministic transformations for answer keys.
An AI model may propose a difficulty label, explanation, or distractors, but:

- AI output must never replace the deterministic accepted answer;
- all AI-produced text must pass schema validation;
- the provider and model must be recorded if AI output is retained;
- a human must review it before publication;
- an AI failure must not block importing or publishing exercises whose core
  fields were generated deterministically.

Do not add a new AI dependency if the existing server-side provider adapters
can support the optional enrichment step.

## Editorial Workflow

Each review record must show:

- original sentence and source;
- proposed learner prompt;
- lemma and accepted answers;
- detected subject and verb features;
- provisional CEFR estimate;
- license and attribution text;
- automated warning flags;
- reviewer decision and optional edit note.

Reviewer decisions:

- `approve` — publish without changes;
- `edit_and_approve` — save the edited form and transformation note;
- `reject` — retain the reason but do not publish;
- `needs_legal_review` — quarantine until the source is resolved.

Required rejection reasons include `ambiguous_answer`, `incorrect_grammar`,
`missing_context`, `unsafe_content`, `personal_data`, `duplicate`,
`unnatural_english`, `level_mismatch`, and `license_unclear`.

## Learner Experience

### Route

Create an authenticated route at:

```text
/practice
```

The route must reuse the current application shell, typography, colors,
spacing, controls, and responsive behavior. It must not establish a new design
baseline.

### Session Behavior

- Load a session of 10 published exercises.
- Do not repeat an exercise already answered in the current session.
- Prefer exercises the user has never attempted; then prefer previously
  incorrect exercises.
- Show one exercise at a time.
- Let the learner submit with a visible button or `Enter` when focus is in the
  answer field.
- Disable duplicate submission while a request is pending.
- Compare answers after Unicode, whitespace, case, and approved apostrophe
  normalization.
- Do not silently accept a different grammatical structure solely because it
  is semantically similar.
- After submission, show the correct answer and a concise explanation.
- Save the attempt with a stable client-generated `submission_id`.
- On persistence failure, keep the current exercise and allow a safe retry with
  the same submission ID.
- Show session progress and a completion summary.

### Accessibility

- Every blank must have an accessible label that includes the instruction and
  sentence context.
- Correctness must not be communicated by color alone.
- Feedback must be announced through an appropriate live region.
- Keyboard submission must not interfere with normal form editing.
- Focus must move predictably after feedback and when the next item loads.

## Implementation Packages

### Package A — Provenance And Database Foundation

- Create migrations using `npx supabase migration new <name>`; do not invent a
  migration timestamp manually.
- Add private source/import/candidate tables.
- Add public exercise and attempt tables with constraints and indexes.
- Add explicit grants and RLS policies.
- Add SQL tests for shared catalog access and attempt ownership.

Deliverable: an empty but secure exercise-bank schema.

### Package B — Importers And Generator

- Add source manifests and ignored raw-download locations.
- Implement Common Voice and Tatoeba CC0 importers.
- Implement normalization, hashing, filters, and deterministic generation for
  Present Simple, Present Continuous, and their contrast.
- Add fixtures and deterministic unit tests.
- Produce the first review JSONL package.

Deliverable: reproducible draft candidates with complete provenance.

### Package C — Editorial Review And Seed Publication

- Review at least 800 exercises in the required topic distribution.
- Validate answer keys, difficulty estimates, safety, and licenses.
- Publish the approved package transactionally.
- Generate the product acknowledgement content.

Deliverable: versioned `present-tenses-package-1` production content.

### Package D — Learner Practice Flow

- Add `/practice` server loading.
- Add the focused exercise session and answer feedback.
- Add idempotent attempt persistence.
- Add unit and critical flow tests.
- Add the source acknowledgement link without changing the approved design.

Deliverable: authenticated end-to-end practice for Present Simple, Present
Continuous, and their contrast.

### Package E — Controlled Production Rollout

- Deploy schema before application code.
- Import content using a trusted maintenance environment.
- Verify package counts and source credits in production.
- Enable the route for the project owner first.
- Observe errors, completion rate, and rejected-answer reports.
- Expand availability only after the acceptance checks pass.

Deliverable: stable production release with a rollback path.

## Verification Plan

### Unit Tests

- regular third-person singular formation;
- `-es` and consonant + `y` spelling;
- irregular `have` → `has` and `do` → `does`;
- negative full and contracted answers;
- `Do`/`Does` question formation;
- `am`/`is`/`are` subject agreement;
- regular `-ing`, silent `e`, `ie` → `ying`, and reviewed consonant-doubling
  forms;
- Present Continuous negative full and contracted answers;
- Present Continuous question inversion;
- rejection of gerunds and passive forms incorrectly detected as continuous;
- rejection of ambiguous Present Simple vs Present Continuous contrasts;
- answer normalization without over-acceptance;
- duplicate hashing;
- rejection of ambiguous and malformed candidates;
- validation of required source and license fields.

### Database Tests

- `anon` cannot read shared exercises or attempts;
- authenticated users can read only published exercises;
- authenticated users cannot mutate shared exercises;
- a user can insert and read only their own attempts;
- a user cannot assign an attempt to another `user_id`;
- a user cannot read another user's attempts;
- duplicate submission IDs are idempotently rejected or returned;
- private source tables are unavailable through the Data API;
- foreign keys, checks, and status transitions reject invalid records.

### Application Tests

- unauthenticated `/practice` access follows the existing login behavior;
- a ten-item session loads and completes;
- correct and incorrect feedback are distinguishable without color alone;
- double submission is prevented;
- a failed write can be retried without creating a duplicate attempt;
- retired or draft exercises are never served;
- source acknowledgements are reachable.

### Commands

Use only the scripts currently present in `package.json`:

```text
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
```

Before using the Supabase CLI, inspect the installed command surface with
`npx supabase --help` and the relevant subcommand `--help`.

## Quality Gates

The package cannot ship unless:

- published exercise count is at least 800 and matches the required topic
  distribution within the allowed 10% editorial tolerance;
- 100% of published exercises have provenance and a reviewed license;
- 100% have a human reviewer decision;
- 0 published exercises have unresolved license or safety flags;
- 0 exact normalized duplicates exist;
- a manual audit of at least 100 random published exercises finds at least 98%
  fully correct prompts, answers, and explanations;
- every audit error is corrected and its affected generation rule is reviewed;
- all relevant automated tests pass;
- no source archive, secret, service-role key, or `.env` value is committed.

## Observability And Feedback

Track only product data necessary to improve the exercise bank:

- exercise completion count;
- correct/incorrect outcome;
- response time;
- learner-reported answer problem;
- content version and exercise ID.

Do not add third-party analytics or telemetry in this stage. A learner report
must never directly change the accepted answer; it creates an editorial review
item. Retiring a defective exercise must not delete historical attempts.

## Rollback Plan

- Treat each published content package as an immutable version.
- Roll back content by marking the affected package or exercises `retired`.
- Do not delete attempt history during rollback.
- Keep the previous application path functional if `/practice` is disabled.
- Roll back application code independently from content records.
- Use forward database migrations for schema corrections; do not use
  destructive Git or database resets in production.

## Future Packages

After this stage is stable, the same system can add:

1. Past Simple regular and irregular verbs.
2. Articles, prepositions, pronouns, and subject–verb agreement.
3. Sentence ordering and error correction.
4. Audio-backed listening exercises from separately verified licenses.
5. Grammar review scheduling based on attempt history.
6. A controlled editorial interface with role-based authorization.

Each future package must have its own deterministic rules, license review,
quality audit, and versioned publication record.

## Definition Of Done

The stage is done only when the secure schema, reproducible import pipeline,
reviewed 800-exercise Present Tenses package, learner practice flow,
acknowledgements, and all verification steps are complete. Creating the schema
without reviewed content, or generating content without provenance and RLS
verification, does not complete the stage.
