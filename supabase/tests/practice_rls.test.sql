begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

insert into auth.users (id, email)
values
  ('55555555-5555-4555-8555-555555555555', 'practice-one@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'practice-two@example.test');

insert into private.practice_content_sources (
  id, slug, name, homepage_url, license_code, license_url,
  commercial_use_allowed, approved, approved_at
) values (
  '70000000-0000-4000-8000-000000000001',
  'practice-test-cc0',
  'Practice test fixture',
  'https://example.test/practice-fixture',
  'CC0-1.0',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  true,
  true,
  now()
);

insert into private.practice_import_runs (
  id, source_id, source_release, downloaded_at, archive_sha256,
  importer_version, candidate_count, rejected_count, status
) values (
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000001',
  'fixture-1',
  now(),
  repeat('a', 64),
  'practice-test-1',
  2,
  0,
  'reviewing'
);

insert into private.practice_sentence_candidates (
  id, source_id, import_run_id, external_id, original_text, normalized_text,
  normalized_hash, license_code, screening_status
) values
  (
    '70000000-0000-4000-8000-000000000003',
    '70000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000002',
    'fixture-published',
    'She works from home every Friday.',
    'She works from home every Friday.',
    repeat('b', 64),
    'CC0-1.0',
    'accepted'
  ),
  (
    '70000000-0000-4000-8000-000000000004',
    '70000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000002',
    'fixture-draft',
    'They walk to work every morning.',
    'They walk to work every morning.',
    repeat('c', 64),
    'CC0-1.0',
    'accepted'
  );

insert into public.practice_exercises (
  id, candidate_id, exercise_type, grammar_topic, cefr_estimate, prompt,
  lemma, accepted_answers, explanation, transformation, license_code,
  source_credit, status, reviewed_by, reviewed_at, published_at
) values
  (
    '70000000-0000-4000-8000-000000000005',
    '70000000-0000-4000-8000-000000000003',
    'affirmative',
    'present_simple',
    'A1',
    'She ___ from home every Friday. (work)',
    'work',
    '["works"]'::jsonb,
    'Use -s with she in the Present Simple.',
    '{"rule":"present-simple-third-person"}'::jsonb,
    'CC0-1.0',
    'Practice test fixture',
    'published',
    'fixture-reviewer',
    now(),
    now()
  ),
  (
    '70000000-0000-4000-8000-000000000006',
    '70000000-0000-4000-8000-000000000004',
    'affirmative',
    'present_simple',
    'A1',
    'They ___ to work every morning. (walk)',
    'walk',
    '["walk"]'::jsonb,
    'Use the base form with they.',
    '{"rule":"present-simple-base"}'::jsonb,
    'CC0-1.0',
    'Practice test fixture',
    'draft',
    null,
    null,
    null
  );

select ok(
  not has_table_privilege('anon', 'public.practice_exercises', 'SELECT'),
  'anonymous clients cannot read the shared catalog'
);
select ok(
  has_table_privilege('authenticated', 'public.practice_exercises', 'SELECT'),
  'authenticated clients have explicit read access to the catalog'
);
select ok(
  not has_table_privilege('authenticated', 'public.practice_exercises', 'INSERT'),
  'authenticated clients cannot insert shared exercises'
);
select ok(
  not has_table_privilege('authenticated', 'public.practice_exercises', 'UPDATE'),
  'authenticated clients cannot update shared exercises'
);
select ok(
  not has_table_privilege('authenticated', 'public.practice_exercises', 'DELETE'),
  'authenticated clients cannot delete shared exercises'
);
select ok(
  not has_table_privilege('authenticated', 'private.practice_content_sources', 'SELECT'),
  'private source data is unavailable to authenticated clients'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'the private schema is not exposed to authenticated clients'
);
select ok(
  not has_table_privilege('authenticated', 'public.practice_attempts', 'INSERT'),
  'attempt rows cannot bypass the validated submission function'
);

set local role authenticated;
set local search_path = public, extensions;
select set_config(
  'request.jwt.claim.sub',
  '55555555-5555-4555-8555-555555555555',
  true
);

select is(
  (select count(*)::integer from public.practice_exercises),
  1,
  'authenticated learners see only published exercises'
);
select is(
  (select count(*)::integer from public.get_practice_session(10)),
  1,
  'the practice session contains only published exercises'
);
select is(
  (
    select result.is_correct
    from public.submit_practice_attempt(
      '70000000-0000-4000-8000-000000000005',
      '  WORKS  ',
      1200,
      '70000000-0000-4000-8000-000000000007'
    ) as result
  ),
  true,
  'the server normalizes and checks a correct answer'
);
select is(
  (
    select result.duplicate
    from public.submit_practice_attempt(
      '70000000-0000-4000-8000-000000000005',
      'works',
      1200,
      '70000000-0000-4000-8000-000000000007'
    ) as result
  ),
  true,
  'a retry with the same submission ID is idempotent'
);
select is(
  (select count(*)::integer from public.practice_attempts),
  1,
  'an idempotent retry creates one attempt row'
);
select throws_ok(
  $$
    select * from public.submit_practice_attempt(
      '70000000-0000-4000-8000-000000000006',
      'walk',
      900,
      '70000000-0000-4000-8000-000000000008'
    )
  $$,
  'P0002',
  'Published exercise not found',
  'draft exercises cannot receive learner attempts'
);
select throws_ok(
  $$
    select * from public.submit_practice_attempt(
      '70000000-0000-4000-8000-000000000005',
      'different answer',
      900,
      '70000000-0000-4000-8000-000000000007'
    )
  $$,
  'P0001',
  'Submission ID already belongs to another answer',
  'a submission ID cannot be reused for different content'
);

select set_config(
  'request.jwt.claim.sub',
  '66666666-6666-4666-8666-666666666666',
  true
);
select is(
  (select count(*)::integer from public.practice_attempts),
  0,
  'a learner cannot read another learner attempts'
);
select is(
  (
    select result.is_correct
    from public.submit_practice_attempt(
      '70000000-0000-4000-8000-000000000005',
      'work',
      1000,
      '70000000-0000-4000-8000-000000000009'
    ) as result
  ),
  false,
  'a grammatically different answer is not over-accepted'
);
select is(
  (select count(*)::integer from public.practice_attempts),
  1,
  'the second learner can read their own attempt'
);

reset role;
set local search_path = public, extensions;
select throws_ok(
  $$
    insert into public.practice_exercises (
      candidate_id, exercise_type, grammar_topic, cefr_estimate, prompt,
      accepted_answers, transformation, license_code, source_credit
    ) values (
      '70000000-0000-4000-8000-000000000004',
      'affirmative', 'present_simple', 'A1', 'They ___ here.',
      '[]'::jsonb, '{}'::jsonb, 'CC0-1.0', 'Fixture'
    )
  $$,
  '23514',
  null,
  'accepted answers must be a non-empty string array'
);
select throws_ok(
  $$
    update public.practice_exercises
    set status = 'published'
    where id = '70000000-0000-4000-8000-000000000006'
  $$,
  '23514',
  null,
  'publication requires a recorded human review'
);
select throws_ok(
  $$
    insert into public.practice_exercises (
      candidate_id, exercise_type, grammar_topic, cefr_estimate, prompt,
      accepted_answers, transformation, license_code, source_credit
    ) values (
      '70000000-0000-4000-8000-000000000004',
      'affirmative', 'present_simple', 'A1', 'They ___ here.',
      '["Walk"]'::jsonb, '{}'::jsonb, 'CC0-1.0', 'Fixture'
    )
  $$,
  '23514',
  null,
  'accepted answers must already be normalized'
);
update private.practice_sentence_candidates
set screening_status = 'rejected', rejection_reasons = '["incorrect_grammar"]'::jsonb
where id = '70000000-0000-4000-8000-000000000004';
select throws_ok(
  $$
    insert into public.practice_exercises (
      candidate_id, content_version, exercise_type, grammar_topic, cefr_estimate,
      prompt, accepted_answers, transformation, license_code, source_credit,
      status, reviewed_by, reviewed_at, published_at
    ) values (
      '70000000-0000-4000-8000-000000000004', 2, 'question',
      'present_simple', 'A1', '___ they walk here? (do)', '["do"]'::jsonb,
      '{}'::jsonb, 'CC0-1.0', 'Fixture', 'published', 'reviewer', now(), now()
    )
  $$,
  'P0001',
  'Published exercise requires accepted, approved provenance',
  'publication rejects a candidate that failed screening'
);

select * from finish();
rollback;
