create table public.speaking_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt_date date not null,
  reference_text text not null,
  cefr text not null default 'A2',
  created_at timestamptz not null default now(),
  constraint speaking_prompts_reference_check check (
    char_length(btrim(reference_text)) between 80 and 700
  ),
  constraint speaking_prompts_cefr_check check (
    cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  ),
  constraint speaking_prompts_user_date_key unique (user_id, prompt_date),
  constraint speaking_prompts_id_user_key unique (id, user_id)
);

create index speaking_prompts_user_date_idx
  on public.speaking_prompts (user_id, prompt_date desc);

create table public.speaking_attempts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt_id uuid not null,
  attempt_date date not null,
  audio_path text not null,
  audio_format text not null default 'lpcm16-16000-mono',
  audio_bytes integer not null,
  duration_seconds integer not null,
  analysis_status text not null default 'pending',
  transcript text,
  score smallint,
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  failure_code text,
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint speaking_attempts_user_submission_key unique (user_id, submission_id),
  constraint speaking_attempts_id_user_key unique (id, user_id),
  constraint speaking_attempts_prompt_owner_fkey
    foreign key (prompt_id, user_id)
    references public.speaking_prompts (id, user_id)
    on delete cascade,
  constraint speaking_attempts_audio_path_key unique (audio_path),
  constraint speaking_attempts_audio_format_check check (
    audio_format = 'lpcm16-16000-mono'
  ),
  constraint speaking_attempts_audio_bytes_check check (
    audio_bytes between 3200 and 1000000
  ),
  constraint speaking_attempts_duration_check check (
    duration_seconds between 1 and 28
  ),
  constraint speaking_attempts_status_check check (
    analysis_status in ('pending', 'processing', 'completed', 'failed')
  ),
  constraint speaking_attempts_score_check check (
    score is null or score between 0 and 100
  ),
  constraint speaking_attempts_strengths_check check (
    jsonb_typeof(strengths) = 'array' and jsonb_array_length(strengths) <= 3
  ),
  constraint speaking_attempts_improvements_check check (
    jsonb_typeof(improvements) = 'array' and jsonb_array_length(improvements) <= 3
  ),
  constraint speaking_attempts_metrics_check check (
    jsonb_typeof(metrics) = 'object'
  ),
  constraint speaking_attempts_failure_code_check check (
    failure_code is null or failure_code in (
      'provider_timeout',
      'provider_unavailable',
      'provider_error',
      'configuration',
      'invalid_audio',
      'no_speech',
      'storage_error',
      'persistence_error'
    )
  ),
  constraint speaking_attempts_result_shape_check check (
    analysis_status <> 'completed'
    or (
      transcript is not null
      and char_length(btrim(transcript)) between 1 and 5000
      and score is not null
      and provider is not null
      and model is not null
    )
  )
);

create index speaking_attempts_user_date_created_idx
  on public.speaking_attempts (user_id, attempt_date desc, created_at desc);
create index speaking_attempts_prompt_id_idx
  on public.speaking_attempts (prompt_id);

create trigger speaking_attempts_touch_updated_at
before update on public.speaking_attempts
for each row execute function private.touch_updated_at();

alter table public.speaking_prompts enable row level security;
alter table public.speaking_attempts enable row level security;

create policy "speaking_prompts_select_own"
on public.speaking_prompts for select to authenticated
using ((select auth.uid()) = user_id);

create policy "speaking_attempts_select_own"
on public.speaking_attempts for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.speaking_prompts from public, anon, authenticated;
revoke all on public.speaking_attempts from public, anon, authenticated;
grant select on public.speaking_prompts to authenticated;
grant select on public.speaking_attempts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'speaking-audio',
  'speaking-audio',
  false,
  1000000,
  array['audio/l16', 'application/octet-stream']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "speaking_audio_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'speaking-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and right(name, 4) = '.pcm'
  and exists (
    select 1
    from public.speaking_attempts as attempt
    where attempt.user_id = (select auth.uid())
      and attempt.audio_path = name
      and attempt.analysis_status in ('pending', 'failed')
  )
);

create policy "speaking_audio_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'speaking-audio'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "speaking_audio_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'speaking-audio'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create function public.get_or_create_daily_speaking_prompt(
  p_reference_text text,
  p_cefr text
)
returns public.speaking_prompts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_local_date date;
  v_prompt public.speaking_prompts;
  v_reference_text text := btrim(p_reference_text);
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(v_reference_text) not between 80 and 700 then
    raise exception 'Speaking prompt is outside the allowed length'
      using errcode = '22023';
  end if;
  if p_cefr not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then
    raise exception 'Unknown prompt CEFR' using errcode = '22023';
  end if;

  v_local_date := private.user_local_date(v_user_id, now());

  insert into public.speaking_prompts (
    user_id,
    prompt_date,
    reference_text,
    cefr
  ) values (
    v_user_id,
    v_local_date,
    v_reference_text,
    p_cefr
  )
  on conflict (user_id, prompt_date) do nothing;

  select * into v_prompt
  from public.speaking_prompts
  where user_id = v_user_id and prompt_date = v_local_date;

  return v_prompt;
end;
$$;

create function public.begin_speaking_attempt(
  p_prompt_id uuid,
  p_submission_id uuid,
  p_audio_path text,
  p_duration_seconds integer,
  p_audio_bytes integer
)
returns public.speaking_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_local_date date;
  v_attempt public.speaking_attempts;
  v_expected_path text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'Submission ID is required' using errcode = '22004';
  end if;
  if p_duration_seconds not between 1 and 28 then
    raise exception 'Speaking duration is outside the allowed range'
      using errcode = '22023';
  end if;
  if p_audio_bytes not between 3200 and 1000000 then
    raise exception 'Speaking audio is outside the allowed size'
      using errcode = '22023';
  end if;

  v_expected_path := v_user_id::text || '/' || p_submission_id::text || '.pcm';
  if p_audio_path <> v_expected_path then
    raise exception 'Speaking audio path is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('speaking:' || v_user_id::text, 0)
  );

  select * into v_attempt
  from public.speaking_attempts
  where user_id = v_user_id and submission_id = p_submission_id
  for update;

  if found then
    return v_attempt;
  end if;

  v_local_date := private.user_local_date(v_user_id, now());
  if not exists (
    select 1
    from public.speaking_prompts as prompt
    where prompt.id = p_prompt_id
      and prompt.user_id = v_user_id
      and prompt.prompt_date = v_local_date
  ) then
    raise exception 'Speaking prompt not found' using errcode = 'P0002';
  end if;

  if (
    select count(*)
    from public.speaking_attempts
    where user_id = v_user_id and attempt_date = v_local_date
  ) >= 5 then
    raise exception 'Daily speaking limit reached' using errcode = 'P0001';
  end if;

  insert into public.speaking_attempts (
    submission_id,
    user_id,
    prompt_id,
    attempt_date,
    audio_path,
    audio_bytes,
    duration_seconds
  ) values (
    p_submission_id,
    v_user_id,
    p_prompt_id,
    v_local_date,
    p_audio_path,
    p_audio_bytes,
    p_duration_seconds
  )
  returning * into v_attempt;

  insert into public.daily_sessions (user_id, session_date, speaking_status)
  values (v_user_id, v_local_date, 'in_progress')
  on conflict (user_id, session_date) do update
  set speaking_status = case
    when public.daily_sessions.speaking_status in ('completed', 'skipped')
      then public.daily_sessions.speaking_status
    else 'in_progress'::public.daily_block_status
  end;

  return v_attempt;
end;
$$;

create function public.claim_speaking_attempt(p_attempt_id uuid)
returns table (
  attempt_id uuid,
  analysis_status text,
  should_process boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_attempt public.speaking_attempts;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.speaking_attempts
  where id = p_attempt_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Speaking attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.analysis_status = 'completed' then
    return query select v_attempt.id, v_attempt.analysis_status, false;
    return;
  end if;

  if v_attempt.analysis_status = 'processing'
     and v_attempt.updated_at > now() - interval '2 minutes' then
    return query select v_attempt.id, v_attempt.analysis_status, false;
    return;
  end if;

  update public.speaking_attempts
  set analysis_status = 'processing', failure_code = null
  where id = v_attempt.id and user_id = v_user_id
  returning * into v_attempt;

  return query select v_attempt.id, v_attempt.analysis_status, true;
end;
$$;

create function public.mark_speaking_attempt_failed(
  p_attempt_id uuid,
  p_failure_code text
)
returns public.speaking_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_attempt public.speaking_attempts;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_failure_code not in (
    'provider_timeout',
    'provider_unavailable',
    'provider_error',
    'configuration',
    'invalid_audio',
    'no_speech',
    'storage_error',
    'persistence_error'
  ) then
    raise exception 'Unknown speaking failure code' using errcode = '22023';
  end if;

  update public.speaking_attempts
  set analysis_status = 'failed', failure_code = p_failure_code
  where id = p_attempt_id
    and user_id = v_user_id
    and analysis_status <> 'completed'
  returning * into v_attempt;

  if not found then
    select * into v_attempt
    from public.speaking_attempts
    where id = p_attempt_id and user_id = v_user_id;
  end if;

  if not found then
    raise exception 'Speaking attempt not found' using errcode = 'P0002';
  end if;

  return v_attempt;
end;
$$;

create function public.complete_speaking_attempt(
  p_attempt_id uuid,
  p_transcript text,
  p_score smallint,
  p_strengths jsonb,
  p_improvements jsonb,
  p_metrics jsonb,
  p_provider text,
  p_model text
)
returns table (
  completed_attempt_id uuid,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_attempt public.speaking_attempts;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.speaking_attempts
  where id = p_attempt_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Speaking attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.analysis_status = 'completed' then
    return query select v_attempt.id, true;
    return;
  end if;
  if v_attempt.analysis_status <> 'processing' then
    raise exception 'Speaking attempt was not claimed for analysis'
      using errcode = 'P0001';
  end if;
  if char_length(btrim(p_transcript)) not between 1 and 5000 then
    raise exception 'Speaking transcript is invalid' using errcode = '22023';
  end if;
  if p_score not between 0 and 100 then
    raise exception 'Speaking score is invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(p_strengths) <> 'array'
     or jsonb_array_length(p_strengths) > 3
     or jsonb_typeof(p_improvements) <> 'array'
     or jsonb_array_length(p_improvements) > 3
     or jsonb_typeof(p_metrics) <> 'object' then
    raise exception 'Speaking feedback is invalid' using errcode = '22023';
  end if;
  if btrim(p_provider) = '' or btrim(p_model) = '' then
    raise exception 'Speaking provider metadata is required' using errcode = '22023';
  end if;

  update public.speaking_attempts
  set analysis_status = 'completed',
      transcript = btrim(p_transcript),
      score = p_score,
      strengths = p_strengths,
      improvements = p_improvements,
      metrics = p_metrics,
      failure_code = null,
      provider = btrim(p_provider),
      model = btrim(p_model)
  where id = v_attempt.id and user_id = v_user_id;

  insert into public.daily_sessions (
    user_id,
    session_date,
    speaking_status,
    speaking_seconds
  ) values (
    v_user_id,
    v_attempt.attempt_date,
    'completed',
    v_attempt.duration_seconds
  )
  on conflict (user_id, session_date) do update
  set speaking_status = case
        when public.daily_sessions.speaking_status = 'skipped'
          then public.daily_sessions.speaking_status
        else 'completed'::public.daily_block_status
      end,
      speaking_seconds = public.daily_sessions.speaking_seconds
        + v_attempt.duration_seconds;

  return query select v_attempt.id, false;
end;
$$;

revoke all on function public.get_or_create_daily_speaking_prompt(text, text)
  from public, anon, authenticated;
revoke all on function public.begin_speaking_attempt(uuid, uuid, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.claim_speaking_attempt(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_speaking_attempt_failed(uuid, text)
  from public, anon, authenticated;
revoke all on function public.complete_speaking_attempt(
  uuid, text, smallint, jsonb, jsonb, jsonb, text, text
) from public, anon, authenticated;

grant execute on function public.get_or_create_daily_speaking_prompt(text, text)
  to authenticated;
grant execute on function public.begin_speaking_attempt(uuid, uuid, text, integer, integer)
  to authenticated;
grant execute on function public.claim_speaking_attempt(uuid)
  to authenticated;
grant execute on function public.mark_speaking_attempt_failed(uuid, text)
  to authenticated;
grant execute on function public.complete_speaking_attempt(
  uuid, text, smallint, jsonb, jsonb, jsonb, text, text
) to authenticated;
