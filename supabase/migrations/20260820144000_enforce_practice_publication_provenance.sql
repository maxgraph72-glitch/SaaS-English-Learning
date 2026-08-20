create function private.validate_practice_exercise_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.status in ('published', 'retired')
     and (
       new.candidate_id,
       new.content_version,
       new.exercise_type,
       new.grammar_topic,
       new.cefr_estimate,
       new.prompt,
       new.hint,
       new.lemma,
       new.accepted_answers,
       new.distractors,
       new.explanation,
       new.transformation,
       new.license_code,
       new.source_credit,
       new.reviewed_by,
       new.reviewed_at,
       new.published_at
     ) is distinct from (
       old.candidate_id,
       old.content_version,
       old.exercise_type,
       old.grammar_topic,
       old.cefr_estimate,
       old.prompt,
       old.hint,
       old.lemma,
       old.accepted_answers,
       old.distractors,
       old.explanation,
       old.transformation,
       old.license_code,
       old.source_credit,
       old.reviewed_by,
       old.reviewed_at,
       old.published_at
     ) then
    raise exception 'Published practice exercise content is immutable'
      using errcode = 'P0001';
  end if;

  if new.status = 'published' and not exists (
    select 1
    from private.practice_sentence_candidates as candidate
    join private.practice_content_sources as source
      on source.id = candidate.source_id
    where candidate.id = new.candidate_id
      and candidate.screening_status = 'accepted'
      and candidate.license_code = new.license_code
      and source.license_code = new.license_code
      and source.approved
      and source.commercial_use_allowed
  ) then
    raise exception 'Published exercise requires accepted, approved provenance'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger practice_exercises_validate_publication
before insert or update on public.practice_exercises
for each row execute function private.validate_practice_exercise_publication();

revoke all on function private.validate_practice_exercise_publication()
  from public, anon, authenticated;
