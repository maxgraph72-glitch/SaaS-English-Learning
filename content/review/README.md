# Present Tenses package review

`present-tenses-package-1.jsonl` is a review queue, not published content. The
checked-in queue currently contains only synthetic CC0 fixtures used to prove
the pipeline. Every record is intentionally pending (`reviewerDecision: null`).

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
