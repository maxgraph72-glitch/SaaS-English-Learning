import { describe, expect, it } from "vitest";
import { evaluateSpeaking } from "../lib/speaking/evaluation";
import { speakingPromptBank } from "../lib/speaking/prompts";

describe("speaking feedback", () => {
  it("gives transparent full marks to a complete clear reading at a steady pace", () => {
    const reference = "I speak slowly and finish every clear sentence today.";
    const result = evaluateSpeaking(reference, reference, 5);
    expect(result.score).toBe(100);
    expect(result.metrics.completeness).toBe(100);
    expect(result.metrics.wordAccuracy).toBe(100);
    expect(result.metrics.wordsPerMinute).toBe(108);
  });

  it("lowers completeness when recognized words are missing", () => {
    const result = evaluateSpeaking(
      "I speak slowly and finish every clear sentence today.",
      "I speak slowly today.",
      5,
    );
    expect(result.metrics.completeness).toBeLessThan(60);
    expect(result.score).toBeLessThan(75);
    expect(result.improvements.join(" ")).toMatch(/finish each sentence/i);
  });

  it("handles repeated words with multiset matching", () => {
    const result = evaluateSpeaking("very very clear", "very clear clear", 2);
    expect(result.metrics.completeness).toBe(67);
    expect(result.metrics.wordAccuracy).toBe(67);
  });

  it("keeps every daily prompt to five short sentences", () => {
    for (const prompt of speakingPromptBank) {
      expect(prompt.text.match(/[.!?](?:\s|$)/g)).toHaveLength(5);
      expect(prompt.text.length).toBeGreaterThanOrEqual(80);
      expect(prompt.text.length).toBeLessThanOrEqual(700);
    }
  });
});
