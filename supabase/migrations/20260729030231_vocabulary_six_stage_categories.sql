create type public.vocabulary_learning_state as enum (
  'new',
  'learning',
  'scheduled'
);

create type public.vocabulary_review_attempt_kind as enum (
  'scheduled',
  'practice'
);

create type public.vocabulary_overdue_action as enum (
  'none',
  'rollback',
  'forgotten'
);

alter table public.vocabulary_items
  add column learning_state public.vocabulary_learning_state not null default 'new',
  add column knowledge_category smallint,
  add column last_attempt_at timestamptz,
  add column last_stage_advanced_date date,
  add column requires_relearning boolean not null default false,
  add column overdue_processed_for_date date;

alter table public.vocabulary_reviews
  add column local_review_date date,
  add column category_before smallint,
  add column category_after smallint,
  add column next_review_date_before date,
  add column next_review_date_after date,
  add column attempt_kind public.vocabulary_review_attempt_kind,
  add column overdue_action public.vocabulary_overdue_action,
  add column scheduled_review_date date;

update public.vocabulary_items as item
set learning_state = case
      when item.repetition_stage = 0
        then 'new'::public.vocabulary_learning_state
      when item.repetition_stage = 1
        then 'learning'::public.vocabulary_learning_state
      else 'scheduled'::public.vocabulary_learning_state
    end,
    knowledge_category = case
      when item.repetition_stage = 0 then null
      when item.current_group = 'known' then 1
      when item.current_group = 'repeat' then 2
      when item.current_group = 'weak' then 3
      else 4
    end,
    last_attempt_at = item.last_reviewed_at,
    requires_relearning = false,
    overdue_processed_for_date = case
      when item.overdue_stage_decay_pending then item.next_review_date
      else null
    end;

update public.vocabulary_reviews as review
set local_review_date = private.user_local_date(review.user_id, review.reviewed_at),
    category_before = case review.group_before
      when 'known' then 1
      when 'repeat' then 2
      when 'weak' then 3
      else 4
    end,
    category_after = case review.group_after
      when 'known' then 1
      when 'repeat' then 2
      when 'weak' then 3
      else 4
    end,
    next_review_date_after = review.next_review_date,
    attempt_kind = 'scheduled'::public.vocabulary_review_attempt_kind,
    overdue_action = 'none'::public.vocabulary_overdue_action;

alter table public.vocabulary_items
  drop constraint vocabulary_items_stage_check,
  drop constraint vocabulary_items_schedule_shape_check;

alter table public.vocabulary_items
  add constraint vocabulary_items_stage_check
    check (repetition_stage between 0 and 6),
  add constraint vocabulary_items_category_check
    check (knowledge_category between 1 and 4),
  add constraint vocabulary_items_learning_shape_check
    check (
      (
        learning_state = 'new'
        and knowledge_category is null
        and repetition_stage = 0
        and next_review_date is null
        and not requires_relearning
      )
      or
      (
        learning_state = 'learning'
        and repetition_stage = 1
        and (
          (
            requires_relearning
            and knowledge_category = 4
            and next_review_date is null
          )
          or
          (
            not requires_relearning
            and next_review_date is not null
          )
        )
      )
      or
      (
        learning_state = 'scheduled'
        and knowledge_category between 1 and 4
        and repetition_stage between 2 and 6
        and next_review_date is not null
        and not requires_relearning
      )
    );

alter table public.vocabulary_reviews
  drop constraint vocabulary_reviews_stage_before_check,
  drop constraint vocabulary_reviews_stage_after_check,
  alter column correct drop not null,
  alter column next_review_date drop not null,
  alter column local_review_date set not null,
  alter column category_after set not null,
  alter column attempt_kind set not null,
  alter column overdue_action set not null,
  add constraint vocabulary_reviews_category_before_check
    check (category_before between 1 and 4),
  add constraint vocabulary_reviews_category_after_check
    check (category_after between 1 and 4),
  add constraint vocabulary_reviews_stage_before_check
    check (stage_before between 1 and 6),
  add constraint vocabulary_reviews_stage_after_check
    check (stage_after between 1 and 6);

create index vocabulary_items_same_day_practice_idx
  on public.vocabulary_items (user_id, last_stage_advanced_date)
  where last_stage_advanced_date is not null;

revoke insert on public.vocabulary_items from authenticated;
grant insert (user_id, english_word, translation, source)
  on public.vocabulary_items
  to authenticated;

comment on column public.vocabulary_items.current_group is
'Legacy compatibility field. New scheduling uses learning_state and knowledge_category.';
comment on column public.vocabulary_reviews.correct is
'Legacy explicit answer. New timed attempts leave this null and use category_after.';
comment on column public.vocabulary_items.overdue_processed_for_date is
'The assigned due date for which rollback or forgetting was already processed.';

create function private.vocabulary_category_from_time(p_response_time_ms integer)
returns smallint
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_response_time_ms is null or p_response_time_ms < 0 then
    raise exception 'Response time must be a non-negative integer'
      using errcode = '22023';
  end if;

  return case
    when p_response_time_ms <= 1000 then 1
    when p_response_time_ms <= 3000 then 2
    when p_response_time_ms <= 5000 then 3
    else 4
  end::smallint;
end;
$$;

create function private.vocabulary_legacy_group(p_category smallint)
returns public.vocabulary_group
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_category
    when 1 then 'known'::public.vocabulary_group
    when 2 then 'repeat'::public.vocabulary_group
    when 3 then 'weak'::public.vocabulary_group
    else 'learning'::public.vocabulary_group
  end;
$$;

create function private.vocabulary_next_review_date(
  p_completed_stage smallint,
  p_local_date date
)
returns date
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_completed_stage not between 1 and 6 then
    raise exception 'Repetition stage must be between 1 and 6'
      using errcode = '22023';
  end if;

  return case p_completed_stage
    when 1 then p_local_date + 1
    when 2 then p_local_date + 3
    when 3 then p_local_date + 7
    when 4 then p_local_date + 14
    else (p_local_date + interval '1 month')::date
  end;
end;
$$;

create or replace function public.start_vocabulary_learning(p_item_id uuid)
returns public.vocabulary_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item public.vocabulary_items;
  v_local_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_item
  from public.vocabulary_items
  where id = p_item_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Vocabulary item not found' using errcode = 'P0002';
  end if;

  v_local_date := private.user_local_date(v_user_id, now());

  if v_item.learning_state = 'new' then
    update public.vocabulary_items
    set current_group = 'learning',
        learning_state = 'learning',
        knowledge_category = null,
        repetition_stage = 1,
        next_review_date = v_local_date,
        requires_relearning = false,
        overdue_processed_for_date = null,
        overdue_stage_decay_pending = false
    where id = p_item_id
      and user_id = v_user_id
    returning * into v_item;
  elsif not (
    v_item.learning_state = 'learning'
    and v_item.repetition_stage = 1
  ) then
    raise exception 'Vocabulary item is not available for study'
      using errcode = 'P0001';
  end if;

  insert into public.daily_sessions (user_id, session_date, vocabulary_status)
  values (v_user_id, v_local_date, 'in_progress')
  on conflict (user_id, session_date) do update
  set vocabulary_status = case
    when public.daily_sessions.vocabulary_status in ('completed', 'skipped')
      then public.daily_sessions.vocabulary_status
    else 'in_progress'::public.daily_block_status
  end;

  return v_item;
end;
$$;

create or replace function public.mark_vocabulary_learned(
  p_item_id uuid,
  p_submission_id uuid
)
returns public.vocabulary_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item public.vocabulary_items;
  v_local_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'Submission ID is required' using errcode = '22004';
  end if;

  select *
  into v_item
  from public.vocabulary_items
  where id = p_item_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Vocabulary item not found' using errcode = 'P0002';
  end if;

  if v_item.learned_submission_id = p_submission_id then
    return v_item;
  end if;

  if not (
    v_item.learning_state = 'learning'
    and v_item.repetition_stage = 1
  ) then
    raise exception 'Select the word for learning first' using errcode = 'P0001';
  end if;

  if v_item.learned_at is not null
     and not v_item.requires_relearning
     and v_item.next_review_date is not null then
    return v_item;
  end if;

  v_local_date := private.user_local_date(v_user_id, now());

  update public.vocabulary_items
  set current_group = case
        when knowledge_category is null then 'learning'::public.vocabulary_group
        else private.vocabulary_legacy_group(knowledge_category)
      end,
      learned_at = now(),
      learned_submission_id = p_submission_id,
      next_review_date = v_local_date,
      requires_relearning = false,
      overdue_processed_for_date = null,
      overdue_stage_decay_pending = false
  where id = p_item_id
    and user_id = v_user_id
  returning * into v_item;

  insert into public.daily_sessions (user_id, session_date, vocabulary_status)
  values (v_user_id, v_local_date, 'completed')
  on conflict (user_id, session_date) do update
  set vocabulary_status = 'completed';

  return v_item;
end;
$$;

create or replace function public.get_due_vocabulary()
returns setof public.vocabulary_items
language plpgsql
volatile
security definer
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

  update public.vocabulary_items as item
  set current_group = 'learning',
      learning_state = 'learning',
      knowledge_category = 4,
      repetition_stage = 1,
      next_review_date = null,
      requires_relearning = true,
      overdue_processed_for_date = item.next_review_date,
      overdue_stage_decay_pending = false
  where item.user_id = v_user_id
    and item.next_review_date is not null
    and item.next_review_date <= v_local_date - 7
    and not item.requires_relearning;

  update public.vocabulary_items as item
  set learning_state = case
        when greatest(item.repetition_stage - 1, 1) = 1
          then 'learning'::public.vocabulary_learning_state
        else 'scheduled'::public.vocabulary_learning_state
      end,
      repetition_stage = greatest(item.repetition_stage - 1, 1)::smallint,
      overdue_processed_for_date = item.next_review_date,
      overdue_stage_decay_pending = true
  where item.user_id = v_user_id
    and item.repetition_stage between 1 and 6
    and item.next_review_date < v_local_date
    and item.next_review_date > v_local_date - 7
    and item.overdue_processed_for_date is distinct from item.next_review_date
    and not item.requires_relearning;

  return query
  select item.*
  from public.vocabulary_items as item
  where item.user_id = v_user_id
    and item.next_review_date is not null
    and item.next_review_date <= v_local_date
    and not item.requires_relearning
  order by item.next_review_date asc, item.created_at asc;
end;
$$;

create function public.submit_vocabulary_review_v2(
  p_item_id uuid,
  p_response_time_ms integer,
  p_submission_id uuid
)
returns table (
  review_id uuid,
  vocabulary_item_id uuid,
  category_after smallint,
  stage_after smallint,
  next_review_date_after date,
  attempt_kind public.vocabulary_review_attempt_kind,
  overdue_action public.vocabulary_overdue_action,
  requires_relearning boolean,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item public.vocabulary_items;
  v_reviewed_at timestamptz := clock_timestamp();
  v_local_date date;
  v_category_after smallint;
  v_stage_after smallint;
  v_next_review_date date;
  v_attempt_kind public.vocabulary_review_attempt_kind;
  v_overdue_action public.vocabulary_overdue_action := 'none';
  v_requires_relearning boolean := false;
  v_scheduled_review_date date;
  v_completed_stage smallint;
  v_review_id uuid;
  v_group_after public.vocabulary_group;
  v_learning_state public.vocabulary_learning_state;
  v_has_more_due boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'Submission ID is required' using errcode = '22004';
  end if;

  v_category_after := private.vocabulary_category_from_time(p_response_time_ms);

  return query
  select review.id,
         review.vocabulary_item_id,
         review.category_after,
         review.stage_after,
         review.next_review_date_after,
         review.attempt_kind,
         review.overdue_action,
         review.overdue_action = 'forgotten',
         true
  from public.vocabulary_reviews as review
  where review.user_id = v_user_id
    and review.submission_id = p_submission_id;

  if found then
    return;
  end if;

  select *
  into v_item
  from public.vocabulary_items
  where id = p_item_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Vocabulary item not found' using errcode = 'P0002';
  end if;

  return query
  select review.id,
         review.vocabulary_item_id,
         review.category_after,
         review.stage_after,
         review.next_review_date_after,
         review.attempt_kind,
         review.overdue_action,
         review.overdue_action = 'forgotten',
         true
  from public.vocabulary_reviews as review
  where review.user_id = v_user_id
    and review.submission_id = p_submission_id;

  if found then
    return;
  end if;

  v_local_date := private.user_local_date(v_user_id, v_reviewed_at);

  if v_item.requires_relearning or v_item.next_review_date is null then
    raise exception 'Vocabulary item must be studied before review'
      using errcode = 'P0001';
  end if;

  if v_item.last_stage_advanced_date = v_local_date then
    v_attempt_kind := 'practice';
    v_scheduled_review_date := v_item.next_review_date;
    v_stage_after := v_item.repetition_stage;
    v_next_review_date := v_item.next_review_date;
    v_learning_state := v_item.learning_state;
  elsif v_item.next_review_date <= v_local_date then
    v_attempt_kind := 'scheduled';
    v_scheduled_review_date := v_item.next_review_date;

    if v_item.next_review_date <= v_local_date - 7 then
      v_overdue_action := 'forgotten';
      v_category_after := 4;
      v_stage_after := 1;
      v_next_review_date := null;
      v_requires_relearning := true;
      v_learning_state := 'learning';
    else
      if v_item.next_review_date < v_local_date then
        v_overdue_action := 'rollback';
      end if;

      v_completed_stage := case
        when v_overdue_action = 'rollback'
          and v_item.overdue_processed_for_date is distinct from v_item.next_review_date
          then greatest(v_item.repetition_stage - 1, 1)::smallint
        else v_item.repetition_stage
      end;
      v_stage_after := least(v_completed_stage + 1, 6)::smallint;
      v_next_review_date :=
        private.vocabulary_next_review_date(v_completed_stage, v_local_date);
      v_learning_state := 'scheduled';
    end if;
  else
    raise exception 'Vocabulary item is not due yet' using errcode = 'P0001';
  end if;

  v_group_after := private.vocabulary_legacy_group(v_category_after);

  update public.vocabulary_items
  set current_group = v_group_after,
      learning_state = v_learning_state,
      knowledge_category = v_category_after,
      repetition_stage = v_stage_after,
      last_reviewed_at = v_reviewed_at,
      last_attempt_at = v_reviewed_at,
      last_stage_advanced_date = case
        when v_attempt_kind = 'scheduled' and not v_requires_relearning
          then v_local_date
        else public.vocabulary_items.last_stage_advanced_date
      end,
      next_review_date = v_next_review_date,
      requires_relearning = v_requires_relearning,
      overdue_processed_for_date = case
        when v_attempt_kind = 'scheduled' then null
        else public.vocabulary_items.overdue_processed_for_date
      end,
      overdue_stage_decay_pending = case
        when v_attempt_kind = 'scheduled' then false
        else public.vocabulary_items.overdue_stage_decay_pending
      end
  where id = v_item.id
    and user_id = v_user_id;

  insert into public.vocabulary_reviews (
    submission_id,
    user_id,
    vocabulary_item_id,
    reviewed_at,
    local_review_date,
    correct,
    response_time_ms,
    group_before,
    group_after,
    category_before,
    category_after,
    stage_before,
    stage_after,
    next_review_date,
    next_review_date_before,
    next_review_date_after,
    attempt_kind,
    overdue_action,
    scheduled_review_date
  ) values (
    p_submission_id,
    v_user_id,
    v_item.id,
    v_reviewed_at,
    v_local_date,
    null,
    p_response_time_ms,
    v_item.current_group,
    v_group_after,
    v_item.knowledge_category,
    v_category_after,
    v_item.repetition_stage,
    v_stage_after,
    v_next_review_date,
    v_item.next_review_date,
    v_next_review_date,
    v_attempt_kind,
    v_overdue_action,
    v_scheduled_review_date
  )
  returning id into v_review_id;

  select exists (
    select 1
    from public.vocabulary_items as due_item
    where due_item.user_id = v_user_id
      and due_item.next_review_date is not null
      and due_item.next_review_date <= v_local_date
      and not due_item.requires_relearning
  )
  into v_has_more_due;

  insert into public.daily_sessions (user_id, session_date, review_status)
  values (
    v_user_id,
    v_local_date,
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
         v_category_after,
         v_stage_after,
         v_next_review_date,
         v_attempt_kind,
         v_overdue_action,
         v_requires_relearning,
         false;
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
language sql
security definer
set search_path = ''
as $$
  select result.review_id,
         result.vocabulary_item_id,
         private.vocabulary_legacy_group(result.category_after),
         result.stage_after,
         result.next_review_date_after,
         result.duplicate
  from public.submit_vocabulary_review_v2(
    p_item_id,
    p_response_time_ms,
    p_submission_id
  ) as result;
$$;

revoke all on function public.start_vocabulary_learning(uuid)
  from public, anon;
revoke all on function public.mark_vocabulary_learned(uuid, uuid)
  from public, anon;
revoke all on function public.get_due_vocabulary()
  from public, anon;
revoke all on function public.submit_vocabulary_review_v2(uuid, integer, uuid)
  from public, anon;
revoke all on function public.submit_vocabulary_review(uuid, boolean, integer, uuid)
  from public, anon;

grant execute on function public.start_vocabulary_learning(uuid)
  to authenticated;
grant execute on function public.mark_vocabulary_learned(uuid, uuid)
  to authenticated;
grant execute on function public.get_due_vocabulary()
  to authenticated;
grant execute on function public.submit_vocabulary_review_v2(uuid, integer, uuid)
  to authenticated;
grant execute on function public.submit_vocabulary_review(uuid, boolean, integer, uuid)
  to authenticated;

revoke all on function private.vocabulary_category_from_time(integer)
  from public, anon, authenticated;
revoke all on function private.vocabulary_legacy_group(smallint)
  from public, anon, authenticated;
revoke all on function private.vocabulary_next_review_date(smallint, date)
  from public, anon, authenticated;
