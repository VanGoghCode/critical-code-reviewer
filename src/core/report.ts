import { z } from "zod";
import type {
  LoadedPromptArchitecture,
  ReviewFinding,
  ReviewModelOutput,
  ReviewReport,
  ReviewRequest,
  ReviewSeverity,
  StageExecutionResult,
} from "./types.js";

const REVIEW_SEVERITY_PRIORITY: Record<ReviewSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const STAKEHOLDER_CANDIDATES = [
  "Black student",
  "English-learner student",
  "first-generation student",
  "student",
  "teacher",
  "parent",
  "counselor",
  "instructor",
  "administrator",
  "caregiver",
] as const;

const findingSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  file: z.string().optional(),
  recommendation: z.string().optional(),
  suggestion: z.string().optional(),
  anchorSnippet: z.string().optional(),
  hunkId: z.string().optional(),
  line: z.number().int().positive().optional(),
});

const modelOutputSchema = z.object({
  summary: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]),
  findings: z.array(findingSchema),
  todos: z.array(z.string().min(1)),
  notes: z.array(z.string().min(1)).optional(),
});

function markdownEscape(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function extractJsonCandidate(text: string): string {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  // Try to find a JSON object containing "findings" — handles cases where
  // the LLM wraps JSON in explanatory prose or prefixes it with text.
  // Use "findings" as a beacon, then walk outward to the nearest enclosing
  // balanced braces to get the full JSON object.
  const findingsPos = text.indexOf('"findings"');
  if (findingsPos >= 0) {
    const searchStart = Math.max(0, findingsPos - 500);
    const firstBrace = text.indexOf("{", searchStart);
    if (firstBrace >= 0 && firstBrace <= findingsPos) {
      let depth = 0;
      for (let i = firstBrace; i < text.length; i += 1) {
        if (text[i] === "{") {
          depth += 1;
        } else if (text[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            return text.slice(firstBrace, i + 1).trim();
          }
        }
      }
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

export function parseReviewModelOutput(rawOutput: string): ReviewModelOutput {
  const candidate = extractJsonCandidate(rawOutput);
  try {
    return modelOutputSchema.parse(JSON.parse(candidate));
  } catch {
    return {
      summary:
        "The model response was not valid JSON, so the raw output is preserved in the report.",
      riskLevel: "medium",
      findings: [],
      todos: [
        "Review the raw model response and replace the prompt scaffolding with a stricter instruction set.",
      ],
      notes: [rawOutput.trim() || "The model response was empty."],
    } satisfies ReviewModelOutput;
  }
}

function formatFindings(findings: ReviewFinding[]): string {
  if (findings.length === 0) {
    return "No findings were returned by the review model.";
  }

  return findings
    .map((finding) => {
      const location = finding.file ? ` (${finding.file})` : "";
      const recommendation = finding.recommendation ?? finding.suggestion;
      const recommendationLine = recommendation
        ? `\n  Recommendation: ${recommendation}`
        : "";
      return `- [${finding.severity.toUpperCase()}] ${finding.title}${location}\n  ${finding.detail}${recommendationLine}`;
    })
    .join("\n");
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return "- None";
  }

  return values.map((value) => `- ${value}`).join("\n");
}

function withArticle(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("a ") || normalized.startsWith("an ")) {
    return value.trim();
  }

  const article = /^[aeiou]/i.test(value.trim()) ? "an" : "a";
  return `${article} ${value.trim()}`;
}

function inferStakeholder(text: string): string {
  const normalized = text.toLowerCase();
  for (const candidate of STAKEHOLDER_CANDIDATES) {
    if (normalized.includes(candidate.toLowerCase())) {
      return withArticle(candidate);
    }
  }

  return "a student, a teacher, or a parent";
}

function createAssumptionQuestion(finding: ReviewFinding): string {
  const recommendation = finding.recommendation ?? finding.suggestion ?? "";
  const stakeholder = inferStakeholder(`${finding.detail} ${recommendation}`);
  return `When implementing this, have you thought about how this behavior could disadvantage ${stakeholder}?`;
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values.map((entry) => entry.trim()).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(value);
  }

  return unique;
}

function sortFindingsBySeverity(findings: ReviewFinding[]): ReviewFinding[] {
  return [...findings].sort((left, right) => {
    const severityDelta =
      REVIEW_SEVERITY_PRIORITY[right.severity] -
      REVIEW_SEVERITY_PRIORITY[left.severity];

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

export function buildReviewConversationBody(
  report: Pick<ReviewReport, "summary" | "findings" | "notes">,
): string {
  const lines: string[] = [report.summary.trim()];
  const highLevelFindings = sortFindingsBySeverity(report.findings).slice(0, 3);

  for (const finding of highLevelFindings) {
    const recommendation = finding.recommendation ?? finding.suggestion;
    lines.push("", finding.title.trim(), finding.detail.trim());
    if (recommendation && recommendation.trim().length > 0) {
      lines.push(recommendation.trim());
    }
  }

  const noteQuestions = report.notes
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes("?"));

  const generatedQuestions = highLevelFindings
    .slice(0, 2)
    .map((finding) => createAssumptionQuestion(finding));

  const fallbackQuestions =
    highLevelFindings.length > 0
      ? [
          ...generatedQuestions,
          "Have you thought about what evidence a teacher and a student would need to contest this decision if the model is wrong?",
        ]
      : [];

  const questions = uniqueNonEmpty([
    ...noteQuestions,
    ...fallbackQuestions,
  ]).slice(0, 3);

  for (const question of questions) {
    lines.push("", question);
  }

  return lines
    .filter((line, index, values) => {
      if (line.length > 0) {
        return true;
      }

      const previous = values[index - 1];
      return previous !== "";
    })
    .join("\n");
}

export function renderReviewMarkdown(params: {
  architecture: LoadedPromptArchitecture;
  request: ReviewRequest;
  modelOutput: ReviewModelOutput;
  stageOutputs: StageExecutionResult[];
  rawOutput: string;
  prompt: string;
}): ReviewReport {
  const {
    architecture,
    request,
    modelOutput,
    stageOutputs,
    rawOutput,
    prompt,
  } = params;
  const title = `CCR Review for ${architecture.label}`;
  const contextLines = [
    `- Architecture: ${architecture.label} (${architecture.id})`,
    `- Mode: ${architecture.mode}`,
    `- Files reviewed: ${request.files.length}`,
    request.context?.repositoryName
      ? `- Repository: ${request.context.repositoryName}`
      : undefined,
    request.context?.baseRef
      ? `- Base ref: ${request.context.baseRef}`
      : undefined,
    request.context?.headRef
      ? `- Head ref: ${request.context.headRef}`
      : undefined,
    request.context?.commitMessages?.length
      ? `- Commits in range: ${request.context.commitMessages.length}`
      : undefined,
  ].filter((line): line is string => Boolean(line));

  const commitMessages = request.context?.commitMessages ?? [];
  const commitMessageList =
    commitMessages.length > 0
      ? commitMessages
          .map((message) => `- ${markdownEscape(message)}`)
          .join("\n")
      : "- None";

  const fileInventory = request.files
    .map((file) => {
      const label = file.status ? `${file.status} · ${file.path}` : file.path;
      return `- ${markdownEscape(label)}${file.previousPath ? ` (from ${markdownEscape(file.previousPath)})` : ""}`;
    })
    .join("\n");

  const stageTrail = stageOutputs
    .map(
      (stage) =>
        `- ${stage.label} (${stage.stageId}): ${stage.output.length} characters`,
    )
    .join("\n");

  const notes = modelOutput.notes ?? [];
  const markdown = [
    "# CCR Review Report",
    "",
    `## ${title}`,
    "",
    "### Summary",
    modelOutput.summary,
    "",
    "### Risk",
    modelOutput.riskLevel,
    "",
    "### Findings",
    formatFindings(modelOutput.findings),
    "",
    "### Follow-up TODOs",
    formatList(modelOutput.todos),
    "",
    "### Review Context",
    ...contextLines,
    "",
    "### Commit Messages",
    commitMessageList,
    "",
    "### Files in Scope",
    fileInventory || "- None",
    "",
    "### Stage Trail",
    stageTrail || "- No intermediate stage output recorded.",
    "",
    "### Notes",
    formatList(notes),
    "",
    "### Raw Output",
    "```json",
    rawOutput.trim(),
    "```",
  ].join("\n");

  return {
    title,
    summary: modelOutput.summary,
    riskLevel: modelOutput.riskLevel,
    findings: modelOutput.findings,
    todos: modelOutput.todos,
    notes,
    architectureId: architecture.id,
    architectureLabel: architecture.label,
    repositoryName: request.context?.repositoryName,
    fileCount: request.files.length,
    markdown,
    rawModelOutput: rawOutput,
  } satisfies ReviewReport;
}

export function toReviewModelOutput(report: ReviewReport): ReviewModelOutput {
  return {
    summary: report.summary,
    riskLevel: report.riskLevel,
    findings: report.findings,
    todos: report.todos,
    notes: report.notes.length > 0 ? report.notes : undefined,
  };
}
