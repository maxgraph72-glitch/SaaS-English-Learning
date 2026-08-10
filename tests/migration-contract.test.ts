import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260713134023_vocabulary_spaced_repetition.sql",
    import.meta.url,
  ),
  "utf8",
).toLocaleLowerCase("en");
const overdueMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260728150245_overdue_vocabulary_stage_decay.sql",
    import.meta.url,
  ),
  "utf8",
).toLocaleLowerCase("en");
const vocabularyFixMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260729030231_vocabulary_six_stage_categories.sql",
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

  it("applies one authenticated overdue decay and clears it after review", () => {
    expect(overdueMigration).toContain(
      "add column overdue_stage_decay_pending boolean not null default false",
    );
    expect(overdueMigration).toContain(
      "greatest(item.repetition_stage - 1, 1)::smallint",
    );
    expect(overdueMigration).toContain(
      "and not item.overdue_stage_decay_pending",
    );
    expect(overdueMigration).toContain(
      "overdue_stage_decay_pending = false",
    );
    expect(overdueMigration).toContain(
      "where item.user_id = v_user_id",
    );
    expect(overdueMigration).toContain(
      "grant execute on function public.get_due_vocabulary() to authenticated",
    );
  });

  it("adds independent lifecycle, category, six-stage, and attempt history fields", () => {
    expect(vocabularyFixMigration).toContain(
      "create type public.vocabulary_learning_state",
    );
    expect(vocabularyFixMigration).toContain("add column knowledge_category smallint");
    expect(vocabularyFixMigration).toContain(
      "check (repetition_stage between 0 and 6)",
    );
    expect(vocabularyFixMigration).toContain(
      "add column last_stage_advanced_date date",
    );
    expect(vocabularyFixMigration).toContain(
      "add column overdue_processed_for_date date",
    );
    expect(vocabularyFixMigration).toContain(
      "add column attempt_kind public.vocabulary_review_attempt_kind",
    );
    expect(vocabularyFixMigration).toContain(
      "alter column correct drop not null",
    );
  });

  it("backfills every legacy group without deleting old audit fields", () => {
    expect(vocabularyFixMigration).toContain(
      "when item.current_group = 'known' then 1",
    );
    expect(vocabularyFixMigration).toContain(
      "when item.current_group = 'repeat' then 2",
    );
    expect(vocabularyFixMigration).toContain(
      "when item.current_group = 'weak' then 3",
    );
    expect(vocabularyFixMigration).toContain("else 4");
    expect(vocabularyFixMigration).not.toContain(
      "drop column correct",
    );
    expect(vocabularyFixMigration).not.toContain(
      "drop type public.vocabulary_group",
    );
  });

  it("keeps timed review authority and duplicate protection inside one RPC", () => {
    const v2Start = vocabularyFixMigration.indexOf(
      "create function public.submit_vocabulary_review_v2",
    );
    const v2End = vocabularyFixMigration.indexOf(
      "create or replace function public.submit_vocabulary_review(",
      v2Start,
    );
    const v2 = vocabularyFixMigration.slice(v2Start, v2End);

    expect(v2).toContain("p_response_time_ms integer");
    expect(v2).not.toContain("p_correct boolean");
    expect(v2).toContain("for update");
    expect(v2.match(/review\.submission_id = p_submission_id/g)?.length).toBe(2);
    expect(v2).toContain("last_stage_advanced_date = case");
    expect(v2).toContain("attempt_kind");
    expect(v2).toContain("insert into public.vocabulary_reviews");
    expect(v2.indexOf("update public.vocabulary_items")).toBeLessThan(
      v2.indexOf("insert into public.vocabulary_reviews"),
    );
  });

  it("uses the required overdue boundaries and calendar-month maintenance", () => {
    expect(vocabularyFixMigration).toContain(
      "item.next_review_date <= v_local_date - 7",
    );
    expect(vocabularyFixMigration).toContain(
      "item.next_review_date > v_local_date - 7",
    );
    expect(vocabularyFixMigration).toContain(
      "greatest(item.repetition_stage - 1, 1)::smallint",
    );
    expect(vocabularyFixMigration).toContain(
      "(p_local_date + interval '1 month')::date",
    );
    expect(vocabularyFixMigration).toContain(
      "least(v_completed_stage + 1, 6)::smallint",
    );
  });

  it("restricts every new privileged function to authenticated callers", () => {
    expect(vocabularyFixMigration).toContain(
      "revoke all on function public.submit_vocabulary_review_v2(uuid, integer, uuid)",
    );
    expect(vocabularyFixMigration).toContain(
      "grant execute on function public.submit_vocabulary_review_v2(uuid, integer, uuid)\n  to authenticated",
    );
    expect(vocabularyFixMigration).toContain(
      "where id = p_item_id\n    and user_id = v_user_id\n  for update",
    );
  });

  it("prevents browser inserts from supplying trusted scheduling fields", () => {
    expect(vocabularyFixMigration).toContain(
      "revoke insert on public.vocabulary_items from authenticated",
    );
    expect(vocabularyFixMigration).toContain(
      "grant insert (user_id, english_word, translation, source)",
    );
    expect(vocabularyFixMigration).not.toContain(
      "grant insert (user_id, english_word, translation, source, knowledge_category)",
    );
  });
});
