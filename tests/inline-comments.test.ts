import { describe, expect, it } from "vitest";
import { buildInlineReviewComments } from "../src/core/inline-comments";

describe("buildInlineReviewComments", () => {
  it("skips findings when line mapping cannot be resolved confidently", () => {
    const result = buildInlineReviewComments({
      findings: [
        {
          severity: "high",
          title: "Protected Attribute Governance",
          detail:
            "A teacher could see a risk label without sufficient confidence calibration.",
          file: "src/app/alerts.ts",
          line: 88,
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
    expect(result.skippedByReason["unresolved-line"]).toBe(1);
  });
});
