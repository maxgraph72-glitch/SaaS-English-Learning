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
const automaticQueueMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260812125631_automatic_daily_review_queue.sql",
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

  it("replaces missed-review decay with a read-only automatic due queue", () => {
    expect(overdueMigration).toContain(
      "add column overdue_stage_decay_pending boolean not null default false",
    );
    const dueQueueFunction = automaticQueueMigration.slice(
      automaticQueueMigration.indexOf(
        "create or replace function public.get_due_vocabulary()",
      ),
      automaticQueueMigration.indexOf(
        "create or replace function public.submit_vocabulary_review",
      ),
    );

    expect(dueQueueFunction).toContain("stable");
    expect(dueQueueFunction).toContain("security invoker");
    expect(dueQueueFunction).toContain("item.user_id = v_user_id");
    expect(dueQueueFunction).toContain("item.next_review_date <= v_local_date");
    expect(dueQueueFunction).not.toContain("update public.vocabulary_items");
    expect(automaticQueueMigration).toContain(
      "grant execute on function public.get_due_vocabulary() to authenticated",
    );
  });
});
