import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PracticeReviewRecord } from "../../lib/practice/types.ts";
import { validateReviewRecord } from "../../lib/practice/validation.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function readReviewPackage(path: string): PracticeReviewRecord[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as PracticeReviewRecord;
      } catch {
        throw new Error(`Review package line ${index + 1} is not valid JSON.`);
      }
    });
}

export function validateReviewPackage(
  records: readonly PracticeReviewRecord[],
  options: { forPublication?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const hashes = new Set<string>();
  records.forEach((record, index) => {
    for (const error of validateReviewRecord(record)) errors.push(`Line ${index + 1}: ${error}`);
    if (hashes.has(record.normalizedHash)) errors.push(`Line ${index + 1}: Duplicate normalized hash.`);
    hashes.add(record.normalizedHash);
    if (options.forPublication) {
      if (!new Set(["approve", "edit_and_approve"]).has(record.reviewerDecision ?? "")) {
        errors.push(`Line ${index + 1}: Record has not passed human review.`);
      }
      if (record.warnings.length > 0) errors.push(`Line ${index + 1}: Unresolved warnings remain.`);
      if (record.source.fixture) errors.push(`Line ${index + 1}: Synthetic fixtures cannot be published.`);
    }
  });

  if (options.forPublication) {
    const counts = records.reduce<Record<string, number>>((result, record) => {
      result[record.grammarTopic] = (result[record.grammarTopic] ?? 0) + 1;
      return result;
    }, {});
    if (records.length < 800) errors.push("Publication requires at least 800 reviewed exercises.");
    for (const [topic, minimum, maximum] of [
      ["present_simple", 450, 550],
      ["present_continuous", 216, 264],
      ["present_simple_vs_continuous", 54, 66],
    ] as const) {
      const count = counts[topic] ?? 0;
      if (count < minimum || count > maximum) {
        errors.push(`${topic} count ${count} is outside ${minimum}-${maximum}.`);
      }
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const publication = process.argv.includes("--publication");
  const path = resolve(
    projectRoot,
    process.argv.find((argument) => argument.endsWith(".jsonl"))
      ?? "content/review/present-tenses-package-1.jsonl",
  );
  const records = readReviewPackage(path);
  const errors = validateReviewPackage(records, { forPublication: publication });
  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Validated ${records.length} ${publication ? "publishable" : "draft"} records.\n`);
  }
}
