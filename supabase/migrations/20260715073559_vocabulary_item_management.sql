create policy "vocabulary_items_update_own_content"
on public.vocabulary_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "vocabulary_items_delete_own"
on public.vocabulary_items for delete to authenticated
using ((select auth.uid()) = user_id);

grant update (english_word, translation) on public.vocabulary_items to authenticated;
grant delete on public.vocabulary_items to authenticated;
