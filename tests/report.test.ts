import { describe, expect, it } from "vitest";
import { buildInlineReviewComments } from "../src/core/inline-comments";
import {
  buildReviewConversationBody,
  parseReviewModelOutput,
} from "../src/core/report";

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

  it("preserves codeBlock so inline comments anchor to the matched code instead of prose", () => {
    const parsed = parseReviewModelOutput(
      JSON.stringify({
        summary: "The parent dashboard flow needs stronger consent checks.",
        riskLevel: "high",
        findings: [
          {
            severity: "high",
            title: "Missing Consent Checks for Learner Data",
            detail:
              "The `get_parent_dashboard()` endpoint returns grades after only checking `parent_child_relations`, so a parent could keep seeing student data after consent is revoked.",
            file: "backend/main.py",
            codeBlock: [
              "+def get_parent_dashboard(parent_id: int):",
              "+    relation = parent_child_relations.get(parent_id)",
              "+    return build_dashboard(relation.student_id)",
            ].join("\n"),
            recommendation:
              "Check active consent and revocation state before returning learner data.",
          },
        ],
        todos: [],
        notes: [],
      }),
    );

    expect(parsed.findings[0]?.codeBlock).toContain(
      "relation = parent_child_relations.get(parent_id)",
    );

    const inlineComments = buildInlineReviewComments({
      findings: parsed.findings,
      files: [
        {
          path: "backend/main.py",
          name: "main.py",
          content: "",
          patch: [
            "@@ -48,3 +48,6 @@",
            ' DRAFT = "draft"',
            ' PUBLISHED = "published"',
            "+def get_parent_dashboard(parent_id: int):",
            "+    relation = parent_child_relations.get(parent_id)",
            "+    return build_dashboard(relation.student_id)",
          ].join("\n"),
        },
      ],
      maxComments: 10,
    });

    expect(inlineComments.comments).toHaveLength(1);
    expect(inlineComments.comments[0]?.line).toBe(50);
    expect(inlineComments.comments[0]?.startLine).toBe(48);
    expect(inlineComments.comments[0]?.endLine).toBe(52);
  });
});
