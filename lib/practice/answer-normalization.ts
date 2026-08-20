const APOSTROPHES = /[\u2018\u2019\u02bc\uff07]/g;

export function normalizePracticeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .replace(APOSTROPHES, "'")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

export function isAcceptedPracticeAnswer(
  answer: string,
  acceptedAnswers: readonly string[],
): boolean {
  const normalized = normalizePracticeAnswer(answer);
  return acceptedAnswers.some(
    (accepted) => normalizePracticeAnswer(accepted) === normalized,
  );
}
