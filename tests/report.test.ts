import { describe, expect, it } from "vitest";
import { buildReviewConversationBody } from "../src/core/report";

describe("buildReviewConversationBody", () => {
  it("includes broad findings plus reflective questions", () => {
    const body = buildReviewConversationBody({
      summary:
        "The analytics payload structure is clear. The biggest risk is authorization drift that could expose learner records to the wrong staff member.",
      findings: [
        {
          severity: "high",
          title: "Missing Consent Checks for Learner Data",
          detail:
            "The endpoint trusts a route identifier before validating token subject claims, so a student could access another student's alert history and a teacher could act on incorrect context.",
          recommendation:
            "Check token subject and active consent state before returning learner alert data.",
        },
      ],
      notes: [
        "Have you thought about how a teacher can contest a false positive alert before intervention?",
      ],
    });

    expect(body).toContain("Missing Consent Checks for Learner Data");
    expect(body).toContain("Check token subject and active consent state");
    expect(body).toContain("Have you thought about");
    expect(body.toLowerCase()).not.toContain("users");
  });

  it("generates fallback reflective questions when notes have none", () => {
    const body = buildReviewConversationBody({
      summary:
        "The feature is structured well, but proxy-based risk scoring still needs stronger safeguards.",
      findings: [
        {
          severity: "medium",
          title: "Fairness",
          detail:
            "A heuristic based on neighborhood proxy data can over-flag a Black student as high risk even when recent assignment completion is improving.",
          recommendation:
            "Use attendance and assignment trend signals instead of proxy demographic fields.",
        },
      ],
      notes: [],
    });

    expect(body).toMatch(
      /Have you thought about|When implementing this, have you thought about/,
    );
    expect(body).toContain("a Black student");
  });

  it("does not append fallback reflective questions when no findings exist", () => {
    const body = buildReviewConversationBody({
      summary: "The PR is clean and no issues were found.",
      findings: [],
      notes: [],
    });

    expect(body).toBe("The PR is clean and no issues were found.");
  });
});
