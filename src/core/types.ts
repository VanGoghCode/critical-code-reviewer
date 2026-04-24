export type ArchitectureMode = "single" | "sequential" | "parallel";

export type ReviewSeverity = "low" | "medium" | "high";

export interface ReviewFileInput {
  path: string;
  name: string;
  content: string;
  status?:
    | "added"
    | "modified"
    | "deleted"
    | "renamed"
    | "copied"
    | "untracked";
  language?: string;
  patch?: string;
  previousPath?: string;
  hunks?: DiffHunk[];
}

export interface DiffHunk {
  id: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "context" | "add" | "del";
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export interface ReviewContext {
  repositoryName?: string;
  metadata?: string;
  baseRef?: string;
  headRef?: string;
  commitMessages?: string[];
}

export interface ReviewRequest {
  architectureId: string;
  files: ReviewFileInput[];
  context?: ReviewContext;
  promptOverrides?: Record<string, string>;
}

export interface PromptStageManifest {
  id: string;
  label: string;
  purpose: string;
  promptPath: string;
  personaPath?: string;
}

export interface PromptArchitectureManifest {
  id: string;
  label: string;
  description: string;
  mode: ArchitectureMode;
  stages: PromptStageManifest[];
  combineStage?: PromptStageManifest;
}

export interface LoadedPromptStage extends PromptStageManifest {
  promptText: string;
  personaText?: string;
}

export interface LoadedPromptArchitecture
  extends Omit<PromptArchitectureManifest, "stages" | "combineStage"> {
  stages: LoadedPromptStage[];
  combineStage?: LoadedPromptStage;
}

export interface ReviewFinding {
  severity: ReviewSeverity;
  title: string;
  detail: string;
  file?: string;
  recommendation?: string;
  suggestion?: string;
  /**
   * Legacy short identifier retained for backward compatibility in model output.
   * Inline comment placement now requires an exact codeBlock match.
   */
  anchorSnippet?: string;
  /**
   * A larger code block (3-12 lines) that the AI is commenting on.
   * This is the required way to locate inline comment lines in the diff.
   * The AI should copy the actual code from the diff, not make up code.
   * Include every identifier explicitly named in the finding detail.
   */
  codeBlock?: string;
  hunkId?: string;
}

export interface ReviewModelOutput {
  summary: string;
  riskLevel: ReviewSeverity;
  findings: ReviewFinding[];
  todos: string[];
  notes?: string[];
}

export interface ReviewReport {
  title: string;
  summary: string;
  riskLevel: ReviewSeverity;
  findings: ReviewFinding[];
  todos: string[];
  notes: string[];
  architectureId: string;
  architectureLabel: string;
  repositoryName?: string;
  fileCount: number;
  markdown: string;
  rawModelOutput?: string;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  details?: Record<string, unknown>;
}

export type LogSink = (entry: LogEntry) => void;

export interface ReviewLogger {
  log(entry: LogEntry): void;
  debug(message: string, details?: Record<string, unknown>): void;
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

export interface ReviewProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ReviewProviderRequest {
  architecture: LoadedPromptArchitecture;
  stage: PromptStageManifest | LoadedPromptStage;
  stageIndex: number;
  messages: ReviewProviderMessage[];
  request: ReviewRequest;
  previousOutputs: string[];
}

export interface ReviewTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ReviewProviderResult {
  output: string;
  usage?: Partial<ReviewTokenUsage>;
  estimatedCostUsd?: number;
}

export interface ReviewProvider {
  review(input: ReviewProviderRequest): Promise<string | ReviewProviderResult>;
}

export interface StageExecutionResult {
  stageId: string;
  label: string;
  output: string;
  prompt: string;
  durationMs: number;
  usage: ReviewTokenUsage;
  estimatedCostUsd: number;
}

export interface ReviewRunMetrics {
  durationMs: number;
  usage: ReviewTokenUsage;
  estimatedCostUsd: number;
}

export interface ReviewRunResult {
  report: ReviewReport;
  stageOutputs: StageExecutionResult[];
  metrics: ReviewRunMetrics;
}
