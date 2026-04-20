const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export interface DiffLine {
  type: "context" | "add" | "del";
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export interface StructuredDiffHunk {
  id: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  header: string;
  lines: DiffLine[];
}

export interface ParsedPatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  changedLines: number[];
  changedLineContents: Array<{
    line: number;
    content: string;
  }>;
  contextLines: number[];
  contextLineContents: Array<{
    line: number;
    content: string;
  }>;
}

export interface ParsedPatchMap {
  hunks: ParsedPatchHunk[];
  changedLines: number[];
  changedLineContentByLine: Map<number, string>;
  allVisibleLines: number[];
  allVisibleLineContentByLine: Map<number, string>;
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function normalizeSearchText(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

function extractSearchCandidates(value: string): string[] {
  const raw = value.trim();
  if (raw.length === 0) {
    return [];
  }

  const fromNewlines = raw
    .split(/\r?\n+/)
    .map((entry) => normalizeSearchText(entry))
    .filter((entry) => entry.length >= 8);
  if (fromNewlines.length > 0) {
    return fromNewlines.slice(0, 4);
  }

  const fromPunctuation = raw
    .split(/[.;:!?]+/)
    .map((entry) => normalizeSearchText(entry))
    .filter((entry) => entry.length >= 8);
  if (fromPunctuation.length > 0) {
    return fromPunctuation.slice(0, 4);
  }

  return [normalizeSearchText(raw)];
}

function tokenize(value: string): string[] {
  return normalizeSearchText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function tokenOverlapScore(
  candidate: string,
  line: string,
): {
  score: number;
  overlaps: number;
} {
  const candidateTokens = tokenize(candidate);
  if (candidateTokens.length === 0) {
    return {
      score: 0,
      overlaps: 0,
    };
  }

  const lineTokens = new Set(tokenize(line));
  let overlaps = 0;
  for (const token of candidateTokens) {
    if (lineTokens.has(token)) {
      overlaps += 1;
    }
  }

  return {
    score: overlaps / candidateTokens.length,
    overlaps,
  };
}

function closestLine(target: number, lines: number[]): number | undefined {
  if (lines.length === 0) {
    return undefined;
  }

  let best = lines[0];
  let bestDistance = Math.abs(best - target);

  for (const line of lines.slice(1)) {
    const distance = Math.abs(line - target);
    if (distance < bestDistance) {
      best = line;
      bestDistance = distance;
    }
  }

  return best;
}

export function parseUnifiedDiffPatch(patch: string): ParsedPatchMap {
  if (patch.trim().length === 0) {
    return {
      hunks: [],
      changedLines: [],
      changedLineContentByLine: new Map<number, string>(),
      allVisibleLines: [],
      allVisibleLineContentByLine: new Map<number, string>(),
    };
  }

  const lines = patch.split(/\r?\n/);
  const hunks: ParsedPatchHunk[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index];
    const match = header.match(HUNK_HEADER_PATTERN);
    if (!match) {
      continue;
    }

    const hunk: ParsedPatchHunk = {
      oldStart: toPositiveInt(match[1], 0),
      oldCount: toPositiveInt(match[2], 1),
      newStart: toPositiveInt(match[3], 0),
      newCount: toPositiveInt(match[4], 1),
      changedLines: [],
      changedLineContents: [],
      contextLines: [],
      contextLineContents: [],
    };

    let currentLine = hunk.newStart;

    for (index += 1; index < lines.length; index += 1) {
      const rawLine = lines[index];
      if (rawLine.startsWith("@@ ")) {
        index -= 1;
        break;
      }

      if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
        const content = rawLine.slice(1);
        hunk.changedLines.push(currentLine);
        hunk.changedLineContents.push({
          line: currentLine,
          content,
        });
        currentLine += 1;
        continue;
      }

      if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
        continue;
      }

      if (rawLine.startsWith(" ")) {
        const content = rawLine.slice(1);
        hunk.contextLines.push(currentLine);
        hunk.contextLineContents.push({
          line: currentLine,
          content,
        });
        currentLine += 1;
      }
    }

    hunks.push(hunk);
  }

  const changedLineContentByLine = new Map<number, string>();
  const allVisibleLineContentByLine = new Map<number, string>();
  for (const hunk of hunks) {
    for (const entry of hunk.changedLineContents) {
      changedLineContentByLine.set(entry.line, entry.content);
      allVisibleLineContentByLine.set(entry.line, entry.content);
    }
    for (const entry of hunk.contextLineContents) {
      allVisibleLineContentByLine.set(entry.line, entry.content);
    }
  }

  const allVisibleLines = Array.from(allVisibleLineContentByLine.keys()).sort(
    (left, right) => left - right,
  );

  return {
    hunks,
    changedLines: Array.from(changedLineContentByLine.keys()).sort(
      (left, right) => left - right,
    ),
    changedLineContentByLine,
    allVisibleLines,
    allVisibleLineContentByLine,
  };
}

interface FuzzySearchResult {
  exactMatchLines: Set<number>;
  bestLine: number | undefined;
  bestScore: number;
  bestOverlap: number;
}

function runFuzzySearch(
  candidates: string[],
  lineMap: Map<number, string>,
  roundedRequestedLine: number | undefined,
): FuzzySearchResult {
  const exactMatchLines = new Set<number>();
  let bestLine: number | undefined;
  let bestScore = 0;
  let bestOverlap = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    for (const [line, content] of lineMap.entries()) {
      const normalizedLine = normalizeSearchText(content);

      if (
        normalizedLine.includes(candidate) ||
        (candidate.length >= 12 && candidate.includes(normalizedLine))
      ) {
        exactMatchLines.add(line);
        continue;
      }

      const overlap = tokenOverlapScore(candidate, normalizedLine);
      const distance =
        typeof roundedRequestedLine === "number"
          ? Math.abs(line - roundedRequestedLine)
          : Number.POSITIVE_INFINITY;

      // Fix 1: distance is a real secondary sort key, not just a last-resort
      // tiebreaker. Two candidates with equivalent token scores now resolve
      // to whichever line is closest to the AI-requested line number.
      const isBetter =
        overlap.overlaps > bestOverlap ||
        (overlap.overlaps === bestOverlap && overlap.score > bestScore) ||
        (overlap.overlaps === bestOverlap &&
          overlap.score === bestScore &&
          distance < bestDistance);

      const isEquivalentButCloser =
        overlap.overlaps === bestOverlap &&
        Math.abs(overlap.score - bestScore) < 0.05 &&
        distance < bestDistance;

      if (isBetter || isEquivalentButCloser) {
        bestLine = line;
        bestScore = overlap.score;
        bestOverlap = overlap.overlaps;
        bestDistance = distance;
      }
    }
  }

  return { exactMatchLines, bestLine, bestScore, bestOverlap };
}

export function resolveChangedLine(params: {
  patchMap: ParsedPatchMap;
  requestedLine?: number;
  searchText?: string;
  allowFallbackToFirstChangedLine?: boolean;
}): number | undefined {
  const {
    patchMap,
    requestedLine,
    searchText,
    allowFallbackToFirstChangedLine = true,
  } = params;

  if (patchMap.allVisibleLines.length === 0) {
    return undefined;
  }

  const allVisibleLineSet = new Set<number>(patchMap.allVisibleLines);
  let roundedRequestedLine: number | undefined;
  let closestRequestedLine: number | undefined;
  let closestRequestedDistance = Number.POSITIVE_INFINITY;

  if (typeof requestedLine === "number" && Number.isFinite(requestedLine)) {
    roundedRequestedLine = Math.round(requestedLine);
    const closest = closestLine(roundedRequestedLine, patchMap.allVisibleLines);
    if (typeof closest === "number") {
      closestRequestedLine = closest;
      closestRequestedDistance = Math.abs(closest - roundedRequestedLine);
    }
  }

  if (searchText && searchText.trim().length > 0) {
    const candidates = extractSearchCandidates(searchText);
    let result = runFuzzySearch(
      candidates,
      patchMap.changedLineContentByLine,
      roundedRequestedLine,
    );

    // Fall back to all visible lines only when the changed-lines pass found
    // nothing useful (no exact matches and not enough token overlap).
    if (
      result.exactMatchLines.size === 0 &&
      (!result.bestLine || result.bestOverlap < 3)
    ) {
      result = runFuzzySearch(
        candidates,
        patchMap.allVisibleLineContentByLine,
        roundedRequestedLine,
      );
    }

    const { exactMatchLines, bestLine, bestScore, bestOverlap } = result;

    if (exactMatchLines.size > 0) {
      const sortedExactMatches = Array.from(exactMatchLines).sort(
        (left, right) => left - right,
      );

      if (typeof roundedRequestedLine === "number") {
        return (
          closestLine(roundedRequestedLine, sortedExactMatches) ??
          sortedExactMatches[0]
        );
      }

      return sortedExactMatches[0];
    }

    if (bestLine && bestOverlap >= 3 && bestScore >= 0.35) {
      return bestLine;
    }
  }

  if (
    typeof roundedRequestedLine === "number" &&
    allVisibleLineSet.has(roundedRequestedLine)
  ) {
    return roundedRequestedLine;
  }

  // Allow minor off-by-one/two drift from the model, but avoid long-distance remaps.
  if (closestRequestedLine && closestRequestedDistance <= 2) {
    return closestRequestedLine;
  }

  if (!allowFallbackToFirstChangedLine) {
    return undefined;
  }

  return (
    closestRequestedLine ??
    patchMap.changedLines[0] ??
    patchMap.allVisibleLines[0]
  );
}

export function parseStructuredDiffHunks(patch: string): StructuredDiffHunk[] {
  if (patch.trim().length === 0) {
    return [];
  }

  const lines = patch.split(/\r?\n/);
  const hunks: StructuredDiffHunk[] = [];
  let hunkCounter = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index];
    const match = header.match(HUNK_HEADER_PATTERN);
    if (!match) {
      continue;
    }

    hunkCounter += 1;
    const hunk: StructuredDiffHunk = {
      id: `hunk_${hunkCounter}`,
      oldStart: toPositiveInt(match[1], 0),
      oldCount: toPositiveInt(match[2], 1),
      newStart: toPositiveInt(match[3], 0),
      newCount: toPositiveInt(match[4], 1),
      header,
      lines: [],
    };

    let currentOldLine = hunk.oldStart;
    let currentNewLine = hunk.newStart;

    for (index += 1; index < lines.length; index += 1) {
      const rawLine = lines[index];
      
      if (rawLine.startsWith("@@ ")) {
        index -= 1;
        break;
      }

      if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
        const text = rawLine.slice(1);
        hunk.lines.push({
          type: "add",
          oldLine: null,
          newLine: currentNewLine,
          text,
        });
        currentNewLine += 1;
        continue;
      }

      if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
        const text = rawLine.slice(1);
        hunk.lines.push({
          type: "del",
          oldLine: currentOldLine,
          newLine: null,
          text,
        });
        currentOldLine += 1;
        continue;
      }

      if (rawLine.startsWith(" ")) {
        const text = rawLine.slice(1);
        hunk.lines.push({
          type: "context",
          oldLine: currentOldLine,
          newLine: currentNewLine,
          text,
        });
        currentOldLine += 1;
        currentNewLine += 1;
      }
    }

    hunks.push(hunk);
  }

  return hunks;
}

export interface AnchorResolutionResult {
  line: number;
  confidence: "exact" | "fuzzy" | "fallback";
}

export function resolveAnchorToGitHubLocation(params: {
  anchorSnippet: string;
  hunkId?: string;
  hunks: StructuredDiffHunk[];
  allowFallback?: boolean;
}): AnchorResolutionResult | undefined {
  const { anchorSnippet, hunkId, hunks, allowFallback = false } = params;

  if (!anchorSnippet || anchorSnippet.trim().length === 0) {
    return undefined;
  }

  const normalizedAnchor = normalizeSearchText(anchorSnippet);
  const targetHunks = hunkId
    ? hunks.filter((h) => h.id === hunkId)
    : hunks;

  if (targetHunks.length === 0) {
    return undefined;
  }

  // Priority 1: Exact match in changed lines
  for (const hunk of targetHunks) {
    const changedLines = hunk.lines.filter((l) => l.type === "add");
    
    for (const line of changedLines) {
      const normalizedLine = normalizeSearchText(line.text);
      
      if (
        normalizedLine.includes(normalizedAnchor) ||
        (normalizedAnchor.length >= 12 && normalizedAnchor.includes(normalizedLine))
      ) {
        return {
          line: line.newLine!,
          confidence: "exact",
        };
      }
    }
  }

  // Priority 2: Fuzzy match with token overlap in changed lines
  let bestMatch: { line: number; score: number } | undefined;

  for (const hunk of targetHunks) {
    const changedLines = hunk.lines.filter((l) => l.type === "add");
    
    for (const line of changedLines) {
      const overlap = tokenOverlapScore(normalizedAnchor, line.text);

      if (overlap.overlaps >= 3 && overlap.score >= 0.35) {
        if (!bestMatch || overlap.overlaps > bestMatch.score) {
          bestMatch = {
            line: line.newLine!,
            score: overlap.overlaps,
          };
        }
      }
    }
  }

  if (bestMatch) {
    return {
      line: bestMatch.line,
      confidence: "fuzzy",
    };
  }

  // Priority 3: Fallback to first changed line in target hunk (only if allowed)
  if (allowFallback) {
    for (const hunk of targetHunks) {
      const firstChanged = hunk.lines.find((l) => l.type === "add");
      if (firstChanged?.newLine) {
        return {
          line: firstChanged.newLine,
          confidence: "fallback",
        };
      }
    }
  }

  return undefined;
}
