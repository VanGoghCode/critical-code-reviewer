import { describe, expect, it } from "vitest";
import { buildInlineReviewComments } from "../src/core/inline-comments";

describe("buildInlineReviewComments", () => {
  it("resolves comments using an exact code block", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail:
            "The teacherVisible flag lacks confidence calibration checks.",
          file: "src/app/alerts.ts",
          codeBlock: [
            "+const normalizedScore = compute(raw);",
            "+const teacherVisible = normalizedScore > 0.8;",
          ].join("\n"),
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
    expect(result.comments[0].line).toBe(2);
    expect(result.comments[0].startLine).toBe(1);
    expect(result.comments[0].endLine).toBe(4);
    expect(result.comments[0].path).toBe("src/app/alerts.ts");
  });

  it("skips findings when codeBlock is missing instead of guessing from prose", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail: "The normalizedScore computation lacks calibration.",
          file: "src/app/alerts.ts",
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

    expect(result.comments).toHaveLength(0);
    expect(result.skippedByReason["missing-code-block"]).toBe(1);
  });

  it("skips findings when the provided codeBlock does not match the diff exactly", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail:
            "The teacherVisible flag lacks confidence calibration checks.",
          file: "src/app/alerts.ts",
          codeBlock: [
            "+const normalizedScore = compute(raw);",
            "+const teacherVisible = normalizedScore > 0.75;",
          ].join("\n"),
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
    });

    expect(result.comments).toHaveLength(0);
    expect(result.skippedByReason["unresolved-line"]).toBe(1);
  });

  it("includes line notation in comment body", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail:
            "The teacherVisible flag lacks confidence calibration checks.",
          file: "src/app/alerts.ts",
          codeBlock: "+const teacherVisible = normalizedScore > 0.8;",
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
    expect(result.comments[0].body).toContain("Comment on line 3");
    expect(result.comments[0].body).toContain(
      "**Protected Attribute Governance**",
    );
    expect(result.comments[0].startLine).toBe(1);
    expect(result.comments[0].endLine).toBe(4);
  });

  it("resolves comments using codeBlock", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail:
            "The teacherVisible flag lacks confidence calibration checks.",
          file: "src/app/alerts.ts",
          codeBlock: [
            "+const normalizedScore = compute(raw);",
            "+const teacherVisible = normalizedScore > 0.8;",
          ].join("\n"),
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
    expect(result.comments[0].line).toBe(2);
    expect(result.comments[0].body).toContain("Comment on lines 2-3");
    expect(result.comments[0].startLine).toBe(1);
    expect(result.comments[0].endLine).toBe(4);
  });

  it("anchors using the first line of the matched code block", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail:
            "The teacherVisible flag lacks confidence calibration checks.",
          file: "src/app/alerts.ts",
          codeBlock: [
            "+const normalizedScore = compute(raw);",
            "+const teacherVisible = normalizedScore > 0.8;",
          ].join("\n"),
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
    expect(result.comments[0].line).toBe(2);
    expect(result.comments[0].startLine).toBe(1);
    expect(result.comments[0].endLine).toBe(4);
  });
});
