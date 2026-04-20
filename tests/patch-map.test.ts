import { describe, expect, it } from "vitest";
import {
  parseUnifiedDiffPatch,
  resolveChangedLine,
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
  it("resolves small off-by-one drift to the nearest changed line", () => {
    const patchMap = parseUnifiedDiffPatch(SAMPLE_PATCH);

    const resolved = resolveChangedLine({
      patchMap,
      requestedLine: 4,
      allowFallbackToFirstChangedLine: false,
    });

    expect(resolved).toBe(3);
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
