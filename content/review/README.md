# Present Tenses package review

`present-tenses-package-1.jsonl` is a review queue, not published content. It
contains 800 pending exercises selected from the English-only Tatoeba CC0
weekly export dated 2026-08-15. The package has the required target mix:

- 250 Present Simple affirmative exercises;
- 125 Present Simple negative exercises;
- 125 Present Simple questions;
- 120 Present Continuous affirmative exercises;
- 60 Present Continuous negative exercises;
- 60 Present Continuous questions;
- 60 Present Simple vs Continuous exercises;
- 480 A1, 240 A2, and 80 B1 provisional estimates.

Every record is intentionally pending (`reviewerDecision: null`). Some records
were derived deterministically from affirmative source candidates to fill the
required exercise-type distribution; their `transformation` object records
that derivation. This does not replace human grammar and context review.

The full generated candidate pool is reproducible from the ignored Tatoeba TSV
and is kept under ignored `content/raw/` while reviewing. Synthetic fixtures
remain under `tests/fixtures/` and cannot pass the publication gate.

For a real package, each line must be checked against the pinned source item
and assigned exactly one decision:

- `approve`
- `edit_and_approve`
- `reject`
- `needs_legal_review`

An approval also requires `reviewedBy`, `reviewedAt`, and any relevant
`reviewNote`. Rejections and quarantines require one of the documented
rejection reasons. Never approve a fixture record.

Run structural validation while reviewing:

```text
npm run content:validate
```

The publication gate is stricter and will reject fixtures, pending decisions,
unresolved warnings, duplicates, fewer than 800 exercises, or the wrong topic
distribution:

```text
npm run content:publish
```

That command only prepares ignored SQL under `content/publish/`; it never
connects to a database or deploys anything.
