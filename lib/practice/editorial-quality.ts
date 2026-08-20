export const EXPLICIT_SUBJECT_PATTERN = String.raw`(?:I|you|we|they|he|she|it|this|that|these|those|Tom|Mary|everyone|everybody|someone|somebody|something|nothing|(?:many|some|several|few|both|all)\s+[a-z]+(?:\s+[a-z]+){0,1}|(?:the|a|an|this|that|these|those|my|your|our|their|his|her|its)\s+[a-z]+(?:\s+[a-z]+){0,1}|[a-z]+s)`;

const UNSUITABLE_LEARNING_CONTENT = /\b(?:abuse|antisemitic|blackmail|blood|bomb|death|die|drug|ethnostate|fascis[mt]|gay|gun|hate|homophobic|israel|kill|lgbt|murder|nazi|nude|palestinian|porn|queer|racis[mt]|rape|reactionar(?:y|ies)|religion|sex|sexy|slur|suicide|terror|torture|violence|war|weapon)\b/iu;

/**
 * Keeps the first package deliberately plain: one neutral sentence, no names,
 * quotations, figures, or clause punctuation that could make the blank depend
 * on hidden context.
 */
export function isEditoriallySafeSentence(sentence: string): boolean {
  const words = sentence.match(/[\p{L}\p{N}']+/gu) ?? [];
  if (words.length < 4 || words.length > 16) return false;
  if (!/^[\p{L}][\p{L}'’ -]*[.!?]$/u.test(sentence)) return false;
  if ((sentence.match(/[.!?]/gu) ?? []).length !== 1) return false;
  if (/[,:;"“”‘’()[\]{}\d]/u.test(sentence)) return false;
  if (UNSUITABLE_LEARNING_CONTENT.test(sentence)) return false;

  const laterWords = words.slice(1);
  const allowedCapitalizedWords = new Set([
    "English",
    "Friday",
    "Fridays",
    "Monday",
    "Mondays",
    "Saturday",
    "Saturdays",
    "Sunday",
    "Sundays",
    "Thursday",
    "Thursdays",
    "Tuesday",
    "Tuesdays",
    "Wednesday",
    "Wednesdays",
  ]);
  if (laterWords.some((word) => /^[A-Z][a-z]+$/u.test(word) && !allowedCapitalizedWords.has(word))) {
    return false;
  }
  return true;
}
