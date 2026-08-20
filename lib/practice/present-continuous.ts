import type { GeneratedExercise, PracticeCefr } from "./types";
import { EXPLICIT_SUBJECT_PATTERN, isEditoriallySafeSentence } from "./editorial-quality.ts";

const EXPLICIT_DOUBLING = new Set([
  "begin",
  "drop",
  "get",
  "plan",
  "put",
  "run",
  "sit",
  "stop",
  "swim",
  "trip",
  "win",
]);
const SUPPORTED_LEMMAS = [
  "accuse",
  "act",
  "address",
  "align",
  "analyze",
  "approach",
  "ask",
  "attack",
  "attempt",
  "attend",
  "be",
  "beat",
  "become",
  "begin",
  "break",
  "build",
  "burn",
  "buy",
  "call",
  "carry",
  "cause",
  "celebrate",
  "change",
  "collect",
  "compose",
  "consider",
  "continue",
  "cooperate",
  "copy",
  "come",
  "create",
  "cultivate",
  "decline",
  "develop",
  "die",
  "do",
  "donate",
  "draw",
  "drive",
  "drink",
  "drop",
  "dress",
  "eat",
  "embrace",
  "emerge",
  "endorse",
  "enjoy",
  "expand",
  "experience",
  "experiment",
  "explore",
  "face",
  "fast",
  "feel",
  "fight",
  "find",
  "flourish",
  "focus",
  "force",
  "form",
  "forward",
  "fry",
  "function",
  "gain",
  "garden",
  "get",
  "give",
  "go",
  "greet",
  "grieve",
  "grow",
  "guide",
  "have",
  "hear",
  "help",
  "hope",
  "improve",
  "increase",
  "invest",
  "investigate",
  "joke",
  "join",
  "keep",
  "learn",
  "lie",
  "live",
  "look",
  "lose",
  "make",
  "manage",
  "meet",
  "miss",
  "mourn",
  "move",
  "negotiate",
  "organize",
  "participate",
  "pay",
  "pick",
  "plan",
  "play",
  "predict",
  "prepare",
  "pretend",
  "produce",
  "program",
  "provide",
  "pursue",
  "push",
  "put",
  "question",
  "raise",
  "read",
  "receive",
  "record",
  "recover",
  "rehearse",
  "release",
  "return",
  "review",
  "rise",
  "roll",
  "rush",
  "run",
  "say",
  "search",
  "see",
  "sell",
  "share",
  "shiver",
  "show",
  "sing",
  "sleep",
  "slow",
  "snow",
  "speak",
  "spread",
  "stand",
  "start",
  "stay",
  "struggle",
  "study",
  "suffer",
  "swim",
  "take",
  "talk",
  "tell",
  "track",
  "train",
  "travel",
  "treat",
  "trip",
  "try",
  "turn",
  "use",
  "vote",
  "wait",
  "walk",
  "watch",
  "wear",
  "win",
  "work",
  "write",
] as const;

function cefrForSentence(sentence: string): PracticeCefr {
  const words = sentence.match(/[\p{L}\p{N}']+/gu)?.length ?? 0;
  return words <= 8 ? "A1" : words <= 12 ? "A2" : "B1";
}

export function toPresentParticiple(lemmaInput: string): string {
  const lemma = lemmaInput.toLocaleLowerCase("en");
  if (lemma === "be") return "being";
  if (lemma.endsWith("ie")) return `${lemma.slice(0, -2)}ying`;
  if (EXPLICIT_DOUBLING.has(lemma)) return `${lemma}${lemma.at(-1)}ing`;
  if (lemma.endsWith("e") && !/(?:ee|ye|oe)$/u.test(lemma)) {
    return `${lemma.slice(0, -1)}ing`;
  }
  return `${lemma}ing`;
}

function supportedParticiplePattern(): string {
  return SUPPORTED_LEMMAS.map(toPresentParticiple).join("|");
}

function lemmaForParticiple(participle: string): string | null {
  return SUPPORTED_LEMMAS.find(
    (lemma) => toPresentParticiple(lemma) === participle.toLocaleLowerCase("en"),
  ) ?? null;
}

function createExercise(input: {
  sentence: string;
  exerciseType: GeneratedExercise["exerciseType"];
  prompt: string;
  lemma: string;
  acceptedAnswers: string[];
  explanation: string;
  rule: string;
}): GeneratedExercise {
  return {
    exerciseType: input.exerciseType,
    grammarTopic: "present_continuous",
    cefrEstimate: cefrForSentence(input.sentence),
    prompt: input.prompt,
    hint: input.exerciseType === "question"
      ? "Choose am, is, or are."
      : `Use the Present Continuous form of “${input.lemma}”.`,
    lemma: input.lemma,
    acceptedAnswers: input.acceptedAnswers,
    distractors: [],
    explanation: input.explanation,
    transformation: { rule: input.rule, deterministic: true },
    analysis: {
      tense: "present_continuous",
      lemma: input.lemma,
      exerciseType: input.exerciseType,
    },
    warnings: [],
  };
}

export function generatePresentContinuousExercise(sentence: string): GeneratedExercise | null {
  const leadingSignal = /^Look!\s+/iu.test(sentence) ? "Look! " : "";
  const grammaticalSentence = leadingSignal ? sentence.slice(leadingSignal.length) : sentence;
  if (!isEditoriallySafeSentence(grammaticalSentence)) return null;
  const participles = supportedParticiplePattern();
  const question = grammaticalSentence.match(
    new RegExp(`^(Am|Is|Are)\\s+(${EXPLICIT_SUBJECT_PATTERN})\\s+(${participles})\\b([^?]*)\\?$`, "iu"),
  );
  if (question) {
    const [, auxiliary, subject, participle, rest] = question;
    const lemma = lemmaForParticiple(participle);
    if (!lemma || lemma === "be" || (lemma === "go" && /^\s+to\b/iu.test(rest))) return null;
    return createExercise({
      sentence,
      exerciseType: "question",
      prompt: `${leadingSignal}___ ${subject} ${participle}${rest}? (be)`,
      lemma,
      acceptedAnswers: [auxiliary.toLocaleLowerCase("en")],
      explanation: `${auxiliary} moves before the explicit subject in a Present Continuous question.`,
      rule: "present-continuous-question-inversion",
    });
  }

  const negative = grammaticalSentence.match(
    new RegExp(`^(${EXPLICIT_SUBJECT_PATTERN})\\s+(am not|is not|isn't|are not|aren't)\\s+(${participles})\\b(.*)$`, "iu"),
  );
  if (negative) {
    const [, subject, auxiliary, participle, rest] = negative;
    const lemma = lemmaForParticiple(participle);
    if (!lemma || lemma === "be" || (lemma === "go" && /^\s+to\b/iu.test(rest))) return null;
    const normalizedAuxiliary = auxiliary.toLocaleLowerCase("en");
    const be = normalizedAuxiliary.startsWith("am")
      ? "am"
      : normalizedAuxiliary.startsWith("is")
        ? "is"
        : "are";
    const answers = be === "am"
      ? [`am not ${participle.toLocaleLowerCase("en")}`]
      : [
          `${be} not ${participle.toLocaleLowerCase("en")}`,
          `${be === "is" ? "isn't" : "aren't"} ${participle.toLocaleLowerCase("en")}`,
        ];
    return createExercise({
      sentence,
      exerciseType: "negative",
      prompt: `${leadingSignal}${subject} ___${rest} (not/${lemma})`,
      lemma,
      acceptedAnswers: answers,
      explanation: `${be} agrees with the subject, followed by not and “${participle.toLocaleLowerCase("en")}”.`,
      rule: "present-continuous-negative",
    });
  }

  const affirmative = grammaticalSentence.match(
    new RegExp(`^(${EXPLICIT_SUBJECT_PATTERN})\\s+(am|is|are)\\s+(${participles})\\b(.*)$`, "iu"),
  );
  if (!affirmative) return null;
  const [, subject, auxiliary, participle, rest] = affirmative;
  const lemma = lemmaForParticiple(participle);
  if (!lemma || lemma === "be" || (lemma === "go" && /^\s+to\b/iu.test(rest))) return null;
  return createExercise({
    sentence,
    exerciseType: "affirmative",
    prompt: `${leadingSignal}${subject} ___${rest} (${lemma})`,
    lemma,
    acceptedAnswers: [`${auxiliary.toLocaleLowerCase("en")} ${participle.toLocaleLowerCase("en")}`],
    explanation: `${auxiliary.toLocaleLowerCase("en")} agrees with the subject and “${participle.toLocaleLowerCase("en")}” describes the activity in progress.`,
    rule: "present-continuous-affirmative",
  });
}
