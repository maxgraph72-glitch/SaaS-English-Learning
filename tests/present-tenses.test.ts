import { describe, expect, it } from "vitest";
import {
  generatePresentContinuousExercise,
  toPresentParticiple,
} from "../lib/practice/present-continuous";
import {
  generatePresentSimpleExercise,
  toThirdPersonSingular,
} from "../lib/practice/present-simple";
import { generatePresentTenseExercise } from "../lib/practice/present-tenses";

describe("Present Simple deterministic generation", () => {
  it("forms regular, -es, consonant+y, and irregular third-person answers", () => {
    expect(toThirdPersonSingular("work")).toBe("works");
    expect(toThirdPersonSingular("watch")).toBe("watches");
    expect(toThirdPersonSingular("carry")).toBe("carries");
    expect(toThirdPersonSingular("have")).toBe("has");
    expect(toThirdPersonSingular("do")).toBe("does");
  });

  it("generates affirmative, negative, and Do/Does questions", () => {
    expect(generatePresentSimpleExercise("She watches the morning news every day.")?.acceptedAnswers).toEqual(["watches"]);
    expect(generatePresentSimpleExercise("They do not drink coffee at night.")?.acceptedAnswers).toEqual([
      "do not drink",
      "don't drink",
    ]);
    expect(generatePresentSimpleExercise("Does she work here every day?")?.acceptedAnswers).toEqual(["does"]);
  });

  it("targets the explicit finite verb when a later supported word is a noun", () => {
    expect(generatePresentSimpleExercise("My brother studies English after work.")?.acceptedAnswers).toEqual([
      "studies",
    ]);
  });

  it("rejects modal, imperative, question, and noun-only false positives", () => {
    expect(generatePresentSimpleExercise("Tom wouldn't study French.")).toBeNull();
    expect(generatePresentSimpleExercise("Live a peaceful life.")).toBeNull();
    expect(generatePresentSimpleExercise("Hey, wait a minute!")).toBeNull();
    expect(generatePresentSimpleExercise("Don't have a fit!")).toBeNull();
    expect(generatePresentSimpleExercise("Does that excite you?")).toBeNull();
    expect(generatePresentSimpleExercise("Data breaches undermine trust.")).toBeNull();
    expect(generatePresentSimpleExercise("This offer has expired.")).toBeNull();
    expect(generatePresentSimpleExercise("Those aren't carrot leaves.")).toBeNull();
  });
});

describe("Present Continuous deterministic generation", () => {
  it("handles ordinary, silent-e, ie-to-y, and reviewed doubling forms", () => {
    expect(toPresentParticiple("play")).toBe("playing");
    expect(toPresentParticiple("make")).toBe("making");
    expect(toPresentParticiple("lie")).toBe("lying");
    expect(toPresentParticiple("run")).toBe("running");
  });

  it("generates affirmative, negative, and inversion answers", () => {
    expect(generatePresentContinuousExercise("The children are playing in the garden now.")?.acceptedAnswers).toEqual(["are playing"]);
    expect(generatePresentContinuousExercise("He isn't sleeping at the moment.")?.acceptedAnswers).toEqual([
      "is not sleeping",
      "isn't sleeping",
    ]);
    expect(generatePresentContinuousExercise("Are you waiting for the bus now?")?.acceptedAnswers).toEqual(["are"]);
  });

  it("does not invent amn't and rejects gerunds or passive forms", () => {
    expect(generatePresentContinuousExercise("I am not working this morning.")?.acceptedAnswers).toEqual(["am not working"]);
    expect(generatePresentContinuousExercise("Reading books is relaxing.")).toBeNull();
    expect(generatePresentContinuousExercise("The report is written today.")).toBeNull();
  });

  it("marks only explicit current or temporary contexts as tense contrasts", () => {
    expect(generatePresentTenseExercise("Look! It is snowing outside.")?.grammarTopic).toBe("present_simple_vs_continuous");
    expect(generatePresentTenseExercise("The children are playing in the garden now.")?.grammarTopic).toBe("present_simple_vs_continuous");
    expect(generatePresentTenseExercise("The children are playing in the garden.")?.grammarTopic).toBe("present_continuous");
  });
});
