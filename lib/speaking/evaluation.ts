import type { SpeakingMetrics } from "./types";

function words(value: string) {
  return value
    .toLocaleLowerCase("en")
    .match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function roundedPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function fluencyForRate(wordsPerMinute: number) {
  if (wordsPerMinute >= 75 && wordsPerMinute <= 170) return 100;
  if (wordsPerMinute < 75) return roundedPercent(wordsPerMinute / 75);
  return roundedPercent(Math.max(0, 1 - (wordsPerMinute - 170) / 130));
}

export function evaluateSpeaking(
  referenceText: string,
  transcript: string,
  durationSeconds: number,
) {
  const referenceWords = words(referenceText);
  const transcriptWords = words(transcript);
  const remaining = new Map<string, number>();
  for (const word of referenceWords) remaining.set(word, (remaining.get(word) ?? 0) + 1);

  let matched = 0;
  for (const word of transcriptWords) {
    const count = remaining.get(word) ?? 0;
    if (count > 0) {
      matched += 1;
      remaining.set(word, count - 1);
    }
  }

  const completeness = referenceWords.length === 0 ? 0 : matched / referenceWords.length;
  const wordAccuracy = transcriptWords.length === 0 ? 0 : matched / transcriptWords.length;
  const wordsPerMinute = durationSeconds > 0
    ? transcriptWords.length / durationSeconds * 60
    : 0;
  const fluency = fluencyForRate(wordsPerMinute) / 100;
  const score = roundedPercent(
    completeness * 0.55 + wordAccuracy * 0.3 + fluency * 0.15,
  );

  const metrics: SpeakingMetrics = {
    completeness: roundedPercent(completeness),
    wordAccuracy: roundedPercent(wordAccuracy),
    fluency: roundedPercent(fluency),
    wordsPerMinute: Math.round(wordsPerMinute),
    referenceWords: referenceWords.length,
    transcriptWords: transcriptWords.length,
  };

  const strengths: string[] = [];
  if (metrics.completeness >= 85) strengths.push("You covered almost all of the practice text.");
  if (metrics.wordAccuracy >= 85) strengths.push("The recognized words stayed close to the reference.");
  if (metrics.fluency >= 80) strengths.push("Your pace was steady enough for clear listening.");
  if (strengths.length === 0) strengths.push("You completed a full spoken attempt and created a useful baseline.");

  const improvements: string[] = [];
  if (metrics.completeness < 85) improvements.push("Try the passage again and finish each sentence before moving on.");
  if (metrics.wordAccuracy < 85) improvements.push("Slow down slightly and give each word a clear beginning and ending.");
  if (metrics.wordsPerMinute < 75) improvements.push("Connect short groups of words instead of pausing after every word.");
  if (metrics.wordsPerMinute > 170) improvements.push("Use a calmer pace so the listener can follow every sentence.");
  if (improvements.length === 0) improvements.push("Repeat once more and aim for the same clarity with a relaxed voice.");

  return {
    score,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    metrics,
  };
}
