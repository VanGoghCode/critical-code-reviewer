import { parseReviewModelOutput, renderReviewMarkdown } from "./report.js";
import { readPromptText } from "./prompt-loader.js";
import type {
  LoadedPromptArchitecture,
  ReviewLogger,
  ReviewProvider,
  ReviewProviderMessage,
  ReviewProviderResult,
  ReviewRequest,
  ReviewRunResult,
  ReviewTokenUsage,
  StageExecutionResult,
} from "./types.js";

const PARALLEL_STAGE_LAUNCH_GAP_MS = 1000;
const DEFAULT_INPUT_COST_PER_1M_USD = Number(
  process.env.CCR_EST_INPUT_COST_PER_1M_USD ?? "5",
);
const DEFAULT_OUTPUT_COST_PER_1M_USD = Number(
  process.env.CCR_EST_OUTPUT_COST_PER_1M_USD ?? "15",
);

function waitForDelay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}\n... [truncated ${value.length - limit} characters]`;
}

function tryParseJson(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function buildRequestEnvelope(
  request: ReviewRequest,
  previousOutputs: string[],
  stageIndex: number,
  stageCount: number,
  maxContextChars: number,
): string {
  const fileBudget = Math.max(
    500,
    Math.floor(maxContextChars / Math.max(request.files.length * 2, 1)),
  );
  const previousOutputBudget = Math.max(500, Math.floor(maxContextChars / 4));
  const commitMessageBudget = Math.max(120, Math.floor(maxContextChars / 10));
  const reviewContext = request.context
    ? {
        ...request.context,
        metadata: request.context.metadata
          ? truncateText(request.context.metadata, previousOutputBudget)
          : undefined,
        commitMessages: request.context.commitMessages?.map((message) =>
          truncateText(message, commitMessageBudget),
        ),
      }
    : undefined;

  return JSON.stringify(
    {
      reviewContext,
      stageIndex,
      stageCount,
      architectureId: request.architectureId,
      files: request.files.map((file) => ({
        path: file.path,
        previousPath: file.previousPath,
        name: file.name,
        status: file.status,
        language: file.language,
        content: truncateText(file.content, fileBudget),
        patch: file.patch ? truncateText(file.patch, fileBudget) : undefined,
      })),
      previousOutputs: previousOutputs.map((output) =>
        truncateText(output, previousOutputBudget),
      ),
      previousOutputsParsed: previousOutputs.map((output) =>
        tryParseJson(output),
      ),
    },
    null,
    2,
  );
}

interface SharedLayers {
  persona: string;
  humanize: string;
  outputFormat: string;
}

async function loadSharedLayers(promptRoot: string): Promise<SharedLayers> {
  const [persona, humanize, outputFormat] = await Promise.all([
    readPromptText(promptRoot, "shared/persona.md"),
    readPromptText(promptRoot, "shared/humanize.md"),
    readPromptText(promptRoot, "shared/output-format.md"),
  ]);
  return { persona, humanize, outputFormat };
}

function createMessages(params: {
  architecture: LoadedPromptArchitecture;
  stageIndex: number;
  stageCount: number;
  stageLabel: string;
  stagePurpose: string;
  promptText: string;
  stagePersona?: string;
  request: ReviewRequest;
  previousOutputs: string[];
  mode: string;
  maxContextChars: number;
  sharedLayers: SharedLayers;
}): ReviewProviderMessage[] {
  const messages: ReviewProviderMessage[] = [];

  // Layer 1: Identity
  messages.push({
    role: "system",
    content: [
      "",
      `Architecture: ${params.architecture.label} (${params.architecture.id}).`,
      `Mode: ${params.mode}.`,
      `Current stage: ${params.stageLabel}.`,
      `Stage purpose: ${params.stagePurpose}.`,
    ].join("\n"),
  });

  // Layer 2: Persona (per-stage override or shared fallback)
  const persona = (params.stagePersona ?? params.sharedLayers.persona).trim();
  if (persona.length > 0) {
    messages.push({ role: "system", content: persona });
  }

  // Layer 3: Stage-specific instructions (editable)
  const promptText = params.promptText.trim();
  if (promptText.length > 0) {
    messages.push({ role: "system", content: promptText });
  }

  // Layer 4: Humanize
  const humanize = params.sharedLayers.humanize.trim();
  if (humanize.length > 0) {
    messages.push({ role: "system", content: humanize });
  }

  // User message: file envelope + Layer 5 (output format)
  const envelope = buildRequestEnvelope(
    params.request,
    params.previousOutputs,
    params.stageIndex,
    params.stageCount,
    params.maxContextChars,
  );
  const outputFormat = params.sharedLayers.outputFormat.trim();
  const userContent = outputFormat.length > 0
    ? `${envelope}\n\n${outputFormat}`
    : envelope;
  messages.push({ role: "user", content: userContent });

  return messages;
}

function estimateTokensFromText(value: string): number {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
}

function normalizeUsage(
  usage: Partial<ReviewTokenUsage> | undefined,
  messages: ReviewProviderMessage[],
  output: string,
): ReviewTokenUsage {
  const fallbackPromptTokens = estimateTokensFromText(
    messages.map((message) => message.content).join("\n\n"),
  );
  const fallbackCompletionTokens = estimateTokensFromText(output);

  const promptTokens =
    typeof usage?.promptTokens === "number" &&
    Number.isFinite(usage.promptTokens)
      ? Math.max(0, Math.round(usage.promptTokens))
      : fallbackPromptTokens;
  const completionTokens =
    typeof usage?.completionTokens === "number" &&
    Number.isFinite(usage.completionTokens)
      ? Math.max(0, Math.round(usage.completionTokens))
      : fallbackCompletionTokens;
  const totalTokens =
    typeof usage?.totalTokens === "number" && Number.isFinite(usage.totalTokens)
      ? Math.max(0, Math.round(usage.totalTokens))
      : promptTokens + completionTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function estimateCostUsd(usage: ReviewTokenUsage): number {
  const inputCost =
    (usage.promptTokens / 1_000_000) * DEFAULT_INPUT_COST_PER_1M_USD;
  const outputCost =
    (usage.completionTokens / 1_000_000) * DEFAULT_OUTPUT_COST_PER_1M_USD;
  return Number((inputCost + outputCost).toFixed(6));
}

function normalizeProviderResult(
  rawResult: string | ReviewProviderResult,
  messages: ReviewProviderMessage[],
): {
  output: string;
  usage: ReviewTokenUsage;
  estimatedCostUsd: number;
} {
  if (typeof rawResult === "string") {
    const usage = normalizeUsage(undefined, messages, rawResult);
    return {
      output: rawResult,
      usage,
      estimatedCostUsd: estimateCostUsd(usage),
    };
  }

  const output = rawResult.output;
  const usage = normalizeUsage(rawResult.usage, messages, output);
  return {
    output,
    usage,
    estimatedCostUsd:
      typeof rawResult.estimatedCostUsd === "number" &&
      Number.isFinite(rawResult.estimatedCostUsd)
        ? Number(rawResult.estimatedCostUsd.toFixed(6))
        : estimateCostUsd(usage),
  };
}

function aggregateRunMetrics(
  startedAtMs: number,
  stageOutputs: StageExecutionResult[],
) {
  const usage = stageOutputs.reduce<ReviewTokenUsage>(
    (current, stage) => ({
      promptTokens: current.promptTokens + stage.usage.promptTokens,
      completionTokens: current.completionTokens + stage.usage.completionTokens,
      totalTokens: current.totalTokens + stage.usage.totalTokens,
    }),
    {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
  );

  const estimatedCostUsd = Number(
    stageOutputs
      .reduce((current, stage) => current + stage.estimatedCostUsd, 0)
      .toFixed(6),
  );

  return {
    durationMs: Math.max(0, Date.now() - startedAtMs),
    usage,
    estimatedCostUsd,
  };
}

async function executeStage(params: {
  architecture: LoadedPromptArchitecture;
  stageIndex: number;
  stageCount: number;
  stage: LoadedPromptArchitecture["stages"][number];
  request: ReviewRequest;
  previousOutputs: string[];
  provider: ReviewProvider;
  logger: ReviewLogger;
  mode: string;
  maxContextChars: number;
  sharedLayers: SharedLayers;
}): Promise<StageExecutionResult> {
  const messages = createMessages({
    architecture: params.architecture,
    stageIndex: params.stageIndex,
    stageCount: params.stageCount,
    stageLabel: params.stage.label,
    stagePurpose: params.stage.purpose,
    promptText: params.stage.promptText,
    stagePersona: params.stage.personaText,
    request: params.request,
    previousOutputs: params.previousOutputs,
    mode: params.mode,
    maxContextChars: params.maxContextChars,
    sharedLayers: params.sharedLayers,
  });

  const loggableMessages = messages.map((message) => ({
    role: message.role,
    contentLength: message.content.length,
  }));

  params.logger.info("Executing review stage", {
    stageId: params.stage.id,
    stageLabel: params.stage.label,
    stageIndex: params.stageIndex,
    stageNumber: params.stageIndex + 1,
    stageCount: params.stageCount,
    stageStatus: "started",
    mode: params.mode,
    promptMessages: loggableMessages,
  });

  const stageStartedAtMs = Date.now();
  const rawResult = await params.provider.review({
    architecture: params.architecture,
    stage: params.stage,
    stageIndex: params.stageIndex,
    messages,
    request: params.request,
    previousOutputs: params.previousOutputs,
  });

  const normalized = normalizeProviderResult(rawResult, messages);
  const durationMs = Math.max(0, Date.now() - stageStartedAtMs);

  return {
    stageId: params.stage.id,
    label: params.stage.label,
    output: normalized.output,
    prompt: JSON.stringify(messages, null, 2),
    durationMs,
    usage: normalized.usage,
    estimatedCostUsd: normalized.estimatedCostUsd,
  };
}

export async function runReviewArchitecture(params: {
  architecture: LoadedPromptArchitecture;
  request: ReviewRequest;
  provider: ReviewProvider;
  logger: ReviewLogger;
  maxContextChars?: number;
  promptRoot?: string;
  sharedLayers?: SharedLayers;
}): Promise<ReviewRunResult> {
  const { architecture, request, provider, logger } = params;
  const runStartedAtMs = Date.now();
  const maxContextChars = params.maxContextChars ?? 12000;
  const sharedLayers = params.sharedLayers ?? await loadSharedLayers(params.promptRoot ?? "prompts");
  logger.info("Starting review run", {
    architectureId: architecture.id,
    mode: architecture.mode,
    fileCount: request.files.length,
  });

  const stageOutputs: StageExecutionResult[] = [];
  const stageCount =
    architecture.stages.length + (architecture.combineStage ? 1 : 0);

  if (architecture.mode === "single") {
    const finalStage = architecture.stages[0];
    const stageResult = await executeStage({
      architecture,
      stageIndex: 0,
      stageCount,
      stage: finalStage,
      request,
      previousOutputs: [],
      provider,
      logger,
      mode: architecture.mode,
      maxContextChars,
      sharedLayers,
    });
    stageOutputs.push(stageResult);

    const modelOutput = parseReviewModelOutput(stageResult.output);
    const report = renderReviewMarkdown({
      architecture,
      request,
      modelOutput,
      stageOutputs,
      rawOutput: stageResult.output,
      prompt: stageResult.prompt,
    });

    logger.info("Review run completed", {
      architectureId: architecture.id,
      findingCount: report.findings.length,
      riskLevel: report.riskLevel,
    });

    return {
      report,
      stageOutputs,
      metrics: aggregateRunMetrics(runStartedAtMs, stageOutputs),
    } satisfies ReviewRunResult;
  }

  if (architecture.mode === "sequential") {
    for (const [index, stage] of architecture.stages.entries()) {
      const result = await executeStage({
        architecture,
        stageIndex: index,
        stageCount,
        stage,
        request,
        previousOutputs: stageOutputs.map((s) => s.output),
        provider,
        logger,
        mode: architecture.mode,
        maxContextChars,
        sharedLayers,
      });
      stageOutputs.push(result);
    }

    // If a combine stage is defined, run it with all stage outputs.
    if (architecture.combineStage) {
      const combineResult = await executeStage({
        architecture,
        stageIndex: architecture.stages.length,
        stageCount,
        stage: architecture.combineStage,
        request,
        previousOutputs: stageOutputs.map((entry) => entry.output),
        provider,
        logger,
        mode: architecture.mode,
        maxContextChars,
        sharedLayers,
      });
      stageOutputs.push(combineResult);

      const modelOutput = parseReviewModelOutput(combineResult.output);
      const report = renderReviewMarkdown({
        architecture,
        request,
        modelOutput,
        stageOutputs,
        rawOutput: combineResult.output,
        prompt: combineResult.prompt,
      });

      logger.info("Review run completed", {
        architectureId: architecture.id,
        findingCount: report.findings.length,
        riskLevel: report.riskLevel,
      });

      return {
        report,
        stageOutputs,
        metrics: aggregateRunMetrics(runStartedAtMs, stageOutputs),
      } satisfies ReviewRunResult;
    }

    const finalStageResult = stageOutputs.at(-1);
    if (!finalStageResult) {
      throw new Error(
        `Sequential architecture ${architecture.id} did not produce any stage output.`,
      );
    }

    const modelOutput = parseReviewModelOutput(finalStageResult.output);
    const report = renderReviewMarkdown({
      architecture,
      request,
      modelOutput,
      stageOutputs,
      rawOutput: finalStageResult.output,
      prompt: finalStageResult.prompt,
    });

    logger.info("Review run completed", {
      architectureId: architecture.id,
      findingCount: report.findings.length,
      riskLevel: report.riskLevel,
    });

    return {
      report,
      stageOutputs,
      metrics: aggregateRunMetrics(runStartedAtMs, stageOutputs),
    } satisfies ReviewRunResult;
  }

  const parallelStageOutputs = await Promise.all(
    architecture.stages.map(async (stage, index) => {
      const launchDelayMs = index * PARALLEL_STAGE_LAUNCH_GAP_MS;

      if (launchDelayMs > 0) {
        logger.info("Waiting before launching parallel stage", {
          stageId: stage.id,
          stageLabel: stage.label,
          stageIndex: index,
          stageNumber: index + 1,
          launchDelayMs,
        });
        await waitForDelay(launchDelayMs);
      }

      return executeStage({
        architecture,
        stageIndex: index,
        stageCount,
        stage,
        request,
        previousOutputs: [],
        provider,
        logger,
        mode: architecture.mode,
        maxContextChars,
        sharedLayers,
      });
    }),
  );
  stageOutputs.push(...parallelStageOutputs);

  const combineStage = architecture.combineStage;
  if (!combineStage) {
    throw new Error(
      `Parallel architecture requires a combine stage.`,
    );
  }

  const combineResult = await executeStage({
    architecture,
    stageIndex: architecture.stages.length,
    stageCount,
    stage: combineStage,
    request,
    previousOutputs: parallelStageOutputs.map((entry) => entry.output),
    provider,
    logger,
    mode: architecture.mode,
    maxContextChars,
    sharedLayers,
  });
  stageOutputs.push(combineResult);

  const modelOutput = parseReviewModelOutput(combineResult.output);
  const report = renderReviewMarkdown({
    architecture,
    request,
    modelOutput,
    stageOutputs,
    rawOutput: combineResult.output,
    prompt: combineResult.prompt,
  });

  logger.info("Review run completed", {
    architectureId: architecture.id,
    findingCount: report.findings.length,
    riskLevel: report.riskLevel,
  });

  return {
    report,
    stageOutputs,
    metrics: aggregateRunMetrics(runStartedAtMs, stageOutputs),
  } satisfies ReviewRunResult;
}
