import { describe, expect, it } from "vitest";
import { parsePromptInstructionsJson } from "../sandbox/src/prompt-json";

describe("prompt JSON parsing", () => {
  it("parses normal JSON unchanged", () => {
    const parsed = parsePromptInstructionsJson('{"review":"hello"}') as {
      review: string;
    };

    expect(parsed.review).toBe("hello");
  });

  it("accepts multiline prompt text with raw newline characters", () => {
    const raw = `{
  "review": "
You are a reviewer.
Check fairness and accessibility.
"
}`;

    const parsed = parsePromptInstructionsJson(raw) as { review: string };
    expect(parsed.review).toContain("You are a reviewer.");
    expect(parsed.review).toContain("Check fairness and accessibility.");
  });

  it("auto-corrects unescaped quotes inside multiline prompt values", () => {
    const raw = `{
  "review": "
Text says "caused by" and "leads to" without escaped quotes.
"
}`;

    const parsed = parsePromptInstructionsJson(raw) as { review: string };
    expect(parsed.review).toContain('"caused by"');
    expect(parsed.review).toContain('"leads to"');
  });

  it("throws when payload is structurally invalid", () => {
    expect(() => parsePromptInstructionsJson('{"review": "abc"')).toThrow();
  });
});
