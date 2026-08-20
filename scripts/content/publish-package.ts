import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PracticeReviewRecord } from "../../lib/practice/types.ts";
import { readReviewPackage, validateReviewPackage } from "./validate-package.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function sqlLiteral(value: string | null | undefined): string {
  return value == null ? "null" : `'${value.replaceAll("'", "''")}'`;
}

function jsonLiteral(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

export function buildPublicationSql(records: readonly PracticeReviewRecord[]): string {
  const errors = validateReviewPackage(records, { forPublication: true });
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const bySource = new Map<string, PracticeReviewRecord[]>();
  for (const record of records) {
    const sourceRecords = bySource.get(record.source.slug) ?? [];
    sourceRecords.push(record);
    bySource.set(record.source.slug, sourceRecords);
  }

  const statements = [
    "begin;",
    "",
    "-- Generated only after the human-review, license, count, and duplicate gates pass.",
  ];

  for (const sourceRecords of bySource.values()) {
    const source = sourceRecords[0].source;
    statements.push(`
insert into private.practice_content_sources (
  slug, name, homepage_url, license_code, license_url, terms_url,
  attribution_template, commercial_use_allowed, approved, approved_at
) values (
  ${sqlLiteral(source.slug)}, ${sqlLiteral(source.name)}, ${sqlLiteral(source.homepageUrl)},
  ${sqlLiteral(source.licenseCode)}, ${sqlLiteral(source.licenseUrl)}, ${sqlLiteral(source.termsUrl)},
  ${sqlLiteral(source.attribution)}, true, true, now()
)
on conflict (slug) do update set
  name = excluded.name,
  homepage_url = excluded.homepage_url,
  license_code = excluded.license_code,
  license_url = excluded.license_url,
  terms_url = excluded.terms_url,
  attribution_template = excluded.attribution_template,
  commercial_use_allowed = true,
  approved = true,
  approved_at = coalesce(private.practice_content_sources.approved_at, now());

insert into private.practice_import_runs (
  source_id, source_release, downloaded_at, archive_sha256, importer_version,
  candidate_count, rejected_count, published_count, package_version, status, completed_at
)
select
  source.id, ${sqlLiteral(source.release)}, ${sqlLiteral(source.downloadedAt)}::timestamptz,
  ${sqlLiteral(source.archiveSha256)}, ${sqlLiteral(source.importerVersion)},
  ${sourceRecords.length}, 0, ${sourceRecords.length}, 'present-tenses-package-1', 'published', now()
from private.practice_content_sources as source
where source.slug = ${sqlLiteral(source.slug)};`);
  }

  for (const record of records) {
    statements.push(`
with source_row as (
  select id from private.practice_content_sources where slug = ${sqlLiteral(record.source.slug)}
), import_row as (
  select run.id
  from private.practice_import_runs as run
  join source_row on source_row.id = run.source_id
  where run.source_release = ${sqlLiteral(record.source.release)}
    and run.archive_sha256 = ${sqlLiteral(record.source.archiveSha256)}
  order by run.created_at desc
  limit 1
), candidate_row as (
  insert into private.practice_sentence_candidates (
    source_id, import_run_id, external_id, original_text, normalized_text,
    normalized_hash, license_code, source_url, source_creator, analysis,
    screening_status, rejection_reasons
  )
  select
    source_row.id, import_row.id, ${sqlLiteral(record.source.externalId)},
    ${sqlLiteral(record.originalSentence)}, ${sqlLiteral(record.normalizedSentence)},
    ${sqlLiteral(record.normalizedHash)}, ${sqlLiteral(record.source.licenseCode)},
    ${sqlLiteral(record.source.sourceUrl)}, ${sqlLiteral(record.source.creator)},
    ${jsonLiteral(record.analysis)}, 'accepted', '[]'::jsonb
  from source_row cross join import_row
  returning id
)
insert into public.practice_exercises (
  candidate_id, content_version, exercise_type, grammar_topic, cefr_estimate,
  prompt, hint, lemma, accepted_answers, distractors, explanation,
  transformation, license_code, source_credit, status, reviewed_by,
  reviewed_at, published_at
)
select
  candidate_row.id, 1, ${sqlLiteral(record.exerciseType)}, ${sqlLiteral(record.grammarTopic)},
  ${sqlLiteral(record.cefrEstimate)}, ${sqlLiteral(record.prompt)}, ${sqlLiteral(record.hint)},
  ${sqlLiteral(record.lemma)}, ${jsonLiteral(record.acceptedAnswers)},
  ${jsonLiteral(record.distractors)}, ${sqlLiteral(record.explanation)},
  ${jsonLiteral({ ...record.transformation, reviewNote: record.reviewNote })},
  ${sqlLiteral(record.source.licenseCode)}, ${sqlLiteral(record.source.attribution)},
  'published', ${sqlLiteral(record.reviewedBy)}, ${sqlLiteral(record.reviewedAt)}::timestamptz,
  now()
from candidate_row;`);
  }

  statements.push("", "commit;", "");
  return statements.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputPath = resolve(
    projectRoot,
    process.argv.find((argument) => argument.endsWith(".jsonl"))
      ?? "content/review/present-tenses-package-1.jsonl",
  );
  const outputPath = resolve(projectRoot, "content/publish/present-tenses-package-1.sql");
  try {
    const sql = buildPublicationSql(readReviewPackage(inputPath));
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, sql, "utf8");
    process.stdout.write(`Prepared controlled publication SQL at ${outputPath}. No database was changed.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Publication validation failed."}\n`);
    process.exitCode = 1;
  }
}
