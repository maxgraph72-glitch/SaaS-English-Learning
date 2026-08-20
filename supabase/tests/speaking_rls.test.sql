begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'speaker-one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'speaker-two@example.test');

insert into public.speaking_prompts (
  id, user_id, prompt_date, reference_text, cefr
) values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '22222222-2222-4222-8222-222222222222',
  current_date,
  'This private prompt belongs to another learner. It has five calm sentences. Each sentence is clear. The learner reads it aloud. The recording stays private.',
  'A2'
);

insert into public.speaking_attempts (
  id, submission_id, user_id, prompt_id, attempt_date, audio_path,
  audio_bytes, duration_seconds
) values (
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '22222222-2222-4222-8222-222222222222',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  current_date,
  '22222222-2222-4222-8222-222222222222/dddddddd-dddd-4ddd-8ddd-dddddddddddd.pcm',
  384000,
  12
);

set local role authenticated;
set local search_path = public, extensions;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

select lives_ok(
  $$
    select public.get_or_create_daily_speaking_prompt(
      'Today is a good day to practice English. I speak slowly and clearly. Every sentence has a calm rhythm. Small mistakes help me learn. My voice becomes more confident.',
      'A2'
    )
  $$,
  'an authenticated learner can get a daily owned prompt'
);

select is(
  (select count(*)::integer from public.speaking_prompts),
  1,
  'RLS exposes only the current learner prompt'
);

select lives_ok(
  $$
    select public.begin_speaking_attempt(
      (select id from public.speaking_prompts),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pcm',
      12,
      384000
    )
  $$,
  'an authenticated learner can begin an owned attempt'
);

select is(
  (select speaking_status::text from public.daily_sessions),
  'in_progress',
  'beginning an attempt starts the daily Speaking block'
);

select is(
  (select count(*)::integer from public.speaking_attempts),
  1,
  'another learner attempt is hidden by RLS'
);

select is(
  (
    select (public.begin_speaking_attempt(
      (select id from public.speaking_prompts),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pcm',
      12,
      384000
    )).id
  ),
  (select id from public.speaking_attempts),
  'the same submission returns the same attempt'
);

select throws_ok(
  $$
    select public.begin_speaking_attempt(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pcm',
      12,
      384000
    )
  $$,
  'P0002',
  'Speaking prompt not found',
  'a learner cannot start an attempt for another learner prompt'
);

select is(
  (
    select should_process
    from public.claim_speaking_attempt((select id from public.speaking_attempts))
  ),
  true,
  'an owned pending attempt can be claimed'
);

select lives_ok(
  $$
    select public.complete_speaking_attempt(
      (select id from public.speaking_attempts),
      'Today is a good day to practice English and I speak slowly and clearly.',
      90::smallint,
      '["The reading was complete."]'::jsonb,
      '["Keep a steady pace."]'::jsonb,
      '{"completeness":90,"wordAccuracy":92,"fluency":88,"wordsPerMinute":105}'::jsonb,
      'fixture',
      'deterministic-v1'
    )
  $$,
  'valid feedback completes an attempt atomically'
);

select is(
  (select analysis_status from public.speaking_attempts),
  'completed',
  'the attempt is completed'
);

select is(
  (select speaking_status::text from public.daily_sessions),
  'completed',
  'accepted feedback completes the daily Speaking block'
);

select is(
  (select speaking_seconds from public.daily_sessions),
  12,
  'accepted feedback adds speaking duration'
);

select is(
  (select score::integer from public.speaking_attempts),
  90,
  'the validated score is stored'
);

select is(
  (
    select duplicate
    from public.complete_speaking_attempt(
      (select id from public.speaking_attempts),
      'Today is a good day to practice English and I speak slowly and clearly.',
      90::smallint,
      '["The reading was complete."]'::jsonb,
      '["Keep a steady pace."]'::jsonb,
      '{"completeness":90}'::jsonb,
      'fixture',
      'deterministic-v1'
    )
  ),
  true,
  'repeated completion is recognized as a duplicate'
);

select is(
  (select speaking_seconds from public.daily_sessions),
  12,
  'repeated completion does not add duration twice'
);

select ok(
  not has_table_privilege('authenticated', 'public.speaking_attempts', 'INSERT'),
  'authenticated clients cannot bypass begin attempt validation'
);

select ok(
  not has_table_privilege('authenticated', 'public.speaking_attempts', 'UPDATE'),
  'authenticated clients cannot forge speaking feedback'
);

set local role postgres;

select is(
  (select public from storage.buckets where id = 'speaking-audio'),
  false,
  'the speaking audio bucket is private'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'speaking_audio_%'
  ),
  3,
  'storage has owned insert, select, and delete policies'
);

set local role authenticated;
set local search_path = public, extensions;

select is(
  (select count(*)::integer from public.speaking_attempts where user_id = '22222222-2222-4222-8222-222222222222'),
  0,
  'another learner attempt remains hidden after completion'
);

select * from finish();
rollback;
