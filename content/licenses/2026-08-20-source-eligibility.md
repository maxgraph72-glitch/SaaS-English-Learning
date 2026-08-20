# Practice source eligibility snapshot — 2026-08-20

This engineering snapshot records the live eligibility check performed before
building the Package 1 pipeline. It is not a legal opinion and is not a corpus
release manifest.

## Mozilla Common Voice

- Dataset page: https://commonvoice.mozilla.org/en/datasets
- Terms: https://commonvoice.mozilla.org/terms
- Eligible dataset observed: Common Voice Scripted Speech 25.0 — English.
- License displayed by the source: CC0-1.0.
- Observed full dataset size: 87.84 GB.
- Decision: eligible in principle, but no release was downloaded or imported
  in this repository. A real import still needs the acquired archive's exact
  checksum and download timestamp.

## Tatoeba

- Download page: https://tatoeba.org/en/downloads
- Eligible export: the separate weekly `Sentences (CC0)` export.
- Documented fields: sentence ID, language, text, and last-modified date.
- License displayed by the source: CC0-1.0 for this separate subset.
- Acquired export: English-only `eng_sentences_CC0.tsv.bz2`, last modified
  2026-08-15 06:30:40 UTC and downloaded 2026-08-20.
- Compressed SHA-256: `6ab169264a28008c25bf63042bf7535fc63137c9d7e09b7b8bd7812d10117d1b`.
- Imported TSV SHA-256: `9e8b3d587be1bd7cf299e09387aeec5707d48d988e1bea14cba091ebc5250262`.
- Decision: eligible for the Package 1 review queue. The general sentence
  export remains CC BY and must not be mixed into Package 1.

## Current fixture status

The repository fixtures are original synthetic sentences dedicated to CC0 by
the project for testing. They are explicitly marked as fixtures and cannot pass
the publication validator.

## Daily English original practice corpus

- Source: `content/original/daily-english-practice-v1.tsv`.
- Release: `personal-practice-v1`.
- License: CC0-1.0.
- Creation method: controlled project-original templates with deterministic
  Present Simple and Present Continuous answer rules.
- Review method: owner-authorized AI editorial review plus an exhaustive
  structural audit of all 800 records. This is recorded transparently and is
  not represented as human line-by-line review.
- Decision: approved for the project owner's personal learning package.

The earlier Tatoeba CC0 review queue was not published because sampling found
ambiguous grammar targets and unsuitable learning examples. Its pinned source
manifest remains useful for future importer work, but no Tatoeba-derived row is
included in the published personal package.
