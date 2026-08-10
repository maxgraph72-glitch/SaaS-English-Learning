begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

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
  learning_state,
  knowledge_category,
  repetition_stage,
  learned_at,
  next_review_date,
  last_stage_advanced_date
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'steady',
    'устойчивый',
    'learning',
    'learning',
    null,
    1,
    now(),
    current_date,
    null
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'calm',
    'спокойный',
    'learning',
    'learning',
    null,
    1,
    now(),
    current_date,
    null
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '11111111-1111-4111-8111-111111111111',
    'recover',
    'восстанавливать',
    'known',
    'scheduled',
    1,
    4,
    now() - interval '8 days',
    current_date - 1,
    null
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '11111111-1111-4111-8111-111111111111',
    'forgotten',
    'забытый',
    'known',
    'scheduled',
    1,
    6,
    now() - interval '40 days',
    current_date - 7,
    null
  ),
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '11111111-1111-4111-8111-111111111111',
    'practice',
    'практика',
    'repeat',
    'scheduled',
    2,
    3,
    now(),
    current_date + 7,
    current_date
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    'monthly',
    'ежемесячный',
    'known',
    'scheduled',
    1,
    5,
    now(),
    current_date,
    null
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '11111111-1111-4111-8111-111111111111',
    'maintain',
    'поддерживать',
    'known',
    'scheduled',
    1,
    6,
    now(),
    current_date,
    null
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
  6,
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
    from public.submit_vocabulary_review_v2(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      1000,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    )
  ),
  false,
  'the first timed review submission is applied'
);
select is(
  (
    select concat_ws(
      '|',
      category_after,
      stage_after,
      next_review_date_after,
      attempt_kind
    )
    from public.submit_vocabulary_review_v2(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      1000,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    )
  ),
  concat_ws('|', 1, 2, current_date + 1, 'scheduled'),
  'stage 1 advances to stage 2 and is due tomorrow'
);
select is(
  (
    select duplicate
    from public.submit_vocabulary_review_v2(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      1000,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    )
  ),
  true,
  'a retried submission is recognized as a duplicate'
);
select is(
  (
    select count(*)::integer
    from public.vocabulary_reviews
    where submission_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ),
  1,
  'a retried submission creates one immutable history row'
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

select is(
  (
    select concat_ws(
      '|',
      category_after,
      stage_after,
      next_review_date_after,
      attempt_kind
    )
    from public.submit_vocabulary_review_v2(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      5001,
      '77777777-7777-4777-8777-777777777777'
    )
  ),
  concat_ws('|', 4, 2, current_date + 1, 'practice'),
  'a second attempt today is practice and can update the category'
);
select is(
  (
    select concat_ws('|', knowledge_category, repetition_stage, next_review_date)
    from public.vocabulary_items
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  concat_ws('|', 4, 2, current_date + 1),
  'same-day practice keeps the stage and next date'
);

select lives_ok(
  $$ select count(*) from public.get_due_vocabulary() $$,
  'loading the due queue applies overdue rules atomically'
);
select is(
  (
    select concat_ws(
      '|',
      repetition_stage,
      next_review_date,
      overdue_processed_for_date,
      overdue_stage_decay_pending
    )
    from public.vocabulary_items
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  concat_ws('|', 3, current_date - 1, current_date - 1, true),
  'a one-day overdue stage 4 review rolls back once and keeps its assigned date'
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
  3,
  'reloading the due queue does not apply another rollback'
);
select is(
  (
    select concat_ws(
      '|',
      category_after,
      stage_after,
      next_review_date_after,
      overdue_action
    )
    from public.submit_vocabulary_review_v2(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      2000,
      '88888888-8888-4888-8888-888888888888'
    )
  ),
  concat_ws('|', 2, 4, current_date + 7, 'rollback'),
  'the recovery attempt completes the rolled-back stage and advances once'
);

select is(
  (
    select concat_ws('|', stage_after, next_review_date_after)
    from public.submit_vocabulary_review_v2(
      '55555555-5555-4555-8555-555555555555',
      800,
      '99999999-9999-4999-8999-999999999999'
    )
  ),
  concat_ws('|', 6, (current_date + interval '1 month')::date),
  'stage 5 advances to stage 6 on a calendar-month interval'
);
select is(
  (
    select concat_ws('|', stage_after, next_review_date_after)
    from public.submit_vocabulary_review_v2(
      '66666666-6666-4666-8666-666666666666',
      800,
      '12121212-1212-4212-8212-121212121212'
    )
  ),
  concat_ws('|', 6, (current_date + interval '1 month')::date),
  'stage 6 remains stage 6 on a calendar-month interval'
);

select is(
  (
    select concat_ws(
      '|',
      learning_state,
      knowledge_category,
      repetition_stage,
      coalesce(next_review_date::text, 'null'),
      requires_relearning
    )
    from public.vocabulary_items
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  'learning|4|1|null|t',
  'seven days overdue moves a word into relearning'
);
select is(
  (
    select overdue_processed_for_date
    from public.vocabulary_items
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  current_date - 7,
  'the forgotten transition retains the original assigned date once'
);

select is(
  (
    select concat_ws(
      '|',
      category_after,
      stage_after,
      next_review_date_after,
      attempt_kind
    )
    from public.submit_vocabulary_review_v2(
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      4000,
      '13131313-1313-4313-8313-131313131313'
    )
  ),
  concat_ws('|', 3, 3, current_date + 7, 'practice'),
  'a pre-existing same-day practice item remains on its schedule'
);
select is(
  (
    select count(*)::integer
    from public.vocabulary_reviews
    where vocabulary_item_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ),
  1,
  'same-day practice is saved in immutable history'
);
select is(
  (
    select concat_ws('|', item.next_review_date, review.next_review_date_after)
    from public.vocabulary_items as item
    join public.vocabulary_reviews as review
      on review.vocabulary_item_id = item.id
    where review.submission_id = '88888888-8888-4888-8888-888888888888'
  ),
  concat_ws('|', current_date + 7, current_date + 7),
  'the atomic item state matches its history row'
);

select is(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.vocabulary_items'::regclass
  ),
  true,
  'RLS remains enabled on vocabulary items'
);
select is(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.vocabulary_reviews'::regclass
  ),
  true,
  'RLS remains enabled on vocabulary reviews'
);
select is(
  has_column_privilege(
    'authenticated',
    'public.vocabulary_items',
    'english_word',
    'INSERT'
  ),
  true,
  'authenticated clients can insert vocabulary content'
);
select is(
  has_column_privilege(
    'authenticated',
    'public.vocabulary_items',
    'knowledge_category',
    'INSERT'
  ),
  false,
  'authenticated clients cannot inject a trusted knowledge category'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
select is(
  (select count(*)::integer from public.vocabulary_items),
  1,
  'the second learner sees only their own word'
);
select is(
  (select count(*)::integer from public.vocabulary_reviews),
  0,
  'review history is isolated between learners'
);

select * from finish();
rollback;
