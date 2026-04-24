import {
  parseStructuredDiffHunks,
  resolveCodeBlockToLine,
  type StructuredDiffHunk,
} from "./patch-map.js";
import type {
  ReviewFileInput,
  ReviewFinding,
  ReviewSeverity,
} from "./types.js";

const SEVERITY_PRIORITY: Record<ReviewSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const DEFAULT_CONTEXT_PADDING_LINES = 5;

const SKIP_REASON_KEYS = [
  "missing-file",
  "unmatched-file",
  "no-changed-lines",
  "missing-code-block",
  "unresolved-line",
  "duplicate",
] as const;

export type InlineCommentSkipReason = (typeof SKIP_REASON_KEYS)[number];

export interface InlineReviewComment {
  path: string;
  line: number;
  startLine?: number;
  endLine?: number;
  body: string;
  severity: ReviewSeverity;
  title: string;
}

export interface InlineCommentBuildOptions {
  findings: ReviewFinding[];
  files: ReviewFileInput[];
  maxComments: number;
  contextPaddingLines?: number;
  strategy?: InlineCommentStrategy;
}

export interface InlineCommentBuildResult {
  comments: InlineReviewComment[];
  skippedCount: number;
  skippedByReason: Record<InlineCommentSkipReason, number>;
}

export type InlineCommentStrategy = "findings" | "file-coverage";

interface InlineCommentCandidate {
  path: string;
  line: number;
  startLine?: number;
  endLine?: number;
  body: string;
  severity: ReviewSeverity;
  title: string;
  dedupeKey: string;
}

interface CandidateResolution {
  candidate?: InlineCommentCandidate;
  reason?: InlineCommentSkipReason;
}

function createSkipCounter(): Record<InlineCommentSkipReason, number> {
  return {
    "missing-file": 0,
    "unmatched-file": 0,
    "no-changed-lines": 0,
    "missing-code-block": 0,
    "unresolved-line": 0,
    duplicate: 0,
  };
}

function normalizePath(pathValue: string): string {
  return pathValue.replaceAll("\\", "/").trim().toLowerCase();
}

function formatInlineCommentBody(
  finding: ReviewFinding,
  startLine?: number,
  endLine?: number,
): string {
  // Keep inline comments in a predictable structure:
  // 1) line notation, 2) criterion name, 3) issue + impact detail, 4) small suggestion.
  const recommendation = finding.recommendation ?? finding.suggestion;

  const parts: string[] = [];

  // Add line notation if we have line information
  if (typeof startLine === "number") {
    const renderedEndLine =
      typeof endLine === "number" ? Math.max(startLine, endLine) : startLine;
    if (renderedEndLine > startLine) {
      parts.push(`_Comment on lines ${startLine}-${renderedEndLine}_\n`);
    } else {
      parts.push(`_Comment on line ${startLine}_\n`);
    }
  }

  parts.push(`**${finding.title.trim()}**\n`);
  parts.push(finding.detail.trim());

  const rec = (recommendation ?? "").trim();
  if (rec.length > 0) {
    parts.push(rec);
  }

  return parts.join("\n");
}

function sortBySeverity(findings: ReviewFinding[]): ReviewFinding[] {
  return [...findings].sort((left, right) => {
    const priorityDelta =
      SEVERITY_PRIORITY[right.severity] - SEVERITY_PRIORITY[left.severity];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

function resolveFileRecord(
  findingFile: string,
  files: ReviewFileInput[],
): ReviewFileInput | undefined {
  const normalizedTarget = normalizePath(findingFile);

  const exact = files.find(
    (file) => normalizePath(file.path) === normalizedTarget,
  );
  if (exact) {
    return exact;
  }

  const suffixMatches = files.filter((file) => {
    const normalizedFilePath = normalizePath(file.path);
    return (
      normalizedFilePath.endsWith(`/${normalizedTarget}`) ||
      normalizedFilePath.endsWith(normalizedTarget)
    );
  });

  if (suffixMatches.length === 0) {
    return undefined;
  }

  return suffixMatches.sort(
    (left, right) => left.path.length - right.path.length,
  )[0];
}

function resolveInlineCommentCandidate(params: {
  finding: ReviewFinding;
  files: ReviewFileInput[];
  hunkCache: Map<string, StructuredDiffHunk[]>;
  contextPaddingLines: number;
}): CandidateResolution {
  const { finding, files, hunkCache, contextPaddingLines } = params;

  if (!finding.file || finding.file.trim().length === 0) {
    return { reason: "missing-file" };
  }

  const fileRecord = resolveFileRecord(finding.file, files);
  if (!fileRecord) {
    return { reason: "unmatched-file" };
  }

  const patchCacheKey = fileRecord.path;

  // Parse structured hunks for anchor-based resolution
  const hunks =
    hunkCache.get(patchCacheKey) ??
    parseStructuredDiffHunks(fileRecord.patch ?? "");
  hunkCache.set(patchCacheKey, hunks);

  if (hunks.length === 0) {
    return { reason: "no-changed-lines" };
  }

  if (!finding.codeBlock || finding.codeBlock.trim().length === 0) {
    return { reason: "missing-code-block" };
  }

  const codeBlockResult = resolveCodeBlockToLine({
    codeBlock: finding.codeBlock,
    hunks,
    preferChangedLines: true,
    surroundingContextLines: contextPaddingLines,
  });

  if (!codeBlockResult) {
    return { reason: "unresolved-line" };
  }

  const rangeStartLine =
    codeBlockResult.contextStartLine < codeBlockResult.contextEndLine
      ? codeBlockResult.contextStartLine
      : undefined;
  const rangeEndLine =
    codeBlockResult.contextStartLine < codeBlockResult.contextEndLine
      ? codeBlockResult.contextEndLine
      : undefined;
  const dedupeKey = `${fileRecord.path}:${rangeStartLine ?? codeBlockResult.line}:${
    rangeEndLine ?? codeBlockResult.line
  }:${finding.title.trim().toLowerCase()}`;

  return {
    candidate: {
      path: fileRecord.path,
      line: codeBlockResult.line,
      startLine: rangeStartLine,
      endLine: rangeEndLine,
      body: formatInlineCommentBody(
        finding,
        codeBlockResult.line,
        codeBlockResult.endLine,
      ),
      severity: finding.severity,
      title: finding.title,
      dedupeKey,
    },
  };
}

export function buildInlineReviewComments(
  options: InlineCommentBuildOptions,
): InlineCommentBuildResult {
  const maxComments = Math.max(0, Math.floor(options.maxComments));
  const strategy = options.strategy ?? "findings";
  const skippedByReason = createSkipCounter();
  const contextPaddingLines = Math.max(
    0,
    Math.floor(options.contextPaddingLines ?? DEFAULT_CONTEXT_PADDING_LINES),
  );

  if (maxComments === 0 || options.findings.length === 0) {
    return {
      comments: [],
      skippedCount: 0,
      skippedByReason,
    };
  }

  const hunkCache = new Map<string, StructuredDiffHunk[]>();
  const commentKeys = new Set<string>();
  const comments: InlineReviewComment[] = [];

  const candidates: InlineCommentCandidate[] = [];
  for (const finding of sortBySeverity(options.findings)) {
    const resolution = resolveInlineCommentCandidate({
      finding,
      files: options.files,
      hunkCache,
      contextPaddingLines,
    });

    if (resolution.reason) {
      skippedByReason[resolution.reason] += 1;
      continue;
    }

    if (resolution.candidate) {
      candidates.push(resolution.candidate);
    }
  }

  const tryAddComment = (candidate: InlineCommentCandidate): boolean => {
    if (commentKeys.has(candidate.dedupeKey)) {
      skippedByReason.duplicate += 1;
      return false;
    }

    commentKeys.add(candidate.dedupeKey);
    comments.push({
      path: candidate.path,
      line: candidate.line,
      startLine: candidate.startLine,
      endLine: candidate.endLine,
      body: candidate.body,
      severity: candidate.severity,
      title: candidate.title,
    });

    return true;
  };

  if (strategy === "file-coverage") {
    const selectedInCoveragePass = new Set<string>();
    const bestByFile = new Map<string, InlineCommentCandidate>();

    for (const candidate of candidates) {
      if (!bestByFile.has(candidate.path)) {
        bestByFile.set(candidate.path, candidate);
      }
    }

    for (const candidate of bestByFile.values()) {
      if (comments.length >= maxComments) {
        break;
      }

      if (tryAddComment(candidate)) {
        selectedInCoveragePass.add(candidate.dedupeKey);
      }
    }

    for (const candidate of candidates) {
      if (comments.length >= maxComments) {
        break;
      }

      if (selectedInCoveragePass.has(candidate.dedupeKey)) {
        continue;
      }

      tryAddComment(candidate);
    }
  } else {
    for (const candidate of candidates) {
      if (comments.length >= maxComments) {
        break;
      }

      tryAddComment(candidate);
    }
  }

  const skippedCount = Object.values(skippedByReason).reduce(
    (total, count) => total + count,
    0,
  );

  return {
    comments,
    skippedCount,
    skippedByReason,
  };
}
