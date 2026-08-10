begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

insert into auth.users (id, email)
values
  ('33333333-3333-4333-8333-333333333333', 'manager-one@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'manager-two@example.test');

insert into public.vocabulary_items (
  id,
  user_id,
  english_word,
  translation,
  current_group,
  learning_state,
  knowledge_category,
  repetition_stage,
  learned_at,
  last_reviewed_at,
  next_review_date
)
values
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '33333333-3333-4333-8333-333333333333',
    'original',
    'first translation',
    'known',
    'scheduled',
    1,
    5,
    '2026-07-01 10:00:00+00',
    '2026-07-10 10:00:00+00',
    '2026-07-20'
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '44444444-4444-4444-8444-444444444444',
    'private',
    'second translation',
    'known',
    'scheduled',
    1,
    5,
    '2026-07-01 10:00:00+00',
    '2026-07-10 10:00:00+00',
    '2026-07-20'
  );

insert into public.vocabulary_reviews (
  id,
  submission_id,
  user_id,
  vocabulary_item_id,
  reviewed_at,
  local_review_date,
  correct,
  response_time_ms,
  group_before,
  group_after,
  category_before,
  category_after,
  stage_before,
  stage_after,
  next_review_date,
  next_review_date_before,
  next_review_date_after,
  attempt_kind,
  overdue_action,
  scheduled_review_date
)
values (
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  '99999999-9999-4999-8999-999999999999',
  '33333333-3333-4333-8333-333333333333',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '2026-07-10 10:00:00+00',
  '2026-07-10',
  true,
  2000,
  'known',
  'known',
  1,
  1,
  4,
  5,
  '2026-07-20',
  '2026-07-10',
  '2026-07-20',
  'scheduled',
  'none',
  '2026-07-10'
);

set local role authenticated;
set local search_path = public, extensions;
select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);

with changed as (
  update public.vocabulary_items
  set english_word = 'revised', translation = 'updated translation'
  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  returning id
)
select is(
  (select count(*)::integer from changed),
  1,
  'a learner can update the content of their scheduled known word'
);

select is(
  (
    select concat_ws('|', english_word, repetition_stage, next_review_date)
    from public.vocabulary_items
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  'revised|5|2026-07-20',
  'editing preserves the repetition stage and schedule'
);

with changed as (
  update public.vocabulary_items
  set translation = 'not allowed'
  where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  returning id
)
select is(
  (select count(*)::integer from changed),
  0,
  'a learner cannot update another learner vocabulary'
);

with removed as (
  delete from public.vocabulary_items
  where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  returning id
)
select is(
  (select count(*)::integer from removed),
  0,
  'a learner cannot delete another learner vocabulary'
);

with removed as (
  delete from public.vocabulary_items
  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  returning id
)
select is(
  (select count(*)::integer from removed),
  1,
  'a learner can delete their scheduled known word'
);

select is(
  (select count(*)::integer from public.vocabulary_reviews),
  0,
  'deleting a word cascades to its review history'
);

select set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);
select is(
  (
    select concat_ws('|', english_word, translation)
    from public.vocabulary_items
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  'private|second translation',
  'the other learner card remains unchanged'
);

select * from finish();
rollback;
