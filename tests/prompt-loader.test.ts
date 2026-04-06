import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveActionBundleRootFromEntry,
  resolvePromptRoot,
} from "../src/core/prompt-loader";

describe("prompt loader", () => {
  function normalize(value: string | undefined): string | undefined {
    return value ? path.normalize(value) : undefined;
  }

  function toPosix(value: string | undefined): string | undefined {
    return value?.replaceAll("\\", "/");
  }

  it("resolves action bundle root from a dist entry file", () => {
    const actionRoot = resolveActionBundleRootFromEntry(
      "/home/runner/work/_actions/owner/repo/v1.0.5/dist/index.cjs",
    );

    expect(toPosix(actionRoot)).toMatch(
      /\/home\/runner\/work\/_actions\/owner\/repo\/v1\.0\.5$/,
    );
  });

  it("does not resolve action root for non-dist entries", () => {
    const actionRoot = resolveActionBundleRootFromEntry(
      "/home/runner/work/repo/src/server.ts",
    );

    expect(actionRoot).toBeUndefined();
  });

  it("prefers github action path for relative prompt roots", () => {
    const promptRoot = resolvePromptRoot("prompts", {
      githubActionPath: "/home/runner/work/_actions/owner/repo/v1.0.5",
      entryPath: "/home/runner/work/repo/src/server.ts",
      cwd: "/home/runner/work/repo",
    });

    expect(toPosix(promptRoot)).toMatch(
      /\/home\/runner\/work\/_actions\/owner\/repo\/v1\.0\.5\/prompts$/,
    );
  });

  it("falls back to action bundle root when github action path is unavailable", () => {
    const promptRoot = resolvePromptRoot("prompts", {
      entryPath: "/home/runner/work/_actions/owner/repo/v1.0.5/dist/index.cjs",
      cwd: "/home/runner/work/repo",
    });

    expect(toPosix(promptRoot)).toMatch(
      /\/home\/runner\/work\/_actions\/owner\/repo\/v1\.0\.5\/prompts$/,
    );
  });

  it("falls back to cwd when neither action path nor action entry is available", () => {
    const promptRoot = resolvePromptRoot("prompts", {
      entryPath: "/home/runner/work/repo/src/server.ts",
      cwd: "/home/runner/work/repo",
    });

    expect(toPosix(promptRoot)).toMatch(/\/home\/runner\/work\/repo\/prompts$/);
  });

  it("returns absolute prompt roots unchanged", () => {
    const absolute =
      process.platform === "win32"
        ? "C:/work/repo/.github/ccr-prompts"
        : "/home/runner/work/repo/.github/ccr-prompts";

    const promptRoot = resolvePromptRoot(absolute, {
      githubActionPath: "/home/runner/work/_actions/owner/repo/v1.0.5",
      entryPath: "/home/runner/work/_actions/owner/repo/v1.0.5/dist/index.cjs",
      cwd: "/home/runner/work/repo",
    });

    expect(normalize(promptRoot)).toBe(normalize(absolute));
  });
});
