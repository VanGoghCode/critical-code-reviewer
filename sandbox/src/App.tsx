import { useEffect, useReducer, useState } from "react";
import type { LoadedPromptArchitecture } from "../../src/core/types";
import { fetchArchitectures, startSandboxRun } from "./api";
import { ArchitectureSwitcher } from "./components/ArchitectureSwitcher";
import { FileSetEditor } from "./components/FileSetEditor";
import { LLMInspector } from "./components/LLMInspector";
import { OutputPanel } from "./components/OutputPanel";
import { PromptEditor } from "./components/PromptEditor";
import {
  buildReviewRequest,
  createInitialSandboxState,
  getPromptCoverageLabels,
  getPromptDraftsForArchitecture,
  getPromptSourceForArchitecture,
  getSelectedArchitecture,
  sandboxReducer,
} from "./state";

type ClientLogLevel = "debug" | "info" | "warn" | "error";

function buildBuiltInPromptJson(
  architecture: LoadedPromptArchitecture | undefined,
): string {
  if (!architecture) {
    return "";
  }

  if (architecture.mode === "single") {
    return JSON.stringify(
      {
        review: architecture.stages[0]?.promptText ?? "",
      },
      null,
      2,
    );
  }

  const prompts: Record<string, string> = Object.fromEntries(
    architecture.stages.map((stage, index) => [
      `stage${index + 1}`,
      stage.promptText,
    ]),
  );

  if (architecture.combineStage) {
    prompts.combine = architecture.combineStage.promptText;
  }

  return JSON.stringify(prompts, null, 2);
}

export function App() {
  const [state, dispatch] = useReducer(
    sandboxReducer,
    undefined,
    createInitialSandboxState,
  );
  const [loadingArchitectures, setLoadingArchitectures] = useState(true);
  const [architectureError, setArchitectureError] = useState<string | null>(
    null,
  );
  const [showOutput, setShowOutput] = useState(false);
  const [promptImportValidationError, setPromptImportValidationError] =
    useState<string | null>(null);

  function appendClientLog(
    level: ClientLogLevel,
    message: string,
    details?: Record<string, unknown>,
  ): void {
    dispatch({
      type: "append-log",
      entry: {
        timestamp: new Date().toISOString(),
        level,
        message,
        details,
      },
    });
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setLoadingArchitectures(true);
        const architectures = await fetchArchitectures();
        if (!active) {
          return;
        }

        dispatch({ type: "set-architectures", architectures });
        setArchitectureError(null);
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setArchitectureError(message);
      } finally {
        if (active) {
          setLoadingArchitectures(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function runSandboxReview() {
    const architecture = getSelectedArchitecture(state);
    if (!architecture) {
      return;
    }

    const promptSource = getPromptSourceForArchitecture(state, architecture.id);

    if (state.fileDrafts.length === 0) {
      appendClientLog("warn", "Run blocked because no files are uploaded.", {
        architectureId: architecture.id,
      });
      dispatch({
        type: "set-run-status",
        status: "failed",
        errorMessage: "Upload at least one file before running the review.",
      });
      return;
    }

    const promptDrafts = getPromptDraftsForArchitecture(state, architecture.id);
    if (promptSource === "custom") {
      if (promptImportValidationError) {
        appendClientLog(
          "warn",
          "Run blocked because Import instructions JSON is invalid.",
          {
            architectureId: architecture.id,
            error: promptImportValidationError,
          },
        );
        dispatch({
          type: "set-run-status",
          status: "failed",
          errorMessage:
            "Fix Import instructions JSON before running the review.",
        });
        return;
      }

      const missingPromptLabels = getPromptCoverageLabels(
        architecture,
        promptDrafts,
      );
      if (missingPromptLabels.length > 0) {
        appendClientLog(
          "warn",
          "Run blocked because some required prompts are missing.",
          {
            architectureId: architecture.id,
            missingPrompts: missingPromptLabels,
          },
        );
        dispatch({
          type: "set-run-status",
          status: "failed",
          errorMessage: `Fill all prompts before running: ${missingPromptLabels.join(", ")}.`,
        });
        return;
      }
    }

    dispatch({ type: "clear-run" });
    dispatch({ type: "set-run-status", status: "running" });
    appendClientLog("info", "Submitting review run.", {
      architectureId: architecture.id,
      fileCount: state.fileDrafts.length,
    });

    try {
      const reviewRequest = buildReviewRequest(state);
      const response = await startSandboxRun(reviewRequest);
      appendClientLog("info", "Review run completed.", {
        markdownLength: response.report.markdown.length,
      });

      dispatch({
        type: "set-prompt-sent",
        prompt: response.sentPrompt ?? "",
      });
      dispatch({
        type: "set-run-metrics",
        metrics: response.metrics,
      });
      dispatch({
        type: "set-output",
        markdown: response.report.markdown,
        rawModelOutput:
          response.rawModelOutput ?? response.report.rawModelOutput,
      });
      dispatch({
        type: "set-run-status",
        status: "completed",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendClientLog("error", "Unable to start review run.", {
        architectureId: architecture.id,
        error: message,
      });
      dispatch({
        type: "set-run-status",
        status: "failed",
        errorMessage: message,
      });
    }
  }

  async function copyOutput() {
    if (state.outputMarkdown.length === 0) {
      return;
    }

    await navigator.clipboard.writeText(state.outputMarkdown);
  }

  async function copyBuiltInPromptJson(promptJson: string): Promise<void> {
    if (promptJson.trim().length === 0) {
      return;
    }

    await navigator.clipboard.writeText(promptJson);
  }

  const selectedArchitecture = getSelectedArchitecture(state);
  const selectedPromptDrafts = selectedArchitecture
    ? getPromptDraftsForArchitecture(state, selectedArchitecture.id)
    : {};
  const selectedPromptSource = selectedArchitecture
    ? getPromptSourceForArchitecture(state, selectedArchitecture.id)
    : "default";
  const usingCustomPrompts = selectedPromptSource === "custom";
  const missingPromptLabels = selectedArchitecture && usingCustomPrompts
    ? getPromptCoverageLabels(selectedArchitecture, selectedPromptDrafts)
    : [];
  const hasPromptImportValidationError = Boolean(promptImportValidationError);
  const hasBlockingPromptError =
    usingCustomPrompts && hasPromptImportValidationError;
  const builtInPromptJson = buildBuiltInPromptJson(selectedArchitecture);
  const canRunReview = Boolean(
    selectedArchitecture &&
      !loadingArchitectures &&
      state.fileDrafts.length > 0 &&
      missingPromptLabels.length === 0 &&
      !hasBlockingPromptError,
  );
  const readyFileCount = state.fileDrafts.filter(
    (draft) => draft.sampleCode.trim().length > 0,
  ).length;

  return (
    <div className="app-shell">
      <header className="topbar panel">
        <div className="topbar-brand">
          <p className="eyebrow">CCR Sandbox</p>
          <h1>Critical Code Reviewer</h1>
        </div>

        <div className="topbar-controls">
          <ArchitectureSwitcher
            architectures={state.architectures}
            selectedArchitectureId={state.selectedArchitectureId}
            onSelect={(architectureId) =>
              dispatch({ type: "select-architecture", architectureId })
            }
            selectedPromptSource={selectedPromptSource}
            onSelectPromptSource={(source) => {
              const architectureId =
                selectedArchitecture?.id ?? state.selectedArchitectureId;
              if (!architectureId) {
                return;
              }

              dispatch({
                type: "set-prompt-source",
                architectureId,
                source,
              });
            }}
            disabled={loadingArchitectures}
          />

          <span
            className={`badge ${missingPromptLabels.length === 0 ? "badge-completed" : "badge-failed"}`}
          >
            {selectedArchitecture
              ? usingCustomPrompts
                ? missingPromptLabels.length === 0
                  ? "Custom instructions ready"
                  : `${missingPromptLabels.length} instructions missing`
                : "Using default instructions"
              : loadingArchitectures
                ? "Loading templates"
                : "No template selected"}
          </span>

          {usingCustomPrompts && hasPromptImportValidationError ? (
            <span className="badge badge-failed">Fix Import JSON</span>
          ) : null}

          <span className={`badge badge-${state.runStatus}`}>
            {state.runStatus === "idle" ? "Not started" : state.runStatus}
          </span>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowOutput(true)}
            disabled={state.outputMarkdown.length === 0}
          >
            View report
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => void runSandboxReview()}
            disabled={!canRunReview || state.runStatus === "running"}
          >
            Run review
          </button>
        </div>
      </header>

      <section className="panel quick-start">
        <div className="quick-start-grid">
          <div className="quick-step">
            <h3>Add files</h3>
            <p className="muted">Upload or paste the code you want reviewed.</p>
            <span className="badge">{readyFileCount} file(s) ready</span>
          </div>
          <div className="quick-step">
            <h3>Add instructions</h3>
            <p className="muted">
              {usingCustomPrompts
                ? "Fill each required instruction box for your template."
                : "Using the built-in template instructions from code."}
            </p>
            <span
              className={`badge ${missingPromptLabels.length === 0 ? "badge-completed" : "badge-failed"}`}
            >
              {usingCustomPrompts
                ? missingPromptLabels.length === 0
                  ? "All required instructions filled"
                  : `${missingPromptLabels.length} still needed`
                : "Built-in defaults enabled"}
            </span>
          </div>
          <div className="quick-step">
            <h3>Run and review</h3>
            <p className="muted">
              Generate the report and open it from View report.
            </p>
            <span className={`badge badge-${state.runStatus}`}>
              {state.runStatus}
            </span>
          </div>
        </div>
      </section>

      {architectureError ? (
        <div className="error-banner">{architectureError}</div>
      ) : null}

      <main className="workspace">
        <section className="input-column">
          {!selectedArchitecture || usingCustomPrompts ? (
            <PromptEditor
              key={selectedArchitecture?.id ?? "loading"}
              architecture={selectedArchitecture}
              promptDrafts={selectedPromptDrafts}
              onChangePrompt={(promptId, value) => {
                if (!selectedArchitecture) {
                  return;
                }

                dispatch({
                  type: "update-prompt",
                  architectureId: selectedArchitecture.id,
                  promptId,
                  value,
                });
              }}
              onMergePromptDrafts={(promptDrafts) => {
                if (!selectedArchitecture) {
                  return;
                }

                dispatch({
                  type: "merge-prompt-drafts",
                  architectureId: selectedArchitecture.id,
                  promptDrafts,
                });
              }}
              onImportValidationChange={setPromptImportValidationError}
            />
          ) : (
            <div className="panel prompts-panel stack prompt-source-default-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Instructions</p>
                  <h2>Using built-in template instructions</h2>
                </div>
                <span className="badge badge-completed">Ready</span>
              </div>

              <p className="muted">
                The selected architecture will run with the default prompts that
                ship with this project.
              </p>

              <label className="field compact-field">
                <span>Import instructions JSON</span>
                <textarea rows={10} readOnly value={builtInPromptJson} />
              </label>

              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void copyBuiltInPromptJson(builtInPromptJson)}
                  disabled={builtInPromptJson.trim().length === 0}
                >
                  Copy built-in JSON
                </button>
              </div>

              <p className="muted">
                Switch Prompt source to Add my own prompts if you want to edit
                these instructions or import your own JSON.
              </p>
            </div>
          )}
        </section>

        <section className="log-column">
          <FileSetEditor
            fileDrafts={state.fileDrafts}
            onImportFiles={(fileDrafts) =>
              dispatch({ type: "replace-file-drafts", fileDrafts })
            }
            onRemoveFile={(fileId) => dispatch({ type: "remove-file", fileId })}
            metadata={state.metadata}
            onChangeMetadata={(metadata) =>
              dispatch({ type: "set-metadata", metadata })
            }
          />
        </section>
      </main>

      <LLMInspector
        promptText={state.sentPrompt}
        rawModelOutput={state.rawModelOutput}
        runMetrics={state.runMetrics}
        runStatus={state.runStatus}
      />

      <OutputPanel
        open={showOutput}
        markdown={state.outputMarkdown}
        runStatus={state.runStatus}
        architectureName={selectedArchitecture?.label}
        fileCount={state.fileDrafts.length}
        onCopy={() => void copyOutput()}
        onClose={() => setShowOutput(false)}
      />
    </div>
  );
}
