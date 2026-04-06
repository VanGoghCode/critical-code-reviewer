import { readFile } from "node:fs/promises";
import path from "node:path";

const ACTION_ENTRY_FILE_PATTERN = /^index\.(cjs|js|mjs)$/;

export function resolveActionBundleRootFromEntry(
  entryPath: string | undefined,
): string | undefined {
  if (!entryPath) {
    return undefined;
  }

  const normalizedEntryPath = path.resolve(entryPath);
  const entryDir = path.dirname(normalizedEntryPath);
  const entryName = path.basename(normalizedEntryPath);
  if (path.basename(entryDir) !== "dist") {
    return undefined;
  }

  if (!ACTION_ENTRY_FILE_PATTERN.test(entryName)) {
    return undefined;
  }

  return path.resolve(entryDir, "..");
}

export function resolvePromptRoot(
  promptRoot = "prompts",
  options?: {
    githubActionPath?: string;
    entryPath?: string;
    cwd?: string;
  },
): string {
  if (path.isAbsolute(promptRoot)) {
    return promptRoot;
  }

  const githubActionPath =
    options?.githubActionPath ?? process.env.GITHUB_ACTION_PATH;
  if (githubActionPath && githubActionPath.trim().length > 0) {
    return path.resolve(githubActionPath, promptRoot);
  }

  const actionBundleRoot = resolveActionBundleRootFromEntry(
    options?.entryPath ?? process.argv[1],
  );
  const baseDir = actionBundleRoot ?? options?.cwd ?? process.cwd();
  return path.resolve(baseDir, promptRoot);
}

export async function readPromptText(
  promptRoot: string,
  promptPath: string,
): Promise<string> {
  const absolutePath = path.resolve(promptRoot, promptPath);
  return readFile(absolutePath, "utf8");
}
