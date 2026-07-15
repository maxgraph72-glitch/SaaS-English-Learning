create type public.writing_entry_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

create function private.is_valid_writing_mistakes(p_mistakes jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_mistake jsonb;
begin
  if jsonb_typeof(p_mistakes) <> 'array'
     or jsonb_array_length(p_mistakes) > 10 then
    return false;
  end if;

  for v_mistake in
    select value from jsonb_array_elements(p_mistakes)
  loop
    if jsonb_typeof(v_mistake) <> 'object'
       or not (v_mistake ?& array['original', 'correction', 'category', 'explanation'])
       or exists (
         select 1
         from jsonb_object_keys(v_mistake) as keys(key_name)
         where key_name not in ('original', 'correction', 'category', 'explanation')
       )
       or jsonb_typeof(v_mistake -> 'original') <> 'string'
       or jsonb_typeof(v_mistake -> 'correction') <> 'string'
       or jsonb_typeof(v_mistake -> 'category') <> 'string'
       or jsonb_typeof(v_mistake -> 'explanation') <> 'string'
       or btrim(v_mistake ->> 'original') = ''
       or btrim(v_mistake ->> 'correction') = ''
       or btrim(v_mistake ->> 'explanation') = ''
       or char_length(v_mistake ->> 'original') > 500
       or char_length(v_mistake ->> 'correction') > 500
       or char_length(v_mistake ->> 'explanation') > 1000
       or (v_mistake ->> 'category') not in (
         'grammar', 'vocabulary', 'spelling', 'punctuation', 'style'
       ) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create function private.normalize_writing_comparison(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(regexp_replace(p_value, '[[:space:]]+', ' ', 'g'));
$$;

create function private.writing_mistakes_match_entry(
  p_original_text text,
  p_mistakes jsonb
)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_source text := private.normalize_writing_comparison(p_original_text);
  v_mistake jsonb;
  v_original text;
begin
  if not private.is_valid_writing_mistakes(p_mistakes) then
    return false;
  end if;

  for v_mistake in
    select value from jsonb_array_elements(p_mistakes)
  loop
    v_original := private.normalize_writing_comparison(v_mistake ->> 'original');
    if position(v_original in v_source) = 0 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create table public.writing_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  submission_id uuid not null,
  entry_date date not null,
  original_text text not null,
  word_count integer not null,
  feedback_status public.writing_entry_status not null default 'pending',
  active_seconds integer not null default 0,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint writing_entries_user_submission_key unique (user_id, submission_id),
  constraint writing_entries_id_user_key unique (id, user_id),
  constraint writing_entries_original_text_check check (
    original_text = btrim(original_text)
    and char_length(original_text) <= 5000
    and char_length(regexp_replace(original_text, '[[:space:]]', '', 'g')) >= 20
  ),
  constraint writing_entries_word_count_check check (word_count > 0),
  constraint writing_entries_active_seconds_check check (
    active_seconds between 0 and 3600
  ),
  constraint writing_entries_failure_code_check check (
    (feedback_status = 'failed') = (failure_code is not null)
    and (
      failure_code is null
      or failure_code in (
        'provider_timeout',
        'provider_unavailable',
        'provider_error',
        'invalid_feedback',
        'configuration',
        'persistence_error'
      )
    )
  )
);

create index writing_entries_user_id_idx
  on public.writing_entries (user_id);
create index writing_entries_user_date_created_idx
  on public.writing_entries (user_id, entry_date, created_at desc);

create table public.writing_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  writing_entry_id uuid not null,
  corrected_text text not null,
  mistakes jsonb not null default '[]'::jsonb,
  estimated_cefr text not null,
  cefr_rationale text not null,
  schema_version smallint not null,
  prompt_version text not null,
  provider text not null,
  model text not null,
  created_at timestamptz not null default now(),
  constraint writing_feedback_entry_key unique (writing_entry_id),
  constraint writing_feedback_entry_owner_fkey
    foreign key (writing_entry_id, user_id)
    references public.writing_entries (id, user_id)
    on delete cascade,
  constraint writing_feedback_corrected_text_check check (
    btrim(corrected_text) <> '' and char_length(corrected_text) <= 7500
  ),
  constraint writing_feedback_mistakes_check check (
    private.is_valid_writing_mistakes(mistakes)
  ),
  constraint writing_feedback_cefr_check check (
    estimated_cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  ),
  constraint writing_feedback_rationale_check check (
    btrim(cefr_rationale) <> '' and char_length(cefr_rationale) <= 1000
  ),
  constraint writing_feedback_schema_version_check check (schema_version = 1),
  constraint writing_feedback_prompt_version_check check (
    btrim(prompt_version) <> '' and char_length(prompt_version) <= 100
  ),
  constraint writing_feedback_provider_check check (
    btrim(provider) <> '' and char_length(provider) <= 100
  ),
  constraint writing_feedback_model_check check (
    btrim(model) <> '' and char_length(model) <= 200
  )
);

create index writing_feedback_user_id_idx
  on public.writing_feedback (user_id);
create index writing_feedback_entry_id_idx
  on public.writing_feedback (writing_entry_id);

create trigger writing_entries_touch_updated_at
before update on public.writing_entries
for each row execute function private.touch_updated_at();

alter table public.writing_entries enable row level security;
alter table public.writing_feedback enable row level security;

create policy "writing_entries_select_own"
on public.writing_entries for select to authenticated
using ((select auth.uid()) = user_id);

create policy "writing_feedback_select_own"
on public.writing_feedback for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.writing_entries from public, anon, authenticated;
revoke all on public.writing_feedback from public, anon, authenticated;
grant select on public.writing_entries to authenticated;
grant select on public.writing_feedback to authenticated;

create function public.begin_writing_entry(
  p_submission_id uuid,
  p_original_text text,
  p_active_seconds integer
)
returns public.writing_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_entry public.writing_entries;
  v_original_text text;
  v_local_date date;
  v_word_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'Submission ID is required' using errcode = '22004';
  end if;
  if p_original_text is null then
    raise exception 'Writing text is required' using errcode = '22004';
  end if;

  v_original_text := btrim(
    replace(replace(p_original_text, E'\r\n', E'\n'), E'\r', E'\n')
  );

  if char_length(v_original_text) > 5000
     or char_length(regexp_replace(v_original_text, '[[:space:]]', '', 'g')) < 20 then
    raise exception 'Writing text is outside the allowed length'
      using errcode = '22023';
  end if;

  select * into v_entry
  from public.writing_entries
  where user_id = v_user_id and submission_id = p_submission_id
  for update;

  if found then
    if v_entry.original_text <> v_original_text then
      raise exception 'Submission ID already belongs to another entry'
        using errcode = 'P0001';
    end if;
    return v_entry;
  end if;

  v_local_date := private.user_local_date(v_user_id, now());
  if (
    select count(*)
    from public.writing_entries
    where user_id = v_user_id and entry_date = v_local_date
  ) >= 10 then
    raise exception 'Daily writing limit reached' using errcode = 'P0001';
  end if;

  v_word_count := cardinality(regexp_split_to_array(v_original_text, E'\\s+'));

  insert into public.writing_entries (
    user_id,
    submission_id,
    entry_date,
    original_text,
    word_count,
    feedback_status,
    active_seconds
  ) values (
    v_user_id,
    p_submission_id,
    v_local_date,
    v_original_text,
    v_word_count,
    'pending',
    least(greatest(coalesce(p_active_seconds, 0), 0), 3600)
  )
  returning * into v_entry;

  insert into public.daily_sessions (user_id, session_date, writing_status)
  values (v_user_id, v_local_date, 'in_progress')
  on conflict (user_id, session_date) do update
  set writing_status = case
    when public.daily_sessions.writing_status in ('completed', 'skipped')
      then public.daily_sessions.writing_status
    else 'in_progress'::public.daily_block_status
  end;

  return v_entry;
end;
$$;

create function public.claim_writing_entry_for_feedback(p_entry_id uuid)
returns table (
  entry_id uuid,
  feedback_status public.writing_entry_status,
  should_process boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_entry public.writing_entries;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_entry
  from public.writing_entries
  where id = p_entry_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Writing entry not found' using errcode = 'P0002';
  end if;

  if v_entry.feedback_status = 'completed' then
    return query select v_entry.id, v_entry.feedback_status, false;
    return;
  end if;

  if v_entry.feedback_status = 'processing'
     and v_entry.updated_at > now() - interval '2 minutes' then
    return query select v_entry.id, v_entry.feedback_status, false;
    return;
  end if;

  update public.writing_entries
  set feedback_status = 'processing', failure_code = null
  where id = v_entry.id and user_id = v_user_id
  returning * into v_entry;

  return query select v_entry.id, v_entry.feedback_status, true;
end;
$$;

create function public.mark_writing_entry_failed(
  p_entry_id uuid,
  p_failure_code text
)
returns public.writing_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_entry public.writing_entries;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_failure_code not in (
    'provider_timeout',
    'provider_unavailable',
    'provider_error',
    'invalid_feedback',
    'configuration',
    'persistence_error'
  ) then
    raise exception 'Unknown writing failure code' using errcode = '22023';
  end if;

  update public.writing_entries
  set feedback_status = 'failed', failure_code = p_failure_code
  where id = p_entry_id
    and user_id = v_user_id
    and feedback_status <> 'completed'
  returning * into v_entry;

  if not found then
    select * into v_entry
    from public.writing_entries
    where id = p_entry_id and user_id = v_user_id;
  end if;

  if not found then
    raise exception 'Writing entry not found' using errcode = 'P0002';
  end if;

  return v_entry;
end;
$$;

create function public.accept_writing_feedback(
  p_entry_id uuid,
  p_corrected_text text,
  p_mistakes jsonb,
  p_estimated_cefr text,
  p_cefr_rationale text,
  p_schema_version smallint,
  p_prompt_version text,
  p_provider text,
  p_model text
)
returns table (
  feedback_id uuid,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_entry public.writing_entries;
  v_feedback_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_entry
  from public.writing_entries
  where id = p_entry_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Writing entry not found' using errcode = 'P0002';
  end if;

  if v_entry.feedback_status = 'completed' then
    select feedback.id into v_feedback_id
    from public.writing_feedback as feedback
    where feedback.writing_entry_id = v_entry.id
      and feedback.user_id = v_user_id;

    return query select v_feedback_id, true;
    return;
  end if;

  if not private.writing_mistakes_match_entry(v_entry.original_text, p_mistakes) then
    raise exception 'Writing feedback mistakes do not match the entry'
      using errcode = '22023';
  end if;

  insert into public.writing_feedback (
    user_id,
    writing_entry_id,
    corrected_text,
    mistakes,
    estimated_cefr,
    cefr_rationale,
    schema_version,
    prompt_version,
    provider,
    model
  ) values (
    v_user_id,
    v_entry.id,
    btrim(p_corrected_text),
    p_mistakes,
    p_estimated_cefr,
    btrim(p_cefr_rationale),
    p_schema_version,
    btrim(p_prompt_version),
    btrim(p_provider),
    btrim(p_model)
  )
  returning id into v_feedback_id;

  update public.writing_entries
  set feedback_status = 'completed', failure_code = null
  where id = v_entry.id and user_id = v_user_id;

  insert into public.daily_sessions (
    user_id,
    session_date,
    writing_status,
    writing_seconds
  ) values (
    v_user_id,
    v_entry.entry_date,
    'completed',
    v_entry.active_seconds
  )
  on conflict (user_id, session_date) do update
  set writing_status = case
        when public.daily_sessions.writing_status = 'skipped'
          then public.daily_sessions.writing_status
        else 'completed'::public.daily_block_status
      end,
      writing_seconds = public.daily_sessions.writing_seconds + v_entry.active_seconds;

  return query select v_feedback_id, false;
end;
$$;

revoke all on function public.begin_writing_entry(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.claim_writing_entry_for_feedback(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_writing_entry_failed(uuid, text)
  from public, anon, authenticated;
revoke all on function public.accept_writing_feedback(
  uuid, text, jsonb, text, text, smallint, text, text, text
) from public, anon, authenticated;

grant execute on function public.begin_writing_entry(uuid, text, integer)
  to authenticated;
grant execute on function public.claim_writing_entry_for_feedback(uuid)
  to authenticated;
grant execute on function public.mark_writing_entry_failed(uuid, text)
  to authenticated;
grant execute on function public.accept_writing_feedback(
  uuid, text, jsonb, text, text, smallint, text, text, text
) to authenticated;

revoke all on function private.is_valid_writing_mistakes(jsonb)
  from public, anon, authenticated;
revoke all on function private.normalize_writing_comparison(text)
  from public, anon, authenticated;
revoke all on function private.writing_mistakes_match_entry(text, jsonb)
  from public, anon, authenticated;
