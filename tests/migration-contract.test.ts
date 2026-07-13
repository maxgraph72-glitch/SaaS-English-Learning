import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260713134023_vocabulary_spaced_repetition.sql",
    import.meta.url,
  ),
  "utf8",
).toLocaleLowerCase("en");

describe("database safety contract", () => {
  it("protects duplicate review and learned submissions transactionally", () => {
    expect(migration).toContain(
      "constraint vocabulary_reviews_submission_key unique (user_id, submission_id)",
    );
    expect(migration).toContain("vocabulary_items_learned_submission_key");
    expect(migration.indexOf("review.submission_id = p_submission_id")).toBeLessThan(
      migration.indexOf("for update", migration.indexOf("submit_vocabulary_review")),
    );
  });

  it("enables RLS and scopes policies to the authenticated owner", () => {
    for (const table of [
      "profiles",
      "user_settings",
      "vocabulary_items",
      "vocabulary_reviews",
      "daily_sessions",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("(select auth.uid()) = user_id");
    expect(migration).toContain("with check ((select auth.uid()) = user_id)");
  });

  it("keeps review history immutable for authenticated clients", () => {
    expect(migration).toContain("grant select on public.vocabulary_reviews to authenticated");
    expect(migration).not.toContain(
      "grant select, insert on public.vocabulary_reviews to authenticated",
    );
  });
});
