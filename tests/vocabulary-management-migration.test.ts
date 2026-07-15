import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260715073559_vocabulary_item_management.sql",
    import.meta.url,
  ),
  "utf8",
).toLocaleLowerCase("en");

describe("vocabulary management migration", () => {
  it("allows authenticated owners to update only card content", () => {
    expect(migration).toContain(
      'create policy "vocabulary_items_update_own_content"',
    );
    expect(migration).toContain("for update to authenticated");
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
    expect(migration).toContain("with check ((select auth.uid()) = user_id)");
    expect(migration).toContain(
      "grant update (english_word, translation) on public.vocabulary_items to authenticated",
    );
    expect(migration).not.toContain("grant update on public.vocabulary_items");
  });

  it("allows owners to delete their cards through RLS", () => {
    expect(migration).toContain('create policy "vocabulary_items_delete_own"');
    expect(migration).toContain("for delete to authenticated");
    expect(migration).toContain(
      "grant delete on public.vocabulary_items to authenticated",
    );
  });
});
