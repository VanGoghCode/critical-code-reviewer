import type { ReviewRunMetrics } from "../../../src/core/types";

export interface LLMInspectorProps {
  promptText: string;
  rawModelOutput: string;
  runMetrics?: ReviewRunMetrics;
  runStatus: "idle" | "running" | "completed" | "failed";
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatCurrencyUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}

export function LLMInspector({
  promptText,
  rawModelOutput,
  runMetrics,
  runStatus,
}: LLMInspectorProps) {
  return (
    <div className="panel stack">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Details</p>
          <h2>LLM Communication Inspector</h2>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="field compact-field">
          <span>Exact Prompt Sent to LLM</span>
          <textarea
            readOnly
            rows={10}
            value={promptText || "Not initiated yet. Run a review."}
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: "0.8rem",
              whiteSpace: "pre",
            }}
          />
        </div>

        <div className="field compact-field">
          <span className="field-label-inline">
            <span>Exact LLM Response</span>
            {runStatus === "running" ? (
              <span className="inline-loader" role="status" aria-live="polite">
                <span className="inline-loader-spinner" aria-hidden="true" />
                Running...
              </span>
            ) : null}
          </span>
          <div className="muted" style={{ marginBottom: "0.5rem" }}>
            Time: {runMetrics ? formatDuration(runMetrics.durationMs) : "-"} |
            Tokens: {runMetrics ? runMetrics.usage.totalTokens : "-"} |
            Est. cost: {runMetrics ? formatCurrencyUsd(runMetrics.estimatedCostUsd) : "-"}
          </div>
          <textarea
            readOnly
            rows={15}
            value={
              rawModelOutput ||
              (runStatus === "idle"
                ? "Waiting for review to start..."
                : "Waiting for LLM response...")
            }
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: "0.8rem",
              whiteSpace: "pre-wrap",
            }}
          />
        </div>
      </div>
    </div>
  );
}
