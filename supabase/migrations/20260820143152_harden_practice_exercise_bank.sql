create or replace function private.is_nonempty_text_array(p_value jsonb)
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
        or item.value #>> '{}' <> lower(
          btrim(
            regexp_replace(
              translate(
                normalize(item.value #>> '{}', NFKC),
                U&'\2018\2019\02BC\FF07',
                U&'\0027\0027\0027\0027'
              ),
              '[[:space:]]+',
              ' ',
              'g'
            )
          )
        )
    );
$$;

alter table private.practice_content_sources enable row level security;
alter table private.practice_import_runs enable row level security;
alter table private.practice_sentence_candidates enable row level security;

revoke all on function private.is_nonempty_text_array(jsonb)
  from public, anon, authenticated;
