import {
  type PromptDraftMap,
  createPromptDraftMap,
  getMissingPromptLabels,
  isPromptDraftMapComplete,
} from "../../src/core/prompt-config";
import type {
  LoadedPromptArchitecture,
  LogEntry,
  ReviewFileInput,
  ReviewRunMetrics,
  ReviewRequest,
} from "../../src/core/types";

export interface SandboxFileDraft {
  id: string;
  fileName: string;
  filePath: string;
  sampleCode: string;
}

export interface SandboxLogItem extends LogEntry {
  id: string;
}

export interface PromptDraftsByArchitecture {
  [architectureId: string]: PromptDraftMap;
}

export type PromptSourceMode = "default" | "custom";

export interface PromptSourcesByArchitecture {
  [architectureId: string]: PromptSourceMode;
}

const PROMPT_SOURCE_STORAGE_KEY = "ccr-sandbox-prompt-source-by-architecture";

function normalizePromptSourceMode(value: unknown): PromptSourceMode {
  return value === "custom" ? "custom" : "default";
}

function readPromptSourcesByArchitecture(): PromptSourcesByArchitecture {
  const rawValue = globalThis.localStorage?.getItem(PROMPT_SOURCE_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([architectureId, source]) => [
        architectureId,
        normalizePromptSourceMode(source),
      ]),
    );
  } catch {
    return {};
  }
}

function persistPromptSourcesByArchitecture(
  sources: PromptSourcesByArchitecture,
): void {
  globalThis.localStorage?.setItem(
    PROMPT_SOURCE_STORAGE_KEY,
    JSON.stringify(sources),
  );
}

export interface SandboxState {
  architectures: LoadedPromptArchitecture[];
  selectedArchitectureId: string;
  fileDrafts: SandboxFileDraft[];
  metadata: string;
  promptDraftsByArchitecture: PromptDraftsByArchitecture;
  promptSourceByArchitecture: PromptSourcesByArchitecture;
  outputMarkdown: string;
  rawModelOutput: string;
  sentPrompt: string;
  runMetrics?: ReviewRunMetrics;
  logs: SandboxLogItem[];
  runStatus: "idle" | "running" | "completed" | "failed";
  runId?: string;
  errorMessage?: string;
}

type SandboxAction =
  | { type: "set-architectures"; architectures: LoadedPromptArchitecture[] }
  | { type: "select-architecture"; architectureId: string }
  | { type: "add-file" }
  | { type: "replace-file-drafts"; fileDrafts: SandboxFileDraft[] }
  | { type: "remove-file"; fileId: string }
  | {
      type: "update-file";
      fileId: string;
      field: keyof Omit<SandboxFileDraft, "id">;
      value: string;
    }
  | { type: "set-metadata"; metadata: string }
  | {
      type: "update-prompt";
      architectureId: string;
      promptId: string;
      value: string;
    }
  | {
      type: "merge-prompt-drafts";
      architectureId: string;
      promptDrafts: PromptDraftMap;
    }
  | {
      type: "set-prompt-source";
      architectureId: string;
      source: PromptSourceMode;
    }
  | { type: "append-log"; entry: LogEntry }
  | { type: "set-prompt-sent"; prompt: string }
  | { type: "set-run-metrics"; metrics?: ReviewRunMetrics }
  | { type: "clear-run" }
  | { type: "set-output"; markdown: string; rawModelOutput?: string }
  | {
      type: "set-run-status";
      status: SandboxState["runStatus"];
      runId?: string;
      errorMessage?: string;
    };

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `id_${Math.random().toString(36).slice(2)}`;
}

export function createEmptyFileDraft(index = 1): SandboxFileDraft {
  return {
    id: createId(),
    fileName: `sample-${index}.ts`,
    filePath: `src/sample-${index}.ts`,
    sampleCode: "export function placeholder(): void {\n  return;\n}\n",
  };
}

export async function createImportedFileDrafts(
  files: FileList | File[],
): Promise<SandboxFileDraft[]> {
  const uploadedFiles = Array.from(files);
  const importedDrafts = await Promise.all(
    uploadedFiles.map(async (file, index) => {
      const fileName = file.name.trim() || `uploaded-${index + 1}`;
      const relativePath = file.webkitRelativePath
        ?.trim()
        .replaceAll("\\", "/");
      const filePath = relativePath || fileName;

      return {
        id: createId(),
        fileName,
        filePath,
        sampleCode: await file.text(),
      } satisfies SandboxFileDraft;
    }),
  );

  return normalizeFileDrafts(importedDrafts);
}

function createPromptDraftsForArchitectures(
  architectures: LoadedPromptArchitecture[],
  existingDrafts: PromptDraftsByArchitecture,
): PromptDraftsByArchitecture {
  const nextDrafts: PromptDraftsByArchitecture = {
    ...existingDrafts,
  };

  for (const architecture of architectures) {
    const seededDrafts = createPromptDraftMap(architecture);
    nextDrafts[architecture.id] = {
      ...seededDrafts,
      ...(nextDrafts[architecture.id] ?? {}),
    };
  }

  return nextDrafts;
}

function createPromptSourcesForArchitectures(
  architectures: LoadedPromptArchitecture[],
  existingSources: PromptSourcesByArchitecture,
): PromptSourcesByArchitecture {
  return Object.fromEntries(
    architectures.map((architecture) => [
      architecture.id,
      normalizePromptSourceMode(existingSources[architecture.id]),
    ]),
  );
}

export function createInitialSandboxState(): SandboxState {
  return {
    architectures: [],
    selectedArchitectureId:
      globalThis.localStorage?.getItem("ccr-sandbox-architecture") ?? "",
    fileDrafts: [],
    metadata: globalThis.localStorage?.getItem("ccr-sandbox-metadata") ?? "",
    promptDraftsByArchitecture: {},
    promptSourceByArchitecture: readPromptSourcesByArchitecture(),
    outputMarkdown: "",
    rawModelOutput: "",
    sentPrompt: "",
    runMetrics: undefined,
    logs: [],
    runStatus: "idle",
  };
}

function createLogItem(entry: LogEntry): SandboxLogItem {
  return {
    ...entry,
    id: createId(),
  };
}

function ensureSelectedArchitecture(state: SandboxState): string {
  if (
    state.selectedArchitectureId &&
    state.architectures.some(
      (architecture) => architecture.id === state.selectedArchitectureId,
    )
  ) {
    return state.selectedArchitectureId;
  }

  return state.architectures[0]?.id ?? state.selectedArchitectureId;
}

function normalizeFileDrafts(
  fileDrafts: SandboxFileDraft[],
): SandboxFileDraft[] {
  return fileDrafts;
}

export function getPromptDraftsForArchitecture(
  state: SandboxState,
  architectureId: string,
): PromptDraftMap {
  const architecture = state.architectures.find(
    (entry) => entry.id === architectureId,
  );

  if (!architecture) {
    return state.promptDraftsByArchitecture[architectureId] ?? {};
  }

  return (
    state.promptDraftsByArchitecture[architectureId] ??
    createPromptDraftMap(architecture)
  );
}

export function getPromptSourceForArchitecture(
  state: SandboxState,
  architectureId: string,
): PromptSourceMode {
  return normalizePromptSourceMode(state.promptSourceByArchitecture[architectureId]);
}

export function getPromptCoverageLabels(
  architecture: LoadedPromptArchitecture,
  promptDrafts: PromptDraftMap,
): string[] {
  return getMissingPromptLabels(architecture, promptDrafts);
}

export function isPromptCoverageComplete(
  architecture: LoadedPromptArchitecture,
  promptDrafts: PromptDraftMap,
): boolean {
  return isPromptDraftMapComplete(architecture, promptDrafts);
}

export function sandboxReducer(
  state: SandboxState,
  action: SandboxAction,
): SandboxState {
  switch (action.type) {
    case "set-architectures": {
      const selectedArchitectureId = action.architectures.some(
        (architecture) => architecture.id === state.selectedArchitectureId,
      )
        ? state.selectedArchitectureId
        : (action.architectures[0]?.id ?? state.selectedArchitectureId);
      const promptSourceByArchitecture = createPromptSourcesForArchitectures(
        action.architectures,
        state.promptSourceByArchitecture,
      );

      if (
        selectedArchitectureId &&
        selectedArchitectureId !== state.selectedArchitectureId
      ) {
        globalThis.localStorage?.setItem(
          "ccr-sandbox-architecture",
          selectedArchitectureId,
        );
      }

      persistPromptSourcesByArchitecture(promptSourceByArchitecture);

      return {
        ...state,
        architectures: action.architectures,
        selectedArchitectureId,
        promptDraftsByArchitecture: createPromptDraftsForArchitectures(
          action.architectures,
          state.promptDraftsByArchitecture,
        ),
        promptSourceByArchitecture,
      };
    }
    case "select-architecture":
      globalThis.localStorage?.setItem(
        "ccr-sandbox-architecture",
        action.architectureId,
      );
      return {
        ...state,
        selectedArchitectureId: action.architectureId,
      };
    case "add-file": {
      const nextIndex = state.fileDrafts.length + 1;
      return {
        ...state,
        fileDrafts: [...state.fileDrafts, createEmptyFileDraft(nextIndex)],
      };
    }
    case "replace-file-drafts":
      return {
        ...state,
        fileDrafts: normalizeFileDrafts(action.fileDrafts),
      };
    case "remove-file": {
      const nextDrafts = state.fileDrafts.filter(
        (draft) => draft.id !== action.fileId,
      );
      return {
        ...state,
        fileDrafts: normalizeFileDrafts(nextDrafts),
      };
    }
    case "update-file": {
      return {
        ...state,
        fileDrafts: state.fileDrafts.map((draft) =>
          draft.id === action.fileId
            ? {
                ...draft,
                [action.field]: action.value,
              }
            : draft,
        ),
      };
    }
    case "set-metadata":
      globalThis.localStorage?.setItem("ccr-sandbox-metadata", action.metadata);
      return {
        ...state,
        metadata: action.metadata,
      };
    case "update-prompt": {
      const currentDrafts =
        state.promptDraftsByArchitecture[action.architectureId] ?? {};

      return {
        ...state,
        promptDraftsByArchitecture: {
          ...state.promptDraftsByArchitecture,
          [action.architectureId]: {
            ...currentDrafts,
            [action.promptId]: action.value,
          },
        },
      };
    }
    case "merge-prompt-drafts": {
      const currentDrafts =
        state.promptDraftsByArchitecture[action.architectureId] ?? {};

      return {
        ...state,
        promptDraftsByArchitecture: {
          ...state.promptDraftsByArchitecture,
          [action.architectureId]: {
            ...currentDrafts,
            ...action.promptDrafts,
          },
        },
      };
    }
    case "set-prompt-source": {
      const nextPromptSource = normalizePromptSourceMode(action.source);
      const currentPromptSource = normalizePromptSourceMode(
        state.promptSourceByArchitecture[action.architectureId],
      );

      if (currentPromptSource === nextPromptSource) {
        return state;
      }

      const promptSourceByArchitecture = {
        ...state.promptSourceByArchitecture,
        [action.architectureId]: nextPromptSource,
      };

      persistPromptSourcesByArchitecture(promptSourceByArchitecture);

      return {
        ...state,
        promptSourceByArchitecture,
      };
    }
    case "append-log":
      if (action.entry.details?.promptMessages) {
        return {
          ...state,
          logs: [...state.logs, createLogItem(action.entry)],
          sentPrompt: JSON.stringify(
            action.entry.details.promptMessages,
            null,
            2,
          ),
        };
      }
      return {
        ...state,
        logs: [...state.logs, createLogItem(action.entry)],
      };
    case "set-prompt-sent":
      return {
        ...state,
        sentPrompt: action.prompt,
      };
    case "set-run-metrics":
      return {
        ...state,
        runMetrics: action.metrics,
      };
    case "clear-run":
      return {
        ...state,
        logs: [],
        outputMarkdown: "",
        rawModelOutput: "",
        sentPrompt: "",
        runMetrics: undefined,
        errorMessage: undefined,
        runId: undefined,
        runStatus: "idle",
      };
    case "set-output":
      return {
        ...state,
        outputMarkdown: action.markdown,
        rawModelOutput: action.rawModelOutput ?? state.rawModelOutput,
      };
    case "set-run-status":
      return {
        ...state,
        runStatus: action.status,
        runId: action.runId ?? state.runId,
        errorMessage: action.errorMessage,
      };
    default:
      return state;
  }
}

export function buildReviewRequest(state: SandboxState): ReviewRequest {
  const architectureId = ensureSelectedArchitecture(state);
  const architecture = state.architectures.find(
    (entry) => entry.id === architectureId,
  );
  const promptSource = getPromptSourceForArchitecture(state, architectureId);

  return {
    architectureId,
    files: state.fileDrafts.map(
      (draft): ReviewFileInput => ({
        path: draft.filePath,
        name: draft.fileName,
        content: draft.sampleCode,
      }),
    ),
    context: {
      metadata: state.metadata.trim().length > 0 ? state.metadata : undefined,
    },
    promptOverrides: architecture && promptSource === "custom"
      ? getPromptDraftsForArchitecture(state, architectureId)
      : undefined,
  };
}

export function getSelectedArchitecture(
  state: SandboxState,
): LoadedPromptArchitecture | undefined {
  return state.architectures.find(
    (architecture) => architecture.id === ensureSelectedArchitecture(state),
  );
}
