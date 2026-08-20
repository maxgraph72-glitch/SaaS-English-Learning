import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isEditoriallySafeSentence } from "../../lib/practice/editorial-quality.ts";
import { toPresentParticiple } from "../../lib/practice/present-continuous.ts";
import { toThirdPersonSingular } from "../../lib/practice/present-simple.ts";
import type { PracticeReviewRecord } from "../../lib/practice/types.ts";
import { readReviewPackage, validateReviewPackage } from "./validate-package.ts";

function completedPrompt(record: PracticeReviewRecord): string {
  const suffixIndex = record.prompt.lastIndexOf(" (");
  if (suffixIndex < 0) return "";
  const completed = record.prompt.slice(0, suffixIndex).replace("___", record.acceptedAnswers[0]);
  return `${completed[0].toLocaleUpperCase("en")}${completed.slice(1)}`;
}

export function auditPracticePackage(records: readonly PracticeReviewRecord[]): string[] {
  const errors = validateReviewPackage(records, { forPublication: true });
  const sourceIds = new Set<string>();
  const hashes = new Set<string>();

  records.forEach((record, index) => {
    const line = `Line ${index + 1}`;
    if (completedPrompt(record) !== record.normalizedSentence) {
      errors.push(`${line}: Completing the prompt does not reconstruct the reviewed sentence.`);
    }
    if (!isEditoriallySafeSentence(record.normalizedSentence)) {
      errors.push(`${line}: Sentence failed the neutral single-sentence editorial policy.`);
    }
    if (sourceIds.has(record.source.externalId)) errors.push(`${line}: Duplicate source item ID.`);
    if (hashes.has(record.normalizedHash)) errors.push(`${line}: Duplicate normalized sentence.`);
    sourceIds.add(record.source.externalId);
    hashes.add(record.normalizedHash);

    if (record.source.slug !== "daily-english-original-cc0-v1") {
      errors.push(`${line}: Unexpected source for the personal package.`);
    }
    if (record.source.fixture || record.source.licenseCode !== "CC0-1.0") {
      errors.push(`${line}: Source must be non-fixture CC0 content.`);
    }
    if (record.reviewerDecision !== "approve" || !record.reviewedBy || !record.reviewedAt) {
      errors.push(`${line}: Editorial approval metadata is incomplete.`);
    }

    const participle = toPresentParticiple(record.lemma);
    const simpleForms = new Set([record.lemma, toThirdPersonSingular(record.lemma)]);
    if (record.grammarTopic === "present_simple" && record.exerciseType === "affirmative") {
      if (record.acceptedAnswers.length !== 1 || !simpleForms.has(record.acceptedAnswers[0])) {
        errors.push(`${line}: Present Simple affirmative answer has the wrong form.`);
      }
    } else if (record.grammarTopic === "present_simple" && record.exerciseType === "negative") {
      const valid = new Set([
        `do not ${record.lemma}`,
        `don't ${record.lemma}`,
        `does not ${record.lemma}`,
        `doesn't ${record.lemma}`,
      ]);
      if (record.acceptedAnswers.length < 2 || record.acceptedAnswers.some((answer) => !valid.has(answer))) {
        errors.push(`${line}: Present Simple negative answers have the wrong form.`);
      }
    } else if (record.grammarTopic === "present_simple" && record.exerciseType === "question") {
      if (record.acceptedAnswers.length !== 1 || !new Set(["do", "does"]).has(record.acceptedAnswers[0])) {
        errors.push(`${line}: Present Simple question requires do or does.`);
      }
    } else if (record.grammarTopic === "present_continuous" && record.exerciseType === "affirmative") {
      if (record.acceptedAnswers.length !== 1 || !new RegExp(`^(?:am|is|are) ${participle}$`, "u").test(record.acceptedAnswers[0])) {
        errors.push(`${line}: Present Continuous affirmative answer has the wrong form.`);
      }
    } else if (record.grammarTopic === "present_continuous" && record.exerciseType === "negative") {
      if (!record.acceptedAnswers[0]?.match(new RegExp(`^(?:am|is|are) not ${participle}$`, "u"))) {
        errors.push(`${line}: Present Continuous negative answer has the wrong full form.`);
      }
      if (record.acceptedAnswers.some((answer) => answer.includes("amn't"))) {
        errors.push(`${line}: Non-standard amn't is not allowed.`);
      }
    } else if (record.grammarTopic === "present_continuous" && record.exerciseType === "question") {
      if (record.acceptedAnswers.length !== 1 || !new Set(["am", "is", "are"]).has(record.acceptedAnswers[0])) {
        errors.push(`${line}: Present Continuous question requires am, is, or are.`);
      }
      if (!record.prompt.includes(participle)) errors.push(`${line}: Question does not expose the participle.`);
    } else if (record.grammarTopic === "present_simple_vs_continuous") {
      const answer = record.acceptedAnswers[0];
      const isSimple = simpleForms.has(answer);
      const isContinuous = new RegExp(`^(?:am|is|are) ${participle}$`, "u").test(answer);
      if (!isSimple && !isContinuous) errors.push(`${line}: Contrast answer is neither valid tense form.`);
      if (!record.transformation.contrastSignal || !record.explanation.toLocaleLowerCase("en").includes("present")) {
        errors.push(`${line}: Contrast explanation does not identify the contextual tense choice.`);
      }
    } else {
      errors.push(`${line}: Unsupported topic and exercise type combination.`);
    }
  });

  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = resolve(process.cwd(), process.argv.find((value) => value.endsWith(".jsonl"))
    ?? "content/review/present-tenses-package-1.jsonl");
  const records = readReviewPackage(path);
  const errors = auditPracticePackage(records);
  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Editorially audited all ${records.length} practice exercises.\n`);
  }
}
