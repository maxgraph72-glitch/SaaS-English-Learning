update public.vocabulary_items
set overdue_stage_decay_pending = false
where overdue_stage_decay_pending;

comment on column public.vocabulary_items.overdue_stage_decay_pending is
'Deprecated compatibility flag. Loading the daily queue no longer mutates or penalizes vocabulary.';

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

  v_local_date := private.user_local_date(v_user_id, now());

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

create or replace function public.submit_vocabulary_review(
  p_item_id uuid,
  p_correct boolean,
  p_response_time_ms integer,
  p_submission_id uuid
)
returns table (
  review_id uuid,
  vocabulary_item_id uuid,
  group_after public.vocabulary_group,
  stage_after smallint,
  next_review_date date,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item public.vocabulary_items;
  v_group_after public.vocabulary_group;
  v_stage_after smallint;
  v_interval integer;
  v_reviewed_at timestamptz := clock_timestamp();
  v_review_date date;
  v_next_review_date date;
  v_review_id uuid;
  v_has_more_due boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'Submission ID is required' using errcode = '22004';
  end if;
  if p_correct is null then
    raise exception 'Correctness is required' using errcode = '22004';
  end if;
  if p_response_time_ms is null or p_response_time_ms < 0 then
    raise exception 'Response time must be a non-negative integer' using errcode = '22023';
  end if;

  return query
  select review.id,
         review.vocabulary_item_id,
         review.group_after,
         review.stage_after,
         review.next_review_date,
         true
  from public.vocabulary_reviews as review
  where review.user_id = v_user_id
    and review.submission_id = p_submission_id;

  if found then
    return;
  end if;

  select * into v_item
  from public.vocabulary_items
  where id = p_item_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Vocabulary item not found' using errcode = 'P0002';
  end if;

  v_review_date := private.user_local_date(v_user_id, v_reviewed_at);

  if v_item.repetition_stage < 1 or v_item.next_review_date is null then
    raise exception 'Vocabulary item is not scheduled for review' using errcode = 'P0001';
  end if;
  if v_item.next_review_date > v_review_date then
    raise exception 'Vocabulary item is not due yet' using errcode = 'P0001';
  end if;

  if not p_correct then
    v_group_after := 'learning';
    v_stage_after := 1;
    v_interval := 1;
  elsif p_response_time_ms < 3000 then
    v_group_after := 'known';
    v_stage_after := least(v_item.repetition_stage + 1, 5)::smallint;
    v_interval := case v_stage_after
      when 1 then 1 when 2 then 2 when 3 then 3 when 4 then 7 else 30
    end;
  elsif p_response_time_ms <= 5000 then
    v_group_after := 'repeat';
    v_stage_after := v_item.repetition_stage;
    v_interval := case v_stage_after
      when 1 then 1 when 2 then 2 when 3 then 3 when 4 then 7 else 30
    end;
  elsif p_response_time_ms <= 10000 then
    v_group_after := 'weak';
    v_stage_after := 1;
    v_interval := 1;
  else
    v_group_after := 'learning';
    v_stage_after := 1;
    v_interval := 1;
  end if;

  v_next_review_date := v_review_date + v_interval;

  update public.vocabulary_items
  set current_group = v_group_after,
      repetition_stage = v_stage_after,
      last_reviewed_at = v_reviewed_at,
      next_review_date = v_next_review_date,
      overdue_stage_decay_pending = false
  where id = v_item.id and user_id = v_user_id;

  insert into public.vocabulary_reviews (
    submission_id,
    user_id,
    vocabulary_item_id,
    reviewed_at,
    correct,
    response_time_ms,
    group_before,
    group_after,
    stage_before,
    stage_after,
    next_review_date
  ) values (
    p_submission_id,
    v_user_id,
    v_item.id,
    v_reviewed_at,
    p_correct,
    p_response_time_ms,
    v_item.current_group,
    v_group_after,
    v_item.repetition_stage,
    v_stage_after,
    v_next_review_date
  )
  returning id into v_review_id;

  select exists (
    select 1
    from public.vocabulary_items as due_item
    where due_item.user_id = v_user_id
      and due_item.next_review_date is not null
      and due_item.next_review_date <= v_review_date
  ) into v_has_more_due;

  insert into public.daily_sessions (user_id, session_date, review_status)
  values (
    v_user_id,
    v_review_date,
    case
      when v_has_more_due then 'in_progress'::public.daily_block_status
      else 'completed'::public.daily_block_status
    end
  )
  on conflict (user_id, session_date) do update
  set review_status = excluded.review_status;

  return query
  select v_review_id,
         v_item.id,
         v_group_after,
         v_stage_after,
         v_next_review_date,
         false;
end;
$$;

revoke all on function public.get_due_vocabulary() from public, anon;
revoke all on function public.submit_vocabulary_review(uuid, boolean, integer, uuid)
from public, anon;

grant execute on function public.get_due_vocabulary() to authenticated;
grant execute on function public.submit_vocabulary_review(uuid, boolean, integer, uuid)
to authenticated;
