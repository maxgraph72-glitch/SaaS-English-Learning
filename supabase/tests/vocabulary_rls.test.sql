begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'learner-one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'learner-two@example.test');

insert into public.vocabulary_items (
  id,
  user_id,
  english_word,
  translation,
  current_group,
  repetition_stage,
  learned_at,
  next_review_date
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'steady',
    'устойчивый',
    'learning',
    1,
    now(),
    current_date
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'calm',
    'спокойный',
    'learning',
    1,
    now(),
    current_date
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '11111111-1111-4111-8111-111111111111',
    'recover',
    'восстанавливать',
    'known',
    4,
    now() - interval '8 days',
    current_date - 1
  );

set local role authenticated;
set local search_path = public, extensions;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

select is(
  (select count(*)::integer from public.vocabulary_items),
  2,
  'a learner can see exactly their own vocabulary items'
);
select is(
  (select count(*)::integer from public.vocabulary_items where english_word = 'calm'),
  0,
  'another learner vocabulary is hidden by RLS'
);

select is(
  (
    select duplicate
    from public.submit_vocabulary_review(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      true,
      2999,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    )
  ),
  false,
  'the first review submission is applied'
);
select is(
  (
    select duplicate
    from public.submit_vocabulary_review(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      true,
      2999,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    )
  ),
  true,
  'a retried submission is recognized as a duplicate'
);
select is(
  (select count(*)::integer from public.vocabulary_reviews),
  1,
  'a retried submission creates only one immutable history row'
);
select is(
  (
    select repetition_stage::integer
    from public.vocabulary_items
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  2,
  'a retried submission advances the stage only once'
);

select lives_ok(
  $$ select count(*) from public.get_due_vocabulary() $$,
  'loading the automatic due queue succeeds'
);
select is(
  (
    select concat_ws(
      '|',
      repetition_stage,
      next_review_date,
      overdue_stage_decay_pending
    )
    from public.vocabulary_items
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  concat_ws('|', 4, current_date - 1, false),
  'loading the due queue does not mutate an overdue word'
);
select lives_ok(
  $$ select count(*) from public.get_due_vocabulary() $$,
  'the due queue can be loaded repeatedly'
);
select is(
  (
    select repetition_stage::integer
    from public.vocabulary_items
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  4,
  'reloading the due queue remains read only'
);
select is(
  (
    select concat_ws('|', group_after, stage_after, next_review_date)
    from public.submit_vocabulary_review(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      true,
      2000,
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    )
  ),
  concat_ws('|', 'known', 5, current_date + 30),
  'an overdue word schedules from the actual answer and recall quality'
);
select is(
  (
    select overdue_stage_decay_pending
    from public.vocabulary_items
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  false,
  'the deprecated missed-review flag remains cleared'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
select is(
  (select count(*)::integer from public.vocabulary_reviews),
  0,
  'review history is isolated between learners'
);

select * from finish();
rollback;
