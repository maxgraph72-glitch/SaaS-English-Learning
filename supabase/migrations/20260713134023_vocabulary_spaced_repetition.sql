create schema if not exists private;

create type public.vocabulary_source as enum ('manual', 'csv');
create type public.vocabulary_group as enum (
  'unknown',
  'learning',
  'weak',
  'repeat',
  'known'
);
create type public.daily_block_status as enum (
  'not_started',
  'in_progress',
  'completed',
  'skipped'
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  current_cefr text not null default 'A1',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_cefr_check
    check (current_cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  interface_language text not null default 'en',
  theme text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_language_check
    check (interface_language in ('en', 'ru')),
  constraint user_settings_theme_check
    check (theme in ('light', 'dark', 'system'))
);

create table public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  english_word text not null,
  normalized_word text generated always as (lower(btrim(english_word))) stored,
  translation text not null,
  source public.vocabulary_source not null default 'manual',
  current_group public.vocabulary_group not null default 'unknown',
  repetition_stage smallint not null default 0,
  learned_at timestamptz,
  learned_submission_id uuid,
  last_reviewed_at timestamptz,
  next_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_items_word_not_blank check (btrim(english_word) <> ''),
  constraint vocabulary_items_translation_not_blank check (btrim(translation) <> ''),
  constraint vocabulary_items_stage_check check (repetition_stage between 0 and 5),
  constraint vocabulary_items_schedule_shape_check check (
    (repetition_stage = 0 and next_review_date is null)
    or
    (repetition_stage between 1 and 5 and next_review_date is not null)
  ),
  constraint vocabulary_items_user_word_key unique (user_id, normalized_word),
  constraint vocabulary_items_id_user_key unique (id, user_id)
);

create unique index vocabulary_items_learned_submission_key
  on public.vocabulary_items (user_id, learned_submission_id)
  where learned_submission_id is not null;
create index vocabulary_items_user_id_idx
  on public.vocabulary_items (user_id);
create index vocabulary_items_due_queue_idx
  on public.vocabulary_items (user_id, next_review_date)
  where next_review_date is not null;

create table public.vocabulary_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  vocabulary_item_id uuid not null,
  reviewed_at timestamptz not null default now(),
  correct boolean not null,
  response_time_ms integer not null,
  group_before public.vocabulary_group not null,
  group_after public.vocabulary_group not null,
  stage_before smallint not null,
  stage_after smallint not null,
  next_review_date date not null,
  constraint vocabulary_reviews_response_time_check check (response_time_ms >= 0),
  constraint vocabulary_reviews_stage_before_check check (stage_before between 1 and 5),
  constraint vocabulary_reviews_stage_after_check check (stage_after between 1 and 5),
  constraint vocabulary_reviews_submission_key unique (user_id, submission_id),
  constraint vocabulary_reviews_item_owner_fkey
    foreign key (vocabulary_item_id, user_id)
    references public.vocabulary_items (id, user_id)
    on delete cascade
);

create index vocabulary_reviews_user_id_idx
  on public.vocabulary_reviews (user_id);
create index vocabulary_reviews_item_id_idx
  on public.vocabulary_reviews (vocabulary_item_id);

create table public.daily_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_date date not null,
  vocabulary_status public.daily_block_status not null default 'not_started',
  speaking_status public.daily_block_status not null default 'not_started',
  writing_status public.daily_block_status not null default 'not_started',
  review_status public.daily_block_status not null default 'not_started',
  vocabulary_seconds integer not null default 0 check (vocabulary_seconds >= 0),
  speaking_seconds integer not null default 0 check (speaking_seconds >= 0),
  writing_seconds integer not null default 0 check (writing_seconds >= 0),
  review_seconds integer not null default 0 check (review_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_sessions_user_date_key unique (user_id, session_date)
);

create index daily_sessions_user_id_idx on public.daily_sessions (user_id);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function private.validate_user_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.timezone
  ) then
    raise exception 'Unknown IANA timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger user_settings_touch_updated_at
before update on public.user_settings
for each row execute function private.touch_updated_at();
create trigger user_settings_validate_timezone
before insert or update of timezone on public.user_settings
for each row execute function private.validate_user_timezone();
create trigger vocabulary_items_touch_updated_at
before update on public.vocabulary_items
for each row execute function private.touch_updated_at();
create trigger daily_sessions_touch_updated_at
before update on public.daily_sessions
for each row execute function private.touch_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (user_id, display_name)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name')
from auth.users as users
on conflict (user_id) do nothing;

insert into public.user_settings (user_id)
select users.id
from auth.users as users
on conflict (user_id) do nothing;

create function private.user_local_date(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
begin
  select coalesce(settings.timezone, 'UTC')
  into v_timezone
  from public.user_settings as settings
  where settings.user_id = p_user_id;

  v_timezone := coalesce(v_timezone, 'UTC');

  begin
    return timezone(v_timezone, p_at)::date;
  exception when invalid_parameter_value then
    return timezone('UTC', p_at)::date;
  end;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.vocabulary_reviews enable row level security;
alter table public.daily_sessions enable row level security;

create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);
create policy "profiles_update_own"
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_settings_select_own"
on public.user_settings for select to authenticated
using ((select auth.uid()) = user_id);
create policy "user_settings_insert_own"
on public.user_settings for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "user_settings_update_own"
on public.user_settings for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "vocabulary_items_select_own"
on public.vocabulary_items for select to authenticated
using ((select auth.uid()) = user_id);
create policy "vocabulary_items_insert_own"
on public.vocabulary_items for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "vocabulary_reviews_select_own"
on public.vocabulary_reviews for select to authenticated
using ((select auth.uid()) = user_id);

create policy "daily_sessions_select_own"
on public.daily_sessions for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.profiles from public, anon, authenticated;
revoke all on public.user_settings from public, anon, authenticated;
revoke all on public.vocabulary_items from public, anon, authenticated;
revoke all on public.vocabulary_reviews from public, anon, authenticated;
revoke all on public.daily_sessions from public, anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select, insert on public.vocabulary_items to authenticated;
grant select on public.vocabulary_reviews to authenticated;
grant select on public.daily_sessions to authenticated;

create function public.start_vocabulary_learning(p_item_id uuid)
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

  select * into v_item
  from public.vocabulary_items
  where id = p_item_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Vocabulary item not found' using errcode = 'P0002';
  end if;

  if v_item.current_group = 'unknown' then
    update public.vocabulary_items
    set current_group = 'learning'
    where id = p_item_id and user_id = v_user_id
    returning * into v_item;
  end if;

  v_local_date := private.user_local_date(v_user_id, now());
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

create function public.mark_vocabulary_learned(
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

  select * into v_item
  from public.vocabulary_items
  where id = p_item_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Vocabulary item not found' using errcode = 'P0002';
  end if;

  if v_item.repetition_stage > 0 and v_item.learned_at is not null then
    return v_item;
  end if;

  if v_item.current_group <> 'learning' then
    raise exception 'Select the word for learning first' using errcode = 'P0001';
  end if;

  v_local_date := private.user_local_date(v_user_id, now());

  update public.vocabulary_items
  set current_group = 'learning',
      repetition_stage = 1,
      learned_at = now(),
      learned_submission_id = p_submission_id,
      next_review_date = v_local_date + 1
  where id = p_item_id and user_id = v_user_id
  returning * into v_item;

  insert into public.daily_sessions (user_id, session_date, vocabulary_status)
  values (v_user_id, v_local_date, 'completed')
  on conflict (user_id, session_date) do update
  set vocabulary_status = 'completed';

  return v_item;
end;
$$;

create function public.get_due_vocabulary()
returns setof public.vocabulary_items
language sql
stable
security invoker
set search_path = ''
as $$
  select item.*
  from public.vocabulary_items as item
  where item.user_id = (select auth.uid())
    and item.next_review_date is not null
    and item.next_review_date <= timezone(
      coalesce(
        (
          select settings.timezone
          from public.user_settings as settings
          where settings.user_id = (select auth.uid())
        ),
        'UTC'
      ),
      now()
    )::date
  order by
    item.next_review_date asc,
    case item.current_group
      when 'learning' then 1
      when 'weak' then 2
      when 'repeat' then 3
      when 'known' then 4
      else 5
    end asc,
    item.created_at asc;
$$;

create function public.submit_vocabulary_review(
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
      next_review_date = v_next_review_date
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

create function public.set_daily_block_status(
  p_block text,
  p_status public.daily_block_status
)
returns public.daily_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_local_date date;
  v_session public.daily_sessions;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_block not in ('vocabulary', 'speaking', 'writing', 'review') then
    raise exception 'Unknown daily block' using errcode = '22023';
  end if;

  v_local_date := private.user_local_date(v_user_id, now());
  insert into public.daily_sessions (user_id, session_date)
  values (v_user_id, v_local_date)
  on conflict (user_id, session_date) do nothing;

  if p_block = 'vocabulary' then
    update public.daily_sessions set vocabulary_status = p_status
    where user_id = v_user_id and session_date = v_local_date returning * into v_session;
  elsif p_block = 'speaking' then
    update public.daily_sessions set speaking_status = p_status
    where user_id = v_user_id and session_date = v_local_date returning * into v_session;
  elsif p_block = 'writing' then
    update public.daily_sessions set writing_status = p_status
    where user_id = v_user_id and session_date = v_local_date returning * into v_session;
  else
    update public.daily_sessions set review_status = p_status
    where user_id = v_user_id and session_date = v_local_date returning * into v_session;
  end if;

  return v_session;
end;
$$;

revoke all on function public.start_vocabulary_learning(uuid) from public, anon;
revoke all on function public.mark_vocabulary_learned(uuid, uuid) from public, anon;
revoke all on function public.get_due_vocabulary() from public, anon;
revoke all on function public.submit_vocabulary_review(uuid, boolean, integer, uuid) from public, anon;
revoke all on function public.set_daily_block_status(text, public.daily_block_status) from public, anon;

grant execute on function public.start_vocabulary_learning(uuid) to authenticated;
grant execute on function public.mark_vocabulary_learned(uuid, uuid) to authenticated;
grant execute on function public.get_due_vocabulary() to authenticated;
grant execute on function public.submit_vocabulary_review(uuid, boolean, integer, uuid) to authenticated;
grant execute on function public.set_daily_block_status(text, public.daily_block_status) to authenticated;

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.validate_user_timezone() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.user_local_date(uuid, timestamptz) from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
