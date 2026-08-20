create schema if not exists private;

create function private.is_nonempty_text_array(p_value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'array'
    and jsonb_array_length(p_value) > 0
    and not exists (
      select 1
      from jsonb_array_elements(p_value) as item(value)
      where jsonb_typeof(item.value) <> 'string'
        or btrim(item.value #>> '{}') = ''
    );
$$;

create function private.normalize_practice_answer(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(
    btrim(
      regexp_replace(
        translate(normalize(p_value, NFKC), U&'\2018\2019\02BC\FF07', U&'\0027\0027\0027\0027'),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  );
$$;

create table private.practice_content_sources (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  homepage_url text not null,
  license_code text not null,
  license_url text not null,
  terms_url text,
  attribution_template text,
  commercial_use_allowed boolean not null,
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint practice_content_sources_slug_check check (btrim(slug) <> ''),
  constraint practice_content_sources_name_check check (btrim(name) <> ''),
  constraint practice_content_sources_license_check check (btrim(license_code) <> ''),
  constraint practice_content_sources_approval_check check (
    (approved and commercial_use_allowed and approved_at is not null)
    or (not approved and approved_at is null)
  )
);

create table private.practice_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.practice_content_sources (id),
  source_release text not null,
  downloaded_at timestamptz not null,
  archive_sha256 text not null,
  importer_version text not null,
  candidate_count integer not null default 0,
  rejected_count integer not null default 0,
  published_count integer not null default 0,
  package_version text,
  status text not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint practice_import_runs_release_check check (btrim(source_release) <> ''),
  constraint practice_import_runs_sha256_check check (archive_sha256 ~ '^[0-9a-f]{64}$'),
  constraint practice_import_runs_importer_check check (btrim(importer_version) <> ''),
  constraint practice_import_runs_counts_check check (
    candidate_count >= 0 and rejected_count >= 0 and published_count >= 0
    and rejected_count <= candidate_count
    and published_count <= candidate_count
  ),
  constraint practice_import_runs_status_check check (
    status in ('pending', 'imported', 'reviewing', 'published', 'failed')
  ),
  constraint practice_import_runs_completion_check check (
    (status = 'published' and completed_at is not null and package_version is not null)
    or status <> 'published'
  )
);

create index practice_import_runs_source_id_idx
  on private.practice_import_runs (source_id);

create table private.practice_sentence_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.practice_content_sources (id),
  import_run_id uuid not null references private.practice_import_runs (id),
  external_id text not null,
  language text not null default 'en',
  original_text text not null,
  normalized_text text not null,
  normalized_hash text not null,
  license_code text not null,
  source_url text,
  source_creator text,
  analysis jsonb not null default '{}'::jsonb,
  screening_status text not null default 'pending',
  rejection_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint practice_sentence_candidates_source_item_key unique (source_id, external_id),
  constraint practice_sentence_candidates_normalized_hash_key unique (normalized_hash),
  constraint practice_sentence_candidates_external_id_check check (btrim(external_id) <> ''),
  constraint practice_sentence_candidates_language_check check (language = 'en'),
  constraint practice_sentence_candidates_text_check check (
    btrim(original_text) <> '' and btrim(normalized_text) <> ''
  ),
  constraint practice_sentence_candidates_hash_check check (normalized_hash ~ '^[0-9a-f]{64}$'),
  constraint practice_sentence_candidates_license_check check (btrim(license_code) <> ''),
  constraint practice_sentence_candidates_analysis_check check (jsonb_typeof(analysis) = 'object'),
  constraint practice_sentence_candidates_status_check check (
    screening_status in ('pending', 'accepted', 'rejected', 'quarantined')
  ),
  constraint practice_sentence_candidates_rejections_check check (
    jsonb_typeof(rejection_reasons) = 'array'
  )
);

create index practice_sentence_candidates_source_id_idx
  on private.practice_sentence_candidates (source_id);
create index practice_sentence_candidates_import_run_id_idx
  on private.practice_sentence_candidates (import_run_id);

create table public.practice_exercises (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references private.practice_sentence_candidates (id),
  content_version integer not null default 1,
  exercise_type text not null,
  grammar_topic text not null,
  cefr_estimate text not null,
  prompt text not null,
  hint text,
  lemma text,
  accepted_answers jsonb not null,
  distractors jsonb not null default '[]'::jsonb,
  explanation text,
  transformation jsonb not null,
  license_code text not null,
  source_credit text not null,
  status text not null default 'draft',
  reviewed_by text,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_exercises_candidate_version_key unique (
    candidate_id, grammar_topic, exercise_type, content_version
  ),
  constraint practice_exercises_version_check check (content_version > 0),
  constraint practice_exercises_type_check check (
    exercise_type in ('affirmative', 'negative', 'question', 'tense_contrast')
  ),
  constraint practice_exercises_topic_check check (
    grammar_topic in (
      'present_simple',
      'present_continuous',
      'present_simple_vs_continuous'
    )
  ),
  constraint practice_exercises_cefr_check check (cefr_estimate in ('A1', 'A2', 'B1')),
  constraint practice_exercises_prompt_check check (
    btrim(prompt) <> '' and (length(prompt) - length(replace(prompt, '___', ''))) / 3 = 1
  ),
  constraint practice_exercises_answers_check check (
    private.is_nonempty_text_array(accepted_answers)
  ),
  constraint practice_exercises_distractors_check check (jsonb_typeof(distractors) = 'array'),
  constraint practice_exercises_transformation_check check (jsonb_typeof(transformation) = 'object'),
  constraint practice_exercises_license_check check (btrim(license_code) <> ''),
  constraint practice_exercises_source_credit_check check (btrim(source_credit) <> ''),
  constraint practice_exercises_status_check check (
    status in ('draft', 'in_review', 'rejected', 'published', 'retired')
  ),
  constraint practice_exercises_publication_check check (
    status <> 'published'
    or (
      reviewed_by is not null and btrim(reviewed_by) <> ''
      and reviewed_at is not null
      and published_at is not null
    )
  )
);

create index practice_exercises_published_topic_idx
  on public.practice_exercises (grammar_topic, exercise_type, created_at)
  where status = 'published';

create trigger practice_exercises_touch_updated_at
before update on public.practice_exercises
for each row execute function private.touch_updated_at();

create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.practice_exercises (id),
  submitted_answer text not null,
  is_correct boolean not null,
  response_ms integer not null,
  attempt_date date not null,
  created_at timestamptz not null default now(),
  constraint practice_attempts_user_submission_key unique (user_id, submission_id),
  constraint practice_attempts_answer_check check (btrim(submitted_answer) <> ''),
  constraint practice_attempts_response_ms_check check (response_ms between 0 and 3600000)
);

create index practice_attempts_user_date_created_idx
  on public.practice_attempts (user_id, attempt_date desc, created_at desc);
create index practice_attempts_exercise_id_idx
  on public.practice_attempts (exercise_id);

alter table public.practice_exercises enable row level security;
alter table public.practice_attempts enable row level security;

create policy "practice_exercises_select_published"
on public.practice_exercises for select to authenticated
using (status = 'published');

create policy "practice_attempts_select_own"
on public.practice_attempts for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.practice_exercises from public, anon, authenticated;
revoke all on table public.practice_attempts from public, anon, authenticated;
grant select on table public.practice_exercises to authenticated;
grant select on table public.practice_attempts to authenticated;

create function public.get_practice_session(p_limit integer default 10)
returns setof public.practice_exercises
language sql
stable
security invoker
set search_path = ''
as $$
  select exercise.*
  from public.practice_exercises as exercise
  left join lateral (
    select
      count(*) as attempt_count,
      bool_or(not attempt.is_correct) as has_incorrect,
      max(attempt.created_at) as last_attempted_at
    from public.practice_attempts as attempt
    where attempt.user_id = (select auth.uid())
      and attempt.exercise_id = exercise.id
  ) as history on true
  where exercise.status = 'published'
    and (select auth.uid()) is not null
  order by
    case
      when history.attempt_count = 0 then 0
      when history.has_incorrect then 1
      else 2
    end,
    history.last_attempted_at asc nulls first,
    md5(exercise.id::text || (select auth.uid())::text)
  limit least(greatest(coalesce(p_limit, 10), 1), 10);
$$;

create function public.submit_practice_attempt(
  p_exercise_id uuid,
  p_submitted_answer text,
  p_response_ms integer,
  p_submission_id uuid
)
returns table (
  attempt_id uuid,
  exercise_id uuid,
  is_correct boolean,
  duplicate boolean,
  correct_answer text,
  explanation text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_exercise public.practice_exercises;
  v_existing public.practice_attempts;
  v_answer text;
  v_is_correct boolean;
  v_attempt_id uuid;
  v_attempt_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'Submission ID is required' using errcode = '22004';
  end if;
  if p_exercise_id is null then
    raise exception 'Exercise ID is required' using errcode = '22004';
  end if;
  if p_submitted_answer is null or btrim(p_submitted_answer) = '' then
    raise exception 'Answer is required' using errcode = '22023';
  end if;
  if p_response_ms is null or p_response_ms not between 0 and 3600000 then
    raise exception 'Response time is outside the allowed range' using errcode = '22023';
  end if;

  select * into v_existing
  from public.practice_attempts as attempt
  where attempt.user_id = v_user_id
    and attempt.submission_id = p_submission_id;

  if found then
    if v_existing.exercise_id <> p_exercise_id
       or private.normalize_practice_answer(v_existing.submitted_answer)
          <> private.normalize_practice_answer(p_submitted_answer) then
      raise exception 'Submission ID already belongs to another answer'
        using errcode = 'P0001';
    end if;

    select * into v_exercise
    from public.practice_exercises as exercise
    where exercise.id = v_existing.exercise_id;

    return query select
      v_existing.id,
      v_existing.exercise_id,
      v_existing.is_correct,
      true,
      v_exercise.accepted_answers ->> 0,
      v_exercise.explanation;
    return;
  end if;

  select * into v_exercise
  from public.practice_exercises as exercise
  where exercise.id = p_exercise_id
    and exercise.status = 'published';

  if not found then
    raise exception 'Published exercise not found' using errcode = 'P0002';
  end if;

  v_answer := private.normalize_practice_answer(p_submitted_answer);
  select exists (
    select 1
    from jsonb_array_elements_text(v_exercise.accepted_answers) as accepted(answer)
    where private.normalize_practice_answer(accepted.answer) = v_answer
  ) into v_is_correct;
  v_attempt_date := private.user_local_date(v_user_id, now());

  insert into public.practice_attempts (
    submission_id,
    user_id,
    exercise_id,
    submitted_answer,
    is_correct,
    response_ms,
    attempt_date
  ) values (
    p_submission_id,
    v_user_id,
    v_exercise.id,
    btrim(p_submitted_answer),
    v_is_correct,
    p_response_ms,
    v_attempt_date
  )
  returning id into v_attempt_id;

  return query select
    v_attempt_id,
    v_exercise.id,
    v_is_correct,
    false,
    v_exercise.accepted_answers ->> 0,
    v_exercise.explanation;
end;
$$;

comment on function public.get_practice_session(integer) is
'Returns up to ten published exercises, preferring unseen work and then previously incorrect work.';
comment on function public.submit_practice_attempt(uuid, text, integer, uuid) is
'Checks a normalized answer and saves one idempotent attempt for the authenticated learner.';

revoke all on function public.get_practice_session(integer)
  from public, anon, authenticated;
revoke all on function public.submit_practice_attempt(uuid, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.get_practice_session(integer) to authenticated;
grant execute on function public.submit_practice_attempt(uuid, text, integer, uuid)
  to authenticated;

revoke all on function private.is_nonempty_text_array(jsonb)
  from public, anon, authenticated;
revoke all on function private.normalize_practice_answer(text)
  from public, anon, authenticated;
revoke all on table private.practice_content_sources from public, anon, authenticated;
revoke all on table private.practice_import_runs from public, anon, authenticated;
revoke all on table private.practice_sentence_candidates from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
