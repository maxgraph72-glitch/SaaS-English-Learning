# Practice exercise bank — controlled rollout

## Personal package release

The production release uses 800 project-original CC0 exercises generated from
controlled templates and exhaustively checked by the package audit. The
project owner explicitly authorized AI editorial review for this personal
learning project. Review metadata says exactly that; it does not claim a human
line-by-line review.

The earlier Tatoeba-derived draft remains excluded because its quality sample
contained ambiguous and unsuitable exercises.

Production now contains the complete 800-exercise personal package. The
publication audit trail records 800 accepted candidates and 800 published
exercises.

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

## 2. Generate the personal package

Rebuild the controlled original corpus, manifest, and approved review package:

```text
npm run content:build-personal
npm run content:audit
```

The audit checks every line, reconstructs each completed sentence from the
prompt and answer, verifies tense-specific answer shapes, and rejects unsafe,
duplicate, unlicensed, or unapproved records.

## 3. Editorial review and audit

1. Preserve the real review method, reviewer identity, and timestamp.
2. Keep exactly 800 approved exercises in the required topic mix.
3. Resolve every license and safety warning.
4. Audit all 800 records and correct every reported error.
5. Run `npm run content:validate`, then `npm run content:publish`.

The publication command only writes transaction-wrapped SQL to ignored
`content/publish/`. It does not connect to Supabase.

## 4. Owner-approved deployment

Completed after the owner's explicit approval:

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
