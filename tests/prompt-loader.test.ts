import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveActionBundleRootFromEntry,
  resolvePromptRoot,
} from "../src/core/prompt-loader";

describe("prompt loader", () => {
  const actionRefs = ["v1", "v1.0.6", "1.0.6", "main"];

  function normalize(value: string | undefined): string | undefined {
    return value ? path.normalize(value) : undefined;
  }

  function toPosix(value: string | undefined): string | undefined {
    return value?.replaceAll("\\", "/");
  }

  it.each(actionRefs)(
    "resolves action bundle root from dist entry for ref %s",
    (ref) => {
      const actionRoot = resolveActionBundleRootFromEntry(
        `/home/runner/work/_actions/owner/repo/${ref}/dist/index.cjs`,
      );

      expect(toPosix(actionRoot)?.endsWith(`/owner/repo/${ref}`)).toBe(true);
    },
  );

  it("does not resolve action root for non-dist entries", () => {
    const actionRoot = resolveActionBundleRootFromEntry(
      "/home/runner/work/repo/src/server.ts",
    );

    expect(actionRoot).toBeUndefined();
  });

  it.each(actionRefs)(
    "prefers github action path for relative prompt roots with ref %s",
    (ref) => {
      const promptRoot = resolvePromptRoot("prompts", {
        githubActionPath: `/home/runner/work/_actions/owner/repo/${ref}`,
        entryPath: "/home/runner/work/repo/src/server.ts",
        cwd: "/home/runner/work/repo",
      });

      expect(toPosix(promptRoot)?.endsWith(`/owner/repo/${ref}/prompts`)).toBe(
        true,
      );
    },
  );

  it.each(actionRefs)(
    "falls back to action bundle root when action path is unavailable for ref %s",
    (ref) => {
      const promptRoot = resolvePromptRoot("prompts", {
        entryPath: `/home/runner/work/_actions/owner/repo/${ref}/dist/index.cjs`,
        cwd: "/home/runner/work/repo",
      });

      expect(toPosix(promptRoot)?.endsWith(`/owner/repo/${ref}/prompts`)).toBe(
        true,
      );
    },
  );

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
      githubActionPath: "/home/runner/work/_actions/owner/repo/v1.0.6",
      entryPath: "/home/runner/work/_actions/owner/repo/v1.0.6/dist/index.cjs",
      cwd: "/home/runner/work/repo",
    });

    expect(normalize(promptRoot)).toBe(normalize(absolute));
  });
});
