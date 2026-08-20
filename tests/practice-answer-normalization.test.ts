import { describe, expect, it } from "vitest";
import {
  isAcceptedPracticeAnswer,
  normalizePracticeAnswer,
} from "../lib/practice/answer-normalization";

describe("practice answer normalization", () => {
  it("normalizes Unicode, case, whitespace, and approved apostrophes", () => {
    expect(normalizePracticeAnswer("  DOESN’T\tWORK  ")).toBe("doesn't work");
    expect(normalizePracticeAnswer("ＡＲＥ   ＷＯＲＫＩＮＧ")).toBe("are working");
  });

  it("accepts full and contracted answers from the explicit answer key", () => {
    const accepted = ["does not work", "doesn't work"];
    expect(isAcceptedPracticeAnswer("Does not work", accepted)).toBe(true);
    expect(isAcceptedPracticeAnswer("doesnʼt work", accepted)).toBe(true);
  });

  it("does not accept semantically similar but grammatically different text", () => {
    expect(isAcceptedPracticeAnswer("doesn't work", ["works"])).toBe(false);
    expect(isAcceptedPracticeAnswer("is working", ["works"])).toBe(false);
    expect(isAcceptedPracticeAnswer("work", ["works"])).toBe(false);
  });
});
