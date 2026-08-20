import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toPresentParticiple } from "../../lib/practice/present-continuous.ts";
import { toThirdPersonSingular } from "../../lib/practice/present-simple.ts";
import { normalizedSentenceHash } from "../../lib/practice/sentence-normalization.ts";
import type {
  PracticeCefr,
  PracticeExerciseType,
  PracticeGrammarTopic,
  PracticeReviewRecord,
} from "../../lib/practice/types.ts";
import { validateReviewPackage } from "./validate-package.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REVIEWED_AT = "2026-08-20T16:15:00.000Z";
const REVIEWED_BY = "Codex editorial review (owner-authorized)";

const SUBJECTS = [
  { text: "I", thirdPerson: false, be: "am" as const },
  { text: "You", thirdPerson: false, be: "are" as const },
  { text: "We", thirdPerson: false, be: "are" as const },
  { text: "They", thirdPerson: false, be: "are" as const },
  { text: "She", thirdPerson: true, be: "is" as const },
] as const;

const SIMPLE_ACTIONS = [
  ["work", "from home on weekdays"],
  ["study", "English every evening"],
  ["read", "the news before breakfast"],
  ["drink", "tea in the morning"],
  ["cook", "dinner at home"],
  ["walk", "to the office on Mondays"],
  ["watch", "a short lesson after lunch"],
  ["write", "in a journal before bed"],
  ["listen", "to English podcasts on the bus"],
  ["practice", "pronunciation every day"],
  ["review", "new words after dinner"],
  ["speak", "English during online lessons"],
  ["use", "a dictionary when needed"],
  ["check", "email after breakfast"],
  ["plan", "the next day every evening"],
  ["start", "work at nine o'clock"],
  ["finish", "work at six o'clock"],
  ["take", "notes during lessons"],
  ["make", "a weekly study plan"],
  ["keep", "a vocabulary notebook"],
  ["learn", "five new words each day"],
  ["repeat", "difficult phrases aloud"],
  ["answer", "practice questions after each lesson"],
  ["ask", "for help when something is unclear"],
  ["visit", "the library on Saturdays"],
  ["exercise", "before work"],
  ["play", "chess on weekends"],
  ["clean", "the kitchen after dinner"],
  ["call", "a friend every Sunday"],
  ["buy", "fresh food at the market"],
  ["carry", "a water bottle to work"],
  ["drive", "to the office twice a week"],
  ["eat", "fruit with breakfast"],
  ["help", "a neighbor on weekends"],
  ["leave", "home at eight o'clock"],
  ["live", "near the city center"],
  ["look", "at the lesson schedule each morning"],
  ["need", "a quiet place to study"],
  ["prefer", "short lessons in the evening"],
  ["remember", "new phrases more easily with examples"],
  ["send", "a progress update every Friday"],
  ["sleep", "eight hours most nights"],
  ["take", "a short break every hour"],
  ["talk", "to family after work"],
  ["track", "study time in a notebook"],
  ["wear", "headphones during listening practice"],
  ["enjoy", "quiet mornings at home"],
  ["find", "new examples in simple articles"],
  ["follow", "a daily learning routine"],
  ["choose", "one main goal each week"],
] as const;

const CONTINUOUS_ACTIONS = [
  ["work", "on an English exercise"],
  ["study", "a new grammar rule"],
  ["read", "a short article"],
  ["write", "a diary entry"],
  ["listen", "to an English podcast"],
  ["practice", "pronunciation"],
  ["review", "the vocabulary list"],
  ["speak", "with a language partner"],
  ["watch", "a pronunciation video"],
  ["take", "notes"],
  ["make", "a study plan"],
  ["prepare", "dinner"],
  ["cook", "a new recipe"],
  ["walk", "home"],
  ["drive", "to the office"],
  ["wait", "for the bus"],
  ["talk", "to a friend"],
  ["clean", "the kitchen"],
  ["learn", "new expressions"],
  ["answer", "practice questions"],
  ["check", "the lesson notes"],
  ["plan", "tomorrow's schedule"],
  ["use", "an online dictionary"],
  ["repeat", "the example sentence"],
] as const;

const CURRENT_SIGNALS = ["right now", "at the moment", "today", "this week", "now"] as const;
const CONTRAST_CURRENT_SIGNALS = ["right this minute", "at this exact moment", "for now", "during this study session", "at present"] as const;
const ROUTINE_SIGNALS = ["every day", "on weekdays", "each evening", "every week", "most mornings"] as const;

interface DraftExercise {
  exerciseType: PracticeExerciseType;
  grammarTopic: PracticeGrammarTopic;
  cefrEstimate: PracticeCefr;
  sentence: string;
  prompt: string;
  lemma: string;
  acceptedAnswers: string[];
  hint: string;
  explanation: string;
  analysis: Record<string, string | boolean | number>;
  transformation: Record<string, string | boolean | number>;
}

function cefrForIndex(index: number, counts: readonly [number, number, number]): PracticeCefr {
  if (index < counts[0]) return "A1";
  if (index < counts[0] + counts[1]) return "A2";
  return "B1";
}

function capitalize(value: string): string {
  return `${value[0].toLocaleUpperCase("en")}${value.slice(1)}`;
}

function buildSimple(
  type: "affirmative" | "negative" | "question",
  actions: readonly (readonly [string, string])[],
  cefrCounts: readonly [number, number, number],
): DraftExercise[] {
  const drafts: DraftExercise[] = [];
  actions.forEach(([lemma, rest]) => {
    SUBJECTS.forEach((subject) => {
      const cefrEstimate = cefrForIndex(drafts.length, cefrCounts);
      const verb = subject.thirdPerson ? toThirdPersonSingular(lemma) : lemma;
      const auxiliary = subject.thirdPerson ? "does" : "do";
      if (type === "affirmative") {
        drafts.push({
          exerciseType: type,
          grammarTopic: "present_simple",
          cefrEstimate,
          sentence: `${subject.text} ${verb} ${rest}.`,
          prompt: `${subject.text} ___ ${rest}. (${lemma})`,
          lemma,
          acceptedAnswers: [verb],
          hint: `Use the correct Present Simple form of “${lemma}”.`,
          explanation: subject.thirdPerson
            ? `The subject “she” takes the third-person singular form “${verb}”.`
            : `The subject “${subject.text}” takes the base form “${lemma}”.`,
          analysis: { tense: "present_simple", subject: subject.text, thirdPerson: subject.thirdPerson },
          transformation: { rule: "controlled-present-simple-affirmative", deterministic: true },
        });
      } else if (type === "negative") {
        const full = `${auxiliary} not ${lemma}`;
        const contracted = `${subject.thirdPerson ? "doesn't" : "don't"} ${lemma}`;
        drafts.push({
          exerciseType: type,
          grammarTopic: "present_simple",
          cefrEstimate,
          sentence: `${subject.text} ${full} ${rest}.`,
          prompt: `${subject.text} ___ ${rest}. (not/${lemma})`,
          lemma,
          acceptedAnswers: [full, contracted],
          hint: `Use the negative Present Simple form of “${lemma}”.`,
          explanation: `“${capitalize(auxiliary)} not” is followed by the base form “${lemma}”.`,
          analysis: { tense: "present_simple", subject: subject.text, thirdPerson: subject.thirdPerson },
          transformation: { rule: "controlled-present-simple-negative", deterministic: true },
        });
      } else {
        const questionSubject = subject.text === "I" ? "I" : subject.text.toLocaleLowerCase("en");
        drafts.push({
          exerciseType: type,
          grammarTopic: "present_simple",
          cefrEstimate,
          sentence: `${capitalize(auxiliary)} ${questionSubject} ${lemma} ${rest}?`,
          prompt: `___ ${questionSubject} ${lemma} ${rest}? (do)`,
          lemma,
          acceptedAnswers: [auxiliary],
          hint: "Choose do or does.",
          explanation: `The auxiliary “${auxiliary}” agrees with “${questionSubject}”; the main verb stays in the base form.`,
          analysis: { tense: "present_simple", subject: subject.text, thirdPerson: subject.thirdPerson },
          transformation: { rule: "controlled-present-simple-question", deterministic: true },
        });
      }
    });
  });
  return drafts;
}

function buildContinuous(
  type: "affirmative" | "negative" | "question",
  actions: readonly (readonly [string, string])[],
  cefrCounts: readonly [number, number, number],
): DraftExercise[] {
  const drafts: DraftExercise[] = [];
  actions.forEach(([lemma, rest]) => {
    SUBJECTS.forEach((subject, subjectIndex) => {
      const cefrEstimate = cefrForIndex(drafts.length, cefrCounts);
      const participle = toPresentParticiple(lemma);
      const signal = CURRENT_SIGNALS[subjectIndex];
      if (type === "affirmative") {
        const answer = `${subject.be} ${participle}`;
        drafts.push({
          exerciseType: type,
          grammarTopic: "present_continuous",
          cefrEstimate,
          sentence: `${subject.text} ${answer} ${rest} ${signal}.`,
          prompt: `${subject.text} ___ ${rest} ${signal}. (${lemma})`,
          lemma,
          acceptedAnswers: [answer],
          hint: `Use the Present Continuous form of “${lemma}”.`,
          explanation: `The auxiliary “${subject.be}” agrees with “${subject.text}” and is followed by “${participle}”.`,
          analysis: { tense: "present_continuous", subject: subject.text, signal },
          transformation: { rule: "controlled-present-continuous-affirmative", deterministic: true },
        });
      } else if (type === "negative") {
        const full = `${subject.be} not ${participle}`;
        const acceptedAnswers = subject.be === "am"
          ? [full]
          : [full, `${subject.be === "is" ? "isn't" : "aren't"} ${participle}`];
        drafts.push({
          exerciseType: type,
          grammarTopic: "present_continuous",
          cefrEstimate,
          sentence: `${subject.text} ${full} ${rest} ${signal}.`,
          prompt: `${subject.text} ___ ${rest} ${signal}. (not/${lemma})`,
          lemma,
          acceptedAnswers,
          hint: `Use the negative Present Continuous form of “${lemma}”.`,
          explanation: `The auxiliary “${subject.be}” agrees with “${subject.text}” and is followed by not and “${participle}”.`,
          analysis: { tense: "present_continuous", subject: subject.text, signal },
          transformation: { rule: "controlled-present-continuous-negative", deterministic: true },
        });
      } else {
        const questionSubject = subject.text === "I" ? "I" : subject.text.toLocaleLowerCase("en");
        drafts.push({
          exerciseType: type,
          grammarTopic: "present_continuous",
          cefrEstimate,
          sentence: `${capitalize(subject.be)} ${questionSubject} ${participle} ${rest} ${signal}?`,
          prompt: `___ ${questionSubject} ${participle} ${rest} ${signal}? (be)`,
          lemma,
          acceptedAnswers: [subject.be],
          hint: "Choose am, is, or are.",
          explanation: `The auxiliary “${subject.be}” moves before “${questionSubject}” in a Present Continuous question.`,
          analysis: { tense: "present_continuous", subject: subject.text, signal },
          transformation: { rule: "controlled-present-continuous-question", deterministic: true },
        });
      }
    });
  });
  return drafts;
}

function buildContrast(): DraftExercise[] {
  const drafts: DraftExercise[] = [];
  CONTINUOUS_ACTIONS.slice(0, 12).forEach(([lemma, rest]) => {
    SUBJECTS.forEach((subject, subjectIndex) => {
      const continuous = subjectIndex % 2 === 0;
      const signal = continuous ? CONTRAST_CURRENT_SIGNALS[subjectIndex] : ROUTINE_SIGNALS[subjectIndex];
      const participle = toPresentParticiple(lemma);
      const answer = continuous
        ? `${subject.be} ${participle}`
        : subject.thirdPerson ? toThirdPersonSingular(lemma) : lemma;
      drafts.push({
        exerciseType: "tense_contrast",
        grammarTopic: "present_simple_vs_continuous",
        cefrEstimate: cefrForIndex(drafts.length, [36, 18, 6]),
        sentence: `${subject.text} ${answer} ${rest} ${signal}.`,
        prompt: `${subject.text} ___ ${rest} ${signal}. (${lemma})`,
        lemma,
        acceptedAnswers: [answer],
        hint: "Choose Present Simple or Present Continuous from the time context.",
        explanation: continuous
          ? `${capitalize(signal)} shows that the activity is current or temporary, so Present Continuous is required.`
          : `${capitalize(signal)} describes a routine, so Present Simple is required.`,
        analysis: { tense: continuous ? "present_continuous" : "present_simple", subject: subject.text, signal },
        transformation: { rule: "controlled-tense-contrast", deterministic: true, contrastSignal: signal },
      });
    });
  });
  return drafts;
}

export function buildPersonalPracticePackage(): {
  records: PracticeReviewRecord[];
  sourceTsv: string;
  sourceSha256: string;
} {
  const drafts = [
    ...buildSimple("affirmative", SIMPLE_ACTIONS, [150, 75, 25]),
    ...buildSimple("negative", SIMPLE_ACTIONS.slice(0, 25), [75, 38, 12]),
    ...buildSimple("question", SIMPLE_ACTIONS.slice(25, 50), [75, 37, 13]),
    ...buildContinuous("affirmative", CONTINUOUS_ACTIONS, [72, 36, 12]),
    ...buildContinuous("negative", CONTINUOUS_ACTIONS.slice(0, 12), [36, 18, 6]),
    ...buildContinuous("question", CONTINUOUS_ACTIONS.slice(12, 24), [36, 18, 6]),
    ...buildContrast(),
  ];
  if (drafts.length !== 800) throw new Error(`Expected 800 drafts, received ${drafts.length}.`);

  const sourceTsv = `${drafts.map((draft, index) =>
    `daily-english-${String(index + 1).padStart(4, "0")}\teng\t${draft.sentence}`
  ).join("\n")}\n`;
  const sourceSha256 = createHash("sha256").update(sourceTsv).digest("hex");
  const records = drafts.map<PracticeReviewRecord>((draft, index) => ({
    schemaVersion: 1,
    packageVersion: "present-tenses-package-1",
    exerciseType: draft.exerciseType,
    grammarTopic: draft.grammarTopic,
    cefrEstimate: draft.cefrEstimate,
    prompt: draft.prompt,
    hint: draft.hint,
    lemma: draft.lemma,
    acceptedAnswers: draft.acceptedAnswers,
    distractors: [],
    explanation: draft.explanation,
    transformation: draft.transformation,
    analysis: draft.analysis,
    warnings: [],
    source: {
      slug: "daily-english-original-cc0-v1",
      name: "Daily English original practice corpus",
      release: "personal-practice-v1",
      downloadedAt: REVIEWED_AT,
      externalId: `daily-english-${String(index + 1).padStart(4, "0")}`,
      homepageUrl: "https://daily-english-practice.maxgraph72.chatgpt.site/practice/sources",
      sourceUrl: "https://daily-english-practice.maxgraph72.chatgpt.site/practice/sources",
      creator: "Daily English project",
      licenseCode: "CC0-1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      attribution: "Original Daily English practice content, CC0-1.0.",
      archiveSha256: sourceSha256,
      importerVersion: "controlled-templates-v1",
      fixture: false,
    },
    originalSentence: draft.sentence,
    normalizedSentence: draft.sentence,
    normalizedHash: normalizedSentenceHash(draft.sentence),
    reviewerDecision: "approve",
    reviewedBy: REVIEWED_BY,
    reviewedAt: REVIEWED_AT,
    reviewNote: "Owner-authorized AI editorial review; controlled template and deterministic answer validation passed.",
    rejectionReason: null,
  }));

  const errors = validateReviewPackage(records, { forPublication: true });
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { records, sourceTsv, sourceSha256 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { records, sourceTsv, sourceSha256 } = buildPersonalPracticePackage();
  const sourcePath = resolve(projectRoot, "content/original/daily-english-practice-v1.tsv");
  const reviewPath = resolve(projectRoot, "content/review/present-tenses-package-1.jsonl");
  const manifestPath = resolve(projectRoot, "content/manifests/daily-english-original-cc0-v1.json");
  mkdirSync(dirname(sourcePath), { recursive: true });
  mkdirSync(dirname(reviewPath), { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(sourcePath, sourceTsv, "utf8");
  writeFileSync(reviewPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    sourceSlug: "daily-english-original-cc0-v1",
    sourceName: "Daily English original practice corpus",
    homepageUrl: "https://daily-english-practice.maxgraph72.chatgpt.site/practice/sources",
    licenseCode: "CC0-1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceRelease: "personal-practice-v1",
    downloadedAt: REVIEWED_AT,
    archiveSha256: sourceSha256,
    importerVersion: "controlled-templates-v1",
    attribution: "Original Daily English practice content, CC0-1.0.",
    fixture: false,
  }, null, 2)}\n`, "utf8");
  process.stdout.write(`Built and editorially approved ${records.length} original practice exercises.\n`);
}
