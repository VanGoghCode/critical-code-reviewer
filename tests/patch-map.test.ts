import { describe, expect, it } from "vitest";
import {
  parseUnifiedDiffPatch,
  resolveChangedLine,
  parseStructuredDiffHunks,
  resolveAnchorToGitHubLocation,
  resolveCodeBlockToLine,
} from "../src/core/patch-map";

const SAMPLE_PATCH = [
  "@@ -1,3 +1,4 @@",
  " const seed = 1;",
  "-const score = compute(raw);",
  "+const normalizedScore = compute(raw);",
  "+const teacherVisible = normalizedScore > 0.8;",
  " export { normalizedScore };",
].join("\n");

describe("resolveChangedLine", () => {
  it("resolves small off-by-one drift to the nearest visible line", () => {
    const patchMap = parseUnifiedDiffPatch(SAMPLE_PATCH);

    const resolved = resolveChangedLine({
      patchMap,
      requestedLine: 6, // 5 and 6 don't exist. Closest is 4.
      allowFallbackToFirstChangedLine: false,
    });

    expect(resolved).toBe(4);
  });

  it("accepts explicitly requested context lines", () => {
    const patchMap = parseUnifiedDiffPatch(SAMPLE_PATCH);

    const resolved = resolveChangedLine({
      patchMap,
      requestedLine: 1, // Line 1 is a context line in SAMPLE_PATCH
      allowFallbackToFirstChangedLine: false,
    });

    expect(resolved).toBe(1);
  });

  it("returns undefined for distant line drift when fallback is disabled", () => {
    const patchMap = parseUnifiedDiffPatch(SAMPLE_PATCH);

    const resolved = resolveChangedLine({
      patchMap,
      requestedLine: 80,
      searchText: "Guard visibility checks before exposing records.",
      allowFallbackToFirstChangedLine: false,
    });

    expect(resolved).toBeUndefined();
  });

  it("prefers exact textual matches from finding detail", () => {
    const patchMap = parseUnifiedDiffPatch(SAMPLE_PATCH);

    const resolved = resolveChangedLine({
      patchMap,
      requestedLine: 80,
      searchText:
        "The line below is risky.\nconst teacherVisible = normalizedScore > 0.8;",
      allowFallbackToFirstChangedLine: false,
    });

    expect(resolved).toBe(3);
  });
});

describe("parseStructuredDiffHunks", () => {
  it("parses diff hunks into structured format with line types", () => {
    const hunks = parseStructuredDiffHunks(SAMPLE_PATCH);

    expect(hunks).toHaveLength(1);
    expect(hunks[0].id).toBe("hunk_1");
    expect(hunks[0].oldStart).toBe(1);
    expect(hunks[0].newStart).toBe(1);
    expect(hunks[0].lines).toHaveLength(5);

    expect(hunks[0].lines[0]).toEqual({
      type: "context",
      oldLine: 1,
      newLine: 1,
      text: "const seed = 1;",
    });

    expect(hunks[0].lines[1]).toEqual({
      type: "del",
      oldLine: 2,
      newLine: null,
      text: "const score = compute(raw);",
    });

    expect(hunks[0].lines[2]).toEqual({
      type: "add",
      oldLine: null,
      newLine: 2,
      text: "const normalizedScore = compute(raw);",
    });

    expect(hunks[0].lines[3]).toEqual({
      type: "add",
      oldLine: null,
      newLine: 3,
      text: "const teacherVisible = normalizedScore > 0.8;",
    });

    expect(hunks[0].lines[4]).toEqual({
      type: "context",
      oldLine: 3,
      newLine: 4,
      text: "export { normalizedScore };",
    });
  });
});

describe("resolveAnchorToGitHubLocation", () => {
  it("resolves exact anchor snippet to correct line", () => {
    const hunks = parseStructuredDiffHunks(SAMPLE_PATCH);

    const result = resolveAnchorToGitHubLocation({
      anchorSnippet: "teacherVisible",
      hunks,
    });

    expect(result).toEqual({
      line: 3,
      confidence: "exact",
    });
  });

  it("resolves anchor with hunk ID constraint", () => {
    const hunks = parseStructuredDiffHunks(SAMPLE_PATCH);

    const result = resolveAnchorToGitHubLocation({
      anchorSnippet: "normalizedScore",
      hunkId: "hunk_1",
      hunks,
    });

    expect(result).toEqual({
      line: 2,
      confidence: "exact",
    });
  });

  it("uses fuzzy matching when exact match fails", () => {
    const hunks = parseStructuredDiffHunks(SAMPLE_PATCH);

    // This should match line 3 via fuzzy matching
    // "const teacherVisible = normalizedScore > 0.8;"
    const result = resolveAnchorToGitHubLocation({
      anchorSnippet: "const teacherVisible normalizedScore",
      hunks,
    });

    expect(result?.confidence).toBe("fuzzy");
    expect(result?.line).toBe(3);
  });

  it("returns undefined for non-matching anchor", () => {
    const hunks = parseStructuredDiffHunks(SAMPLE_PATCH);

    const result = resolveAnchorToGitHubLocation({
      anchorSnippet: "nonexistent code snippet xyz",
      hunks,
    });

    expect(result).toBeUndefined();
  });

  it("returns first match when multiple exact matches exist", () => {
    const multiLinePatch = [
      "@@ -1,2 +1,4 @@",
      " const seed = 1;",
      "+const value = compute(seed);",
      "+const result = compute(value);",
      " export { result };",
    ].join("\n");

    const hunks = parseStructuredDiffHunks(multiLinePatch);

    // Both lines contain "compute", returns first match
    const result = resolveAnchorToGitHubLocation({
      anchorSnippet: "compute",
      hunks,
    });

    expect(result?.line).toBe(2);
    expect(result?.confidence).toBe("exact");
  });

  it("resolves multi-line code block to correct line", () => {
    const patch = [
      "@@ -1,3 +1,4 @@",
      " const seed = 1;",
      "-const score = compute(raw);",
      "+const normalizedScore = compute(raw);",
      "+const teacherVisible = normalizedScore > 0.8;",
      " export { normalizedScore };",
    ].join("\n");

    const hunks = parseStructuredDiffHunks(patch);

    // AI provides a code block (with + prefix as it would appear in diff)
    const codeBlock = [
      "+const normalizedScore = compute(raw);",
      "+const teacherVisible = normalizedScore > 0.8;",
    ].join("\n");

    const result = resolveCodeBlockToLine({
      codeBlock,
      hunks,
      preferChangedLines: true,
    });

    expect(result?.line).toBe(2);
    expect(result?.confidence).toBe("exact");
  });

  it("returns undefined when the code block is not verbatim", () => {
    const patch = [
      "@@ -1,3 +1,4 @@",
      " const seed = 1;",
      "-const score = compute(raw);",
      "+const normalizedScore = compute(raw);",
      "+const teacherVisible = normalizedScore > 0.8;",
      " export { normalizedScore };",
    ].join("\n");

    const hunks = parseStructuredDiffHunks(patch);

    const codeBlock = [
      "const normalizedScore = compute(raw);",
      "const teacherVisible = normalizedScore > 0.75;",
    ].join("\n");

    const result = resolveCodeBlockToLine({
      codeBlock,
      hunks,
      preferChangedLines: true,
    });

    expect(result).toBeUndefined();
  });

  it("returns undefined for non-matching code block", () => {
    const patch = [
      "@@ -1,3 +1,4 @@",
      " const seed = 1;",
      "-const score = compute(raw);",
      "+const normalizedScore = compute(raw);",
      "+const teacherVisible = normalizedScore > 0.8;",
      " export { normalizedScore };",
    ].join("\n");

    const hunks = parseStructuredDiffHunks(patch);

    const codeBlock = [
      "function nonexistentCode() {",
      "  return 'not in diff';",
      "}",
    ].join("\n");

    const result = resolveCodeBlockToLine({
      codeBlock,
      hunks,
    });

    expect(result).toBeUndefined();
  });

  it("returns undefined when the same code block appears more than once", () => {
    const patch = [
      "@@ -1,2 +1,5 @@",
      " const seed = 1;",
      "+const teacherVisible = normalizedScore > 0.8;",
      "+const teacherVisible = normalizedScore > 0.8;",
      " export { normalizedScore };",
    ].join("\n");

    const hunks = parseStructuredDiffHunks(patch);

    const result = resolveCodeBlockToLine({
      codeBlock: "+const teacherVisible = normalizedScore > 0.8;",
      hunks,
    });

    expect(result).toBeUndefined();
  });
});
