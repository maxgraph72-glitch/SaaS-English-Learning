alter table public.speaking_attempts
  drop constraint speaking_attempts_audio_bytes_check,
  drop constraint speaking_attempts_duration_check;

alter table public.speaking_attempts
  add constraint speaking_attempts_audio_bytes_check check (
    audio_bytes between 3200 and 3840000
  ),
  add constraint speaking_attempts_duration_check check (
    duration_seconds between 1 and 120
  );

update storage.buckets
set file_size_limit = 3840000
where id = 'speaking-audio';

create or replace function public.begin_speaking_attempt(
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
  if p_duration_seconds not between 1 and 120 then
    raise exception 'Speaking duration is outside the allowed range'
      using errcode = '22023';
  end if;
  if p_audio_bytes not between 3200 and 3840000 then
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

revoke all on function public.begin_speaking_attempt(uuid, uuid, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.begin_speaking_attempt(uuid, uuid, text, integer, integer)
to authenticated;
