# Practice exercise bank — controlled rollout

No step in this document has been run against a remote database.

## 1. Acquire and pin real CC0 inputs

Current status: the English-only Tatoeba CC0 weekly export dated 2026-08-15 was
downloaded on 2026-08-20, checksummed, and recorded in
`content/manifests/tatoeba-cc0-english-2026-08-15.json`. Common Voice English
25.0 remains unavailable to this automated workflow because Mozilla requires a
signed-in account, prior terms acceptance, and an authenticated download; the
full archive is also 87.84 GB. No placeholder Common Voice data is used.

1. Download Common Voice Scripted Speech English from the approved release and
   extract the validated TSV under ignored `content/raw/`.
2. Download only Tatoeba's separate `Sentences (CC0)` weekly export, filter it
   to English if needed, and place the TSV under ignored `content/raw/`.
3. Calculate SHA-256 for each exact input and create non-fixture manifests in
   `content/manifests/` with release, download timestamp, checksum, license,
   terms URL, and importer version.
4. Recheck the live source terms and update the eligibility snapshot.

## 2. Generate the review queue

For the currently acquired Tatoeba source, run the generator and balanced
selector with explicit paths:

```text
node --experimental-strip-types scripts/content/generate-present-tenses.ts \
  --tatoeba content/raw/tatoeba-sentences-cc0.tsv \
  --tatoeba-manifest content/manifests/tatoeba-cc0-YYYY-MM-DD.json \
  --output content/raw/present-tenses-tatoeba-candidates.jsonl

node --experimental-strip-types scripts/content/select-package.ts \
  content/raw/present-tenses-tatoeba-candidates.jsonl \
  content/review/present-tenses-package-1.jsonl
```

The generator refuses to overwrite a file that already contains human review
decisions.

## 3. Human review and audit

1. Review every record, preserving the real reviewer identity and timestamp.
2. Reach at least 800 approved exercises within the topic tolerances.
3. Resolve every license and safety warning.
4. Audit at least 100 random approved records and reach at least 98% correctness.
5. Correct every audit error and inspect the corresponding generation rule.
6. Run `npm run content:validate`, then `npm run content:publish`.

The publication command only writes transaction-wrapped SQL to ignored
`content/publish/`. It does not connect to Supabase.

## 4. Owner-approved deployment

Only after separate approval:

1. Back up and verify the target project.
2. Apply the schema migration before application code.
3. Run Supabase security and performance advisors.
4. Apply the generated publication SQL from a trusted database maintenance
   environment; never expose a service-role or database credential to browser
   code.
5. Verify published counts, topic distribution, provenance, source credits,
   RLS, and idempotent attempts in production.
6. Enable `/practice` for the owner first and observe application errors,
   completion, and answer-problem reports before broader rollout.

## Rollback

Retire the affected immutable package or exercise rows. Do not delete attempt
history. Use a forward migration for schema corrections and roll back
application code independently from content state.
