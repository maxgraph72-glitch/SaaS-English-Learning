# Present Tenses personal practice package

`present-tenses-package-1.jsonl` contains 800 approved exercises for the
project owner's personal English study. The earlier Tatoeba-derived draft was
replaced after editorial sampling found ambiguous tense targets, awkward
sentences, and unsuitable topics.

The replacement package is generated from the controlled, project-original
source corpus in `content/original/daily-english-practice-v1.tsv`. Every item
has a unique source ID, source checksum, CC0-1.0 license record, deterministic
answer key, transformation rule, and owner-authorized AI editorial review
metadata. It does not claim human line-by-line review.

Package mix:

- 250 Present Simple affirmative exercises;
- 125 Present Simple negative exercises;
- 125 Present Simple questions;
- 120 Present Continuous affirmative exercises;
- 60 Present Continuous negative exercises;
- 60 Present Continuous questions;
- 60 Present Simple vs Continuous exercises;
- 480 A1, 240 A2, and 80 B1 provisional estimates.

Rebuild and audit the complete package with:

```text
npm run content:build-personal
npm run content:audit
npm run content:publish
```

The publication command only prepares ignored SQL under `content/publish/`;
database execution remains a separate controlled production action.
