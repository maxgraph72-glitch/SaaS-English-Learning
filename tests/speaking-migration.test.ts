import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260820132356_daily_speaking_practice.sql",
    import.meta.url,
  ),
  "utf8",
).toLocaleLowerCase("en");

describe("speaking database safety contract", () => {
  it("stores user-owned prompts and attempts behind RLS", () => {
    for (const table of ["speaking_prompts", "speaking_attempts"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`on public.${table} for select to authenticated`);
    }
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
    expect(migration).not.toContain("grant insert on public.speaking_attempts to authenticated");
    expect(migration).not.toContain("grant update on public.speaking_attempts to authenticated");
  });

  it("creates a private size-limited audio bucket", () => {
    expect(migration).toContain("'speaking-audio'");
    expect(migration).toContain("false,");
    expect(migration).toContain("1000000");
    expect(migration).toContain("audio/l16");
  });

  it("binds storage access to the authenticated owner folder", () => {
    expect(migration).toContain("(storage.foldername(name))[1] = (select auth.uid())::text");
    expect(migration).toContain("owner_id = (select auth.uid())::text");
    expect(migration).toContain("attempt.audio_path = name");
  });

  it("protects all privileged functions from anonymous execution", () => {
    for (const functionName of [
      "get_or_create_daily_speaking_prompt",
      "begin_speaking_attempt",
      "claim_speaking_attempt",
      "mark_speaking_attempt_failed",
      "complete_speaking_attempt",
    ]) {
      expect(migration).toContain(`revoke all on function public.${functionName}`);
    }
    expect(migration).toContain("grant execute on function public.complete_speaking_attempt");
  });

  it("completes the daily block and adds duration idempotently", () => {
    expect(migration).toContain("speaking_status");
    expect(migration).toContain("speaking_seconds");
    expect(migration).toContain("if v_attempt.analysis_status = 'completed'");
    expect(migration).toContain("return query select v_attempt.id, true");
  });

  it("serializes duplicate submissions before applying the daily limit", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      migration.indexOf("daily speaking limit reached"),
    );
  });
});
