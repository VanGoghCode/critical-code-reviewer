import {
  parseStructuredDiffHunks,
  resolveAnchorToGitHubLocation,
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

const SKIP_REASON_KEYS = [
  "missing-file",
  "unmatched-file",
  "no-changed-lines",
  "unresolved-line",
  "duplicate",
] as const;

export type InlineCommentSkipReason = (typeof SKIP_REASON_KEYS)[number];

export interface InlineReviewComment {
  path: string;
  line: number;
  body: string;
  severity: ReviewSeverity;
  title: string;
}

export interface InlineCommentBuildOptions {
  findings: ReviewFinding[];
  files: ReviewFileInput[];
  maxComments: number;
  allowFallbackToFirstChangedLine?: boolean;
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
    "unresolved-line": 0,
    duplicate: 0,
  };
}

function normalizePath(pathValue: string): string {
  return pathValue.replaceAll("\\", "/").trim().toLowerCase();
}

function formatInlineCommentBody(
  finding: ReviewFinding,
  line?: number,
): string {
  // Keep inline comments in a predictable structure:
  // 1) line notation, 2) criterion name, 3) issue + impact detail, 4) small suggestion.
  const recommendation = finding.recommendation ?? finding.suggestion;

  const parts: string[] = [];

  // Add line notation if we have line information
  if (typeof line === "number") {
    parts.push(`_Comment on line ${line}_\n`);
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
  allowFallbackToFirstChangedLine: boolean;
}): CandidateResolution {
  const { finding, files, hunkCache, allowFallbackToFirstChangedLine } = params;

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

  // Use anchor snippet to resolve exact location
  const anchorSnippet = finding.anchorSnippet || finding.detail;
  
  if (!anchorSnippet || anchorSnippet.trim().length === 0) {
    return { reason: "unresolved-line" };
  }

  const anchorResult = resolveAnchorToGitHubLocation({
    anchorSnippet,
    hunkId: finding.hunkId,
    hunks,
    allowFallback: allowFallbackToFirstChangedLine,
  });

  if (!anchorResult) {
    if (allowFallbackToFirstChangedLine) {
      // Fallback to first changed line in first hunk
      const firstHunk = hunks[0];
      const firstChanged = firstHunk.lines.find((l) => l.type === "add");
      
      if (firstChanged?.newLine) {
        const dedupeKey = `${fileRecord.path}:${firstChanged.newLine}:${finding.title
          .trim()
          .toLowerCase()}`;

        return {
          candidate: {
            path: fileRecord.path,
            line: firstChanged.newLine,
            body: formatInlineCommentBody(finding, firstChanged.newLine),
            severity: finding.severity,
            title: finding.title,
            dedupeKey,
          },
        };
      }
    }
    
    return { reason: "unresolved-line" };
  }

  const dedupeKey = `${fileRecord.path}:${anchorResult.line}:${finding.title
    .trim()
    .toLowerCase()}`;

  return {
    candidate: {
      path: fileRecord.path,
      line: anchorResult.line,
      body: formatInlineCommentBody(finding, anchorResult.line),
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

  const allowFallbackToFirstChangedLine =
    options.allowFallbackToFirstChangedLine ?? false;

  const candidates: InlineCommentCandidate[] = [];
  for (const finding of sortBySeverity(options.findings)) {
    const resolution = resolveInlineCommentCandidate({
      finding,
      files: options.files,
      hunkCache,
      allowFallbackToFirstChangedLine,
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