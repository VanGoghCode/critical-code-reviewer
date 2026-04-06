import type { LoadedPromptArchitecture } from "../../../src/core/types";
import type { PromptSourceMode } from "../state";

export interface ArchitectureSwitcherProps {
  architectures: LoadedPromptArchitecture[];
  selectedArchitectureId: string;
  onSelect: (architectureId: string) => void;
  selectedPromptSource: PromptSourceMode;
  onSelectPromptSource: (source: PromptSourceMode) => void;
  disabled?: boolean;
}

export function ArchitectureSwitcher({
  architectures,
  selectedArchitectureId,
  onSelect,
  selectedPromptSource,
  onSelectPromptSource,
  disabled = false,
}: ArchitectureSwitcherProps) {
  const hasArchitectures = architectures.length > 0;

  function handlePromptSourceChange(value: string): void {
    onSelectPromptSource(value === "custom" ? "custom" : "default");
  }

  return (
    <div className="architecture-switcher architecture-switcher-highlight">
      <label className="architecture-switcher-field">
        <span className="architecture-switcher-label">
          <span className="eyebrow">Template</span>
          <span>Review template</span>
        </span>
        <select
          className="select-control"
          value={selectedArchitectureId}
          onChange={(event) => onSelect(event.target.value)}
          disabled={disabled || !hasArchitectures}
        >
          {hasArchitectures ? null : <option value="">Loading...</option>}
          {architectures.map((architecture) => (
            <option key={architecture.id} value={architecture.id}>
              {architecture.label}
            </option>
          ))}
        </select>
      </label>

      <label className="architecture-switcher-field">
        <span className="architecture-switcher-label">
          <span className="eyebrow">Prompt source</span>
          <span>Instructions</span>
        </span>
        <select
          className="select-control"
          value={selectedPromptSource}
          onChange={(event) => handlePromptSourceChange(event.target.value)}
          disabled={disabled || !hasArchitectures}
        >
          <option value="default">Built-in defaults</option>
          <option value="custom">Add my own prompts</option>
        </select>
      </label>
    </div>
  );
}
