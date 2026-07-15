create or replace function public.begin_writing_entry(
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

  insert into public.daily_sessions (user_id, session_date)
  values (v_user_id, v_local_date)
  on conflict (user_id, session_date) do nothing;

  perform 1
  from public.daily_sessions
  where user_id = v_user_id and session_date = v_local_date
  for update;

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

  update public.daily_sessions
  set writing_status = case
    when writing_status in ('completed', 'skipped') then writing_status
    else 'in_progress'::public.daily_block_status
  end
  where user_id = v_user_id and session_date = v_local_date;

  return v_entry;
end;
$$;
