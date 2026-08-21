import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260820134202_practice_exercise_bank.sql", import.meta.url),
  "utf8",
).toLocaleLowerCase("en");
const hardeningMigration = readFileSync(
  new URL("../supabase/migrations/20260820143152_harden_practice_exercise_bank.sql", import.meta.url),
  "utf8",
).toLocaleLowerCase("en");
const provenanceMigration = readFileSync(
  new URL("../supabase/migrations/20260820144000_enforce_practice_publication_provenance.sql", import.meta.url),
  "utf8",
).toLocaleLowerCase("en");
const practiceComponent = readFileSync(
  new URL("../components/practice-session.tsx", import.meta.url),
  "utf8",
);
const practiceAction = readFileSync(
  new URL("../app/actions/practice.ts", import.meta.url),
  "utf8",
);

describe("practice database and application safety contract", () => {
  it("keeps source data private and exposes the minimum public grants", () => {
    expect(migration).toContain("create table private.practice_content_sources");
    expect(migration).toContain("create table private.practice_import_runs");
    expect(migration).toContain("create table private.practice_sentence_candidates");
    expect(migration).toContain("grant select on table public.practice_exercises to authenticated");
    expect(migration).not.toContain("grant insert on table public.practice_exercises to authenticated");
    expect(migration).toContain("revoke all on schema private from public, anon, authenticated");
  });

  it("enables RLS, hides drafts, and scopes attempt history to the owner", () => {
    expect(migration).toContain("alter table public.practice_exercises enable row level security");
    expect(migration).toContain("alter table public.practice_attempts enable row level security");
    expect(migration).toContain("using (status = 'published')");
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
  });

  it("checks correctness on the server and protects retry submission IDs", () => {
    expect(migration).toContain("constraint practice_attempts_user_submission_key unique (user_id, submission_id)");
    expect(migration).toContain("private.normalize_practice_answer(accepted.answer) = v_answer");
    expect(migration).toContain("submission id already belongs to another answer");
  });

  it("normalizes answer keys and enforces accepted, immutable provenance", () => {
    expect(hardeningMigration).toContain("normalize(item.value #>> '{}', nfkc)");
    expect(hardeningMigration).toContain("alter table private.practice_content_sources enable row level security");
    expect(provenanceMigration).toContain("published exercise requires accepted, approved provenance");
    expect(provenanceMigration).toContain("published practice exercise content is immutable");
  });

  it("includes accessible feedback and explicit duplicate-submit protection", () => {
    expect(practiceComponent).toContain('aria-live="polite"');
    expect(practiceComponent).toContain("pending");
    expect(practiceComponent).toContain("hasFeedback");
    expect(practiceComponent).toContain("getOrCreateSubmissionId");
    expect(practiceComponent).toContain("Correct answer:");
    expect(practiceComponent).toContain("Your answer:");
    expect(practiceComponent).toContain("Complete sentence:");
    expect(practiceComponent).toContain("/practice/sources");
    expect(practiceAction).not.toContain("revalidatePath");
    expect(practiceAction).toContain("outcome.exercise_id !== input.exerciseId");
  });
});
