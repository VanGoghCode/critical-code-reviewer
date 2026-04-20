import { describe, expect, it } from "vitest";
import { buildInlineReviewComments } from "../src/core/inline-comments";

describe("buildInlineReviewComments", () => {
  it("resolves comments using anchor snippets", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail:
            "The teacherVisible flag lacks confidence calibration checks.",
          file: "src/app/alerts.ts",
          anchorSnippet: "teacherVisible",
          hunkId: "hunk_1",
          recommendation:
            "Gate visibility until confidence and consent checks both pass.",
        },
      ],
      files: [
        {
          path: "src/app/alerts.ts",
          name: "alerts.ts",
          content: "",
          patch: [
            "@@ -1,3 +1,4 @@",
            " const seed = 1;",
            "-const score = compute(raw);",
            "+const normalizedScore = compute(raw);",
            "+const teacherVisible = normalizedScore > 0.8;",
            " export { normalizedScore };",
          ].join("\n"),
        },
      ],
      maxComments: 10,
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].line).toBe(3);
    expect(result.comments[0].path).toBe("src/app/alerts.ts");
  });

  it("skips findings when anchor snippet cannot be resolved", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail:
            "This code has an issue that needs attention.",
          file: "src/app/alerts.ts",
          anchorSnippet: "nonexistentCodeThatWillNeverMatch",
          recommendation:
            "Gate visibility until confidence and consent checks both pass.",
        },
      ],
      files: [
        {
          path: "src/app/alerts.ts",
          name: "alerts.ts",
          content: "",
          patch: [
            "@@ -1,3 +1,4 @@",
            " const seed = 1;",
            "-const score = compute(raw);",
            "+const normalizedScore = compute(raw);",
            "+const teacherVisible = normalizedScore > 0.8;",
            " export { normalizedScore };",
          ].join("\n"),
        },
      ],
      maxComments: 10,
      allowFallbackToFirstChangedLine: false,
    });

    expect(result.comments).toHaveLength(0);
    expect(result.skippedByReason["unresolved-line"]).toBe(1);
  });

  it("falls back to detail text when anchor snippet is missing", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail: "The normalizedScore computation lacks calibration.",
          file: "src/app/alerts.ts",
          recommendation: "Add confidence checks.",
        },
      ],
      files: [
        {
          path: "src/app/alerts.ts",
          name: "alerts.ts",
          content: "",
          patch: [
            "@@ -1,3 +1,4 @@",
            " const seed = 1;",
            "-const score = compute(raw);",
            "+const normalizedScore = compute(raw);",
            "+const teacherVisible = normalizedScore > 0.8;",
            " export { normalizedScore };",
          ].join("\n"),
        },
      ],
      maxComments: 10,
      allowFallbackToFirstChangedLine: true,
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].line).toBe(2);
  });

  it("includes line notation in comment body", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail: "The teacherVisible flag lacks confidence calibration checks.",
          file: "src/app/alerts.ts",
          anchorSnippet: "teacherVisible",
          recommendation: "Gate visibility until confidence and consent checks both pass.",
        },
      ],
      files: [
        {
          path: "src/app/alerts.ts",
          name: "alerts.ts",
          content: "",
          patch: [
            "@@ -1,3 +1,4 @@",
            " const seed = 1;",
            "-const score = compute(raw);",
            "+const normalizedScore = compute(raw);",
            "+const teacherVisible = normalizedScore > 0.8;",
            " export { normalizedScore };",
          ].join("\n"),
        },
      ],
      maxComments: 10,
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].body).toContain("Comment on line 3");
    expect(result.comments[0].body).toContain("**Protected Attribute Governance**");
  });
});
