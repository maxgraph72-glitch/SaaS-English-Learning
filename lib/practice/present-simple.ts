import type { GeneratedExercise, PracticeCefr } from "./types";

const IRREGULAR_THIRD_PERSON: Record<string, string> = {
  be: "is",
  do: "does",
  have: "has",
};

const SUPPORTED_LEMMAS = [
  "arrive",
  "carry",
  "come",
  "cook",
  "do",
  "drink",
  "drive",
  "have",
  "leave",
  "play",
  "read",
  "sleep",
  "snow",
  "study",
  "wait",
  "walk",
  "watch",
  "work",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function cefrForSentence(sentence: string): PracticeCefr {
  const words = sentence.match(/[\p{L}\p{N}']+/gu)?.length ?? 0;
  return words <= 8 ? "A1" : words <= 12 ? "A2" : "B1";
}

export function toThirdPersonSingular(lemmaInput: string): string {
  const lemma = lemmaInput.toLocaleLowerCase("en");
  if (IRREGULAR_THIRD_PERSON[lemma]) return IRREGULAR_THIRD_PERSON[lemma];
  if (/[^aeiou]y$/u.test(lemma)) return `${lemma.slice(0, -1)}ies`;
  if (/(?:s|x|z|ch|sh|o)$/u.test(lemma)) return `${lemma}es`;
  return `${lemma}s`;
}

function createExercise(
  sentence: string,
  exerciseType: GeneratedExercise["exerciseType"],
  prompt: string,
  lemma: string,
  acceptedAnswers: string[],
  explanation: string,
  rule: string,
): GeneratedExercise {
  return {
    exerciseType,
    grammarTopic: "present_simple",
    cefrEstimate: cefrForSentence(sentence),
    prompt,
    hint: exerciseType === "question" ? "Choose Do or Does." : `Use the correct form of “${lemma}”.`,
    lemma,
    acceptedAnswers,
    distractors: [],
    explanation,
    transformation: { rule, deterministic: true },
    analysis: { tense: "present_simple", lemma, exerciseType },
    warnings: [],
  };
}

export function generatePresentSimpleExercise(sentence: string): GeneratedExercise | null {
  const lemmaPattern = SUPPORTED_LEMMAS.map(escapeRegExp).join("|");
  const question = sentence.match(
    new RegExp(`^(Do|Does)\\s+(.+?)\\s+(${lemmaPattern})\\b(.*\\?)$`, "iu"),
  );
  if (question) {
    const [, auxiliary, subject, lemma, rest] = question;
    return createExercise(
      sentence,
      "question",
      `___ ${subject} ${lemma}${rest} (do)`,
      lemma.toLocaleLowerCase("en"),
      [auxiliary.toLocaleLowerCase("en")],
      `${auxiliary} agrees with the explicit subject; the main verb stays in the base form.`,
      "present-simple-do-question",
    );
  }

  const negative = sentence.match(
    new RegExp(`^(.+?)\\s+(do not|don't|does not|doesn't)\\s+(${lemmaPattern})\\b(.*)$`, "iu"),
  );
  if (negative) {
    const [, subject, auxiliary, lemmaValue, rest] = negative;
    const lemma = lemmaValue.toLocaleLowerCase("en");
    const thirdPerson = auxiliary.toLocaleLowerCase("en").startsWith("does");
    const full = `${thirdPerson ? "does not" : "do not"} ${lemma}`;
    const contracted = `${thirdPerson ? "doesn't" : "don't"} ${lemma}`;
    return createExercise(
      sentence,
      "negative",
      `${subject} ___${rest} (not/${lemma})`,
      lemma,
      [full, contracted],
      `${thirdPerson ? "Does not" : "Do not"} is followed by the base form “${lemma}”.`,
      "present-simple-negative",
    );
  }

  const matches: Array<{ lemma: string; surface: string; index: number }> = [];
  for (const lemma of SUPPORTED_LEMMAS) {
    for (const surface of [lemma, toThirdPersonSingular(lemma)]) {
      const match = new RegExp(`\\b${escapeRegExp(surface)}\\b`, "iu").exec(sentence);
      if (match) matches.push({ lemma, surface: match[0], index: match.index });
    }
  }
  const unique = matches.filter(
    (match, index, all) =>
      all.findIndex((other) => other.index === match.index && other.surface === match.surface) === index,
  );
  if (unique.length !== 1) return null;

  const target = unique[0];
  const prompt = `${sentence.slice(0, target.index)}___${sentence.slice(target.index + target.surface.length)} (${target.lemma})`;
  const thirdPerson = target.surface.toLocaleLowerCase("en") === toThirdPersonSingular(target.lemma);
  return createExercise(
    sentence,
    "affirmative",
    prompt,
    target.lemma,
    [target.surface.toLocaleLowerCase("en")],
    thirdPerson
      ? `The subject takes the third-person singular form “${target.surface.toLocaleLowerCase("en")}”.`
      : `This subject takes the base form “${target.lemma}”.`,
    thirdPerson ? "present-simple-third-person" : "present-simple-base",
  );
}
