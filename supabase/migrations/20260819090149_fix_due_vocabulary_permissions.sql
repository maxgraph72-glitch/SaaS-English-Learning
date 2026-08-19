create or replace function public.get_due_vocabulary()
returns setof public.vocabulary_items
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_local_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select timezone(coalesce(settings.timezone, 'UTC'), now())::date
  into v_local_date
  from (select 1) as singleton
  left join public.user_settings as settings
    on settings.user_id = v_user_id;

  return query
  select item.*
  from public.vocabulary_items as item
  where item.user_id = v_user_id
    and item.next_review_date is not null
    and item.next_review_date <= v_local_date
  order by
    item.next_review_date asc,
    item.created_at asc;
end;
$$;

comment on function public.get_due_vocabulary() is
'Returns the authenticated learner''s due and overdue vocabulary without requiring access to the private schema.';

revoke all on function public.get_due_vocabulary() from public, anon;
grant execute on function public.get_due_vocabulary() to authenticated;
