begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'writer-one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'writer-two@example.test');

insert into public.writing_entries (
  id,
  user_id,
  submission_id,
  entry_date,
  original_text,
  word_count,
  feedback_status,
  active_seconds
) values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '22222222-2222-4222-8222-222222222222',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  current_date,
  'This private entry belongs only to the second learner.',
  9,
  'pending',
  20
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
    select public.begin_writing_entry(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'I go to the park today and I feel very happy about it.',
      123
    )
  $$,
  'an authenticated learner can save an owned writing entry'
);

select is(
  (
    select writing_status::text
    from public.daily_sessions
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'in_progress',
  'saving an original starts the Writing block'
);

select is(
  (select count(*)::integer from public.writing_entries),
  1,
  'RLS exposes only the first learner owned entry'
);

select is(
  (
    select (public.begin_writing_entry(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'I go to the park today and I feel very happy about it.',
      999
    )).id
  ),
  (select id from public.writing_entries where submission_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'the same submission ID returns the same entry'
);

select is(
  (select count(*)::integer from public.writing_entries where user_id = '22222222-2222-4222-8222-222222222222'),
  0,
  'another learner writing is hidden by RLS'
);

select throws_ok(
  $$ select * from public.claim_writing_entry_for_feedback('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') $$,
  'P0002',
  'Writing entry not found',
  'a learner cannot claim another learner entry'
);

select is(
  (
    select should_process
    from public.claim_writing_entry_for_feedback(
      (select id from public.writing_entries where submission_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    )
  ),
  true,
  'a pending owned entry can be claimed for feedback'
);

select lives_ok(
  $$
    select public.accept_writing_feedback(
      (select id from public.writing_entries where submission_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      'I went to the park today and I felt very happy about it.',
      '[{"original":"I go","correction":"I went","category":"grammar","explanation":"Use the past tense for a finished event."}]'::jsonb,
      'B1',
      'The entry connects familiar ideas with a clear timeline.',
      1::smallint,
      'writing-v1',
      'fixture',
      'deterministic-v1'
    )
  $$,
  'valid feedback can be accepted atomically'
);

select is(
  (select feedback_status::text from public.writing_entries where submission_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'completed',
  'accepted feedback completes the writing entry'
);

select is(
  (
    select writing_status::text
    from public.daily_sessions
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'completed',
  'accepted feedback completes the daily Writing block'
);

select is(
  (
    select writing_seconds
    from public.daily_sessions
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  123,
  'accepted feedback adds the bounded active duration'
);

select is(
  (
    select duplicate
    from public.accept_writing_feedback(
      (select id from public.writing_entries where submission_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      'I went to the park today and I felt very happy about it.',
      '[{"original":"I go","correction":"I went","category":"grammar","explanation":"Use the past tense for a finished event."}]'::jsonb,
      'B1',
      'The entry connects familiar ideas with a clear timeline.',
      1::smallint,
      'writing-v1',
      'fixture',
      'deterministic-v1'
    )
  ),
  true,
  'repeated acceptance is recognized as a duplicate'
);

select is(
  (select count(*)::integer from public.writing_feedback),
  1,
  'repeated acceptance creates one immutable feedback row'
);

select is(
  (
    select writing_seconds
    from public.daily_sessions
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  123,
  'repeated acceptance does not add duration twice'
);

select ok(
  not has_table_privilege('authenticated', 'public.writing_feedback', 'UPDATE'),
  'authenticated clients cannot update accepted feedback'
);

select lives_ok(
  $$
    select public.begin_writing_entry(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'Tomorrow I plan to write another calm and useful diary entry.',
      42
    )
  $$,
  'a second original can be saved for failure recovery'
);

select lives_ok(
  $$
    select public.mark_writing_entry_failed(
      (select id from public.writing_entries where submission_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      'provider_timeout'
    )
  $$,
  'a provider failure can be recorded without losing the original'
);

select is(
  (select feedback_status::text from public.writing_entries where submission_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'failed',
  'the failed entry remains available'
);

select is(
  (
    select should_process
    from public.claim_writing_entry_for_feedback(
      (select id from public.writing_entries where submission_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    )
  ),
  true,
  'a failed entry can be claimed again'
);

select lives_ok(
  $$
    select public.accept_writing_feedback(
      (select id from public.writing_entries where submission_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      'Tomorrow I plan to write another calm and useful diary entry.',
      '[]'::jsonb,
      'B1',
      'The entry uses a clear future plan and familiar vocabulary.',
      1::smallint,
      'writing-v1',
      'fixture',
      'deterministic-v1'
    )
  $$,
  'a retry can persist valid feedback for the same entry'
);

select is(
  (select feedback_status::text from public.writing_entries where submission_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'completed',
  'a successful retry completes the failed entry'
);

select is(
  (select count(*)::integer from public.writing_feedback),
  2,
  'failure recovery creates one accepted record per entry'
);

select lives_ok(
  $$
    do $block$
    declare
      v_index integer;
      v_submission_id uuid;
    begin
      for v_index in 1..8 loop
        v_submission_id := (
          'c0000000-0000-4000-8000-' || lpad(v_index::text, 12, '0')
        )::uuid;
        perform public.begin_writing_entry(
          v_submission_id,
          'This daily limit test entry contains enough useful characters.',
          1
        );
      end loop;
    end;
    $block$
  $$,
  'the learner can save up to ten entries on one local day'
);

select is(
  (select count(*)::integer from public.writing_entries),
  10,
  'the daily limit counts only the current learner visible entries'
);

select throws_ok(
  $$
    select public.begin_writing_entry(
      'c0000000-0000-4000-8000-999999999999',
      'This eleventh daily entry should be rejected before any AI request.',
      1
    )
  $$,
  'P0001',
  'Daily writing limit reached',
  'an eleventh entry is rejected by the database rate limit'
);

select * from finish();
rollback;
