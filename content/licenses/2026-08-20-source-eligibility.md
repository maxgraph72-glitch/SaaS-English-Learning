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
- Decision: eligible in principle. The general sentence export remains CC BY
  and must not be mixed into Package 1. No weekly export was downloaded or
  imported in this repository.

## Current fixture status

The repository fixtures are original synthetic sentences dedicated to CC0 by
the project for testing. They are explicitly marked as fixtures and cannot pass
the publication validator.
