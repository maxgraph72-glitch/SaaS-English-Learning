import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  PracticeCefr,
  PracticeExerciseType,
  PracticeGrammarTopic,
  PracticeReviewRecord,
} from "../../lib/practice/types.ts";
import { readReviewPackage, validateReviewPackage } from "./validate-package.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface PackageBucket {
  grammarTopic: PracticeGrammarTopic;
  exerciseType: PracticeExerciseType;
  cefrEstimate: PracticeCefr;
  count: number;
}

export const PACKAGE_BUCKETS: readonly PackageBucket[] = [
  { grammarTopic: "present_simple", exerciseType: "affirmative", cefrEstimate: "A1", count: 150 },
  { grammarTopic: "present_simple", exerciseType: "affirmative", cefrEstimate: "A2", count: 75 },
  { grammarTopic: "present_simple", exerciseType: "affirmative", cefrEstimate: "B1", count: 25 },
  { grammarTopic: "present_simple", exerciseType: "negative", cefrEstimate: "A1", count: 75 },
  { grammarTopic: "present_simple", exerciseType: "negative", cefrEstimate: "A2", count: 38 },
  { grammarTopic: "present_simple", exerciseType: "negative", cefrEstimate: "B1", count: 12 },
  { grammarTopic: "present_simple", exerciseType: "question", cefrEstimate: "A1", count: 75 },
  { grammarTopic: "present_simple", exerciseType: "question", cefrEstimate: "A2", count: 37 },
  { grammarTopic: "present_simple", exerciseType: "question", cefrEstimate: "B1", count: 13 },
  { grammarTopic: "present_continuous", exerciseType: "affirmative", cefrEstimate: "A1", count: 72 },
  { grammarTopic: "present_continuous", exerciseType: "affirmative", cefrEstimate: "A2", count: 36 },
  { grammarTopic: "present_continuous", exerciseType: "affirmative", cefrEstimate: "B1", count: 12 },
  { grammarTopic: "present_continuous", exerciseType: "negative", cefrEstimate: "A1", count: 36 },
  { grammarTopic: "present_continuous", exerciseType: "negative", cefrEstimate: "A2", count: 18 },
  { grammarTopic: "present_continuous", exerciseType: "negative", cefrEstimate: "B1", count: 6 },
  { grammarTopic: "present_continuous", exerciseType: "question", cefrEstimate: "A1", count: 36 },
  { grammarTopic: "present_continuous", exerciseType: "question", cefrEstimate: "A2", count: 18 },
  { grammarTopic: "present_continuous", exerciseType: "question", cefrEstimate: "B1", count: 6 },
  { grammarTopic: "present_simple_vs_continuous", exerciseType: "tense_contrast", cefrEstimate: "A1", count: 36 },
  { grammarTopic: "present_simple_vs_continuous", exerciseType: "tense_contrast", cefrEstimate: "A2", count: 18 },
  { grammarTopic: "present_simple_vs_continuous", exerciseType: "tense_contrast", cefrEstimate: "B1", count: 6 },
] as const;

function sentenceWordCount(record: PracticeReviewRecord): number {
  return record.normalizedSentence.match(/[\p{L}\p{N}']+/gu)?.length ?? 0;
}

function compareCandidates(left: PracticeReviewRecord, right: PracticeReviewRecord): number {
  return sentenceWordCount(left) - sentenceWordCount(right)
    || left.normalizedHash.localeCompare(right.normalizedHash);
}

function takeDiverse(
  records: readonly PracticeReviewRecord[],
  count: number,
): PracticeReviewRecord[] {
  const groups = new Map<string, PracticeReviewRecord[]>();
  for (const record of records) {
    const group = groups.get(record.lemma) ?? [];
    group.push(record);
    groups.set(record.lemma, group);
  }
  const lemmas = [...groups.keys()].sort();
  const selected: PracticeReviewRecord[] = [];
  let offset = 0;
  while (selected.length < count) {
    let added = false;
    for (const lemma of lemmas) {
      const record = groups.get(lemma)?.[offset];
      if (!record) continue;
      selected.push(record);
      added = true;
      if (selected.length === count) break;
    }
    if (!added) break;
    offset += 1;
  }
  return selected;
}

function splitAffirmativePrompt(record: PracticeReviewRecord): {
  subject: string;
  rest: string;
} {
  const suffix = ` (${record.lemma})`;
  if (!record.prompt.endsWith(suffix)) throw new Error("Affirmative prompt has an unexpected lemma suffix.");
  const withoutHint = record.prompt.slice(0, -suffix.length);
  const blankIndex = withoutHint.indexOf("___");
  if (blankIndex < 1) throw new Error("Affirmative prompt does not expose a subject before the blank.");
  return {
    subject: withoutHint.slice(0, blankIndex).trimEnd(),
    rest: withoutHint.slice(blankIndex + 3),
  };
}

function appendRightNow(rest: string): string {
  const trimmed = rest.trimEnd();
  const punctuation = trimmed.match(/[.!?]$/u)?.[0] ?? ".";
  const stem = punctuation === "." && !trimmed.endsWith(".")
    ? trimmed
    : trimmed.slice(0, -1);
  return `${stem} right now${punctuation}`;
}

function deriveSimpleRecord(
  record: PracticeReviewRecord,
  exerciseType: "negative" | "question",
): PracticeReviewRecord {
  const { subject, rest } = splitAffirmativePrompt(record);
  const answer = record.acceptedAnswers[0];
  const thirdPerson = answer !== record.lemma;
  const auxiliary = thirdPerson ? "does" : "do";
  const transformation = {
    ...record.transformation,
    rule: exerciseType === "negative"
      ? "present-simple-derived-negative"
      : "present-simple-derived-question",
    derivedFrom: "affirmative-source-candidate",
    deterministic: true,
  };

  if (exerciseType === "negative") {
    return {
      ...record,
      exerciseType,
      prompt: `${subject} ___${rest} (not/${record.lemma})`,
      hint: `Use the correct negative form of “${record.lemma}”.`,
      acceptedAnswers: [
        `${auxiliary} not ${record.lemma}`,
        `${auxiliary === "does" ? "doesn't" : "don't"} ${record.lemma}`,
      ],
      explanation: `${thirdPerson ? "Does not" : "Do not"} is followed by the base form “${record.lemma}”.`,
      transformation,
      analysis: { ...record.analysis, exerciseType },
    };
  }

  return {
    ...record,
    exerciseType,
    prompt: `___ ${subject} ${record.lemma}${rest} (do)`,
    hint: "Choose Do or Does.",
    acceptedAnswers: [auxiliary],
    explanation: `${thirdPerson ? "Does" : "Do"} agrees with the explicit subject; the main verb stays in the base form.`,
    transformation,
    analysis: { ...record.analysis, exerciseType },
  };
}

function continuousParts(record: PracticeReviewRecord): {
  auxiliary: "am" | "is" | "are";
  participle: string;
  subject: string;
  rest: string;
} {
  const { subject, rest } = splitAffirmativePrompt(record);
  const [auxiliary, participle, ...unexpected] = record.acceptedAnswers[0].split(" ");
  if (!new Set(["am", "is", "are"]).has(auxiliary) || !participle || unexpected.length > 0) {
    throw new Error("Continuous affirmative answer has an unexpected shape.");
  }
  return { auxiliary: auxiliary as "am" | "is" | "are", participle, subject, rest };
}

function deriveContinuousRecord(
  record: PracticeReviewRecord,
  exerciseType: "negative" | "question" | "tense_contrast",
): PracticeReviewRecord {
  const { auxiliary, participle, subject, rest } = continuousParts(record);
  const transformation = {
    ...record.transformation,
    rule: `present-continuous-derived-${exerciseType.replaceAll("_", "-")}`,
    derivedFrom: "affirmative-source-candidate",
    deterministic: true,
  };

  if (exerciseType === "negative") {
    const acceptedAnswers = auxiliary === "am"
      ? [`am not ${participle}`]
      : [
          `${auxiliary} not ${participle}`,
          `${auxiliary === "is" ? "isn't" : "aren't"} ${participle}`,
        ];
    return {
      ...record,
      exerciseType,
      prompt: `${subject} ___${rest} (not/${record.lemma})`,
      hint: `Use the negative Present Continuous form of “${record.lemma}”.`,
      acceptedAnswers,
      explanation: `${auxiliary} agrees with the subject, followed by not and “${participle}”.`,
      transformation,
      analysis: { ...record.analysis, exerciseType },
    };
  }

  if (exerciseType === "question") {
    return {
      ...record,
      exerciseType,
      prompt: `___ ${subject} ${participle}${rest} (be)`,
      hint: "Choose am, is, or are.",
      acceptedAnswers: [auxiliary],
      explanation: `${auxiliary} moves before the explicit subject in a Present Continuous question.`,
      transformation,
      analysis: { ...record.analysis, exerciseType },
    };
  }

  return {
    ...record,
    exerciseType,
    grammarTopic: "present_simple_vs_continuous",
    prompt: `${subject} ___${appendRightNow(rest)} (${record.lemma})`,
    explanation: "Right now makes the situation explicitly current, so the Present Continuous is required.",
    transformation: {
      ...transformation,
      contrastRule: "added-explicit-current-context",
    },
    analysis: {
      ...record.analysis,
      exerciseType,
      tense: "present_simple_vs_continuous",
      contrastSignal: "right now",
    },
  };
}

function deriveForBucket(
  donor: PracticeReviewRecord,
  bucket: PackageBucket,
): PracticeReviewRecord {
  if (bucket.grammarTopic === "present_simple") {
    if (bucket.exerciseType === "affirmative") return donor;
    if (bucket.exerciseType === "negative" || bucket.exerciseType === "question") {
      return deriveSimpleRecord(donor, bucket.exerciseType);
    }
  }
  if (bucket.grammarTopic === "present_continuous") {
    if (bucket.exerciseType === "affirmative") return donor;
    if (bucket.exerciseType === "negative" || bucket.exerciseType === "question") {
      return deriveContinuousRecord(donor, bucket.exerciseType);
    }
  }
  if (
    bucket.grammarTopic === "present_simple_vs_continuous"
    && bucket.exerciseType === "tense_contrast"
  ) {
    return deriveContinuousRecord(donor, "tense_contrast");
  }
  throw new Error(`Unsupported package bucket ${bucket.grammarTopic}/${bucket.exerciseType}.`);
}

function donorTopic(bucket: PackageBucket): PracticeGrammarTopic {
  return bucket.grammarTopic === "present_simple" ? "present_simple" : "present_continuous";
}

export function buildBalancedPackage(records: readonly PracticeReviewRecord[]): PracticeReviewRecord[] {
  const ordered = [...records].sort(compareCandidates);
  const selected: PracticeReviewRecord[] = [];
  const usedHashes = new Set<string>();

  for (const bucket of PACKAGE_BUCKETS) {
    const exact = ordered.filter((record) =>
      !usedHashes.has(record.normalizedHash)
      && record.grammarTopic === bucket.grammarTopic
      && record.exerciseType === bucket.exerciseType
      && record.cefrEstimate === bucket.cefrEstimate
    );
    const chosen = takeDiverse(exact, bucket.count);
    for (const record of chosen) usedHashes.add(record.normalizedHash);

    const missing = bucket.count - chosen.length;
    if (missing > 0) {
      const donors = takeDiverse(ordered.filter((record) =>
        !usedHashes.has(record.normalizedHash)
        && record.grammarTopic === donorTopic(bucket)
        && record.exerciseType === "affirmative"
        && record.cefrEstimate === bucket.cefrEstimate
      ), missing);
      if (donors.length !== missing) {
        throw new Error(
          `Not enough ${bucket.cefrEstimate} donors for ${bucket.grammarTopic}/${bucket.exerciseType}: needed ${missing}, found ${donors.length}.`,
        );
      }
      for (const donor of donors) {
        usedHashes.add(donor.normalizedHash);
        chosen.push(deriveForBucket(donor, bucket));
      }
    }
    selected.push(...chosen);
  }

  const errors = validateReviewPackage(selected);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  if (selected.length !== 800) throw new Error(`Balanced package contains ${selected.length} records, expected 800.`);
  return selected;
}

function writePackage(path: string, records: readonly PracticeReviewRecord[]): void {
  if (existsSync(path)) {
    const existing = readFileSync(path, "utf8");
    if (/"reviewerDecision":"(?:approve|edit_and_approve|reject|needs_legal_review)"/u.test(existing)) {
      throw new Error("Refusing to overwrite a package that already contains human review decisions.");
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputPath = resolve(
    projectRoot,
    process.argv.find((argument) => argument.endsWith(".jsonl"))
      ?? "content/raw/present-tenses-tatoeba-2026-08-15.jsonl",
  );
  const outputArgument = process.argv.filter((argument) => argument.endsWith(".jsonl"))[1];
  const outputPath = resolve(
    projectRoot,
    outputArgument ?? "content/review/present-tenses-package-1.jsonl",
  );
  const records = buildBalancedPackage(readReviewPackage(inputPath));
  writePackage(outputPath, records);
  process.stdout.write(`Selected ${records.length} balanced pending review records.\n`);
}
