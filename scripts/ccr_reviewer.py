#!/usr/bin/env python3
"""
CCR Reviewer -- Automated ethical code review for educational technology.
Analyzes PR diffs against the CCR framework and posts inline review comments.

Architecture modes:
  - single-pass: one LLM call, full framework
  - iterative:   6 sequential stages, cumulative context
  - parallel:    6 parallel stages + combine step
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CODE_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go",
        ".rb", ".rs", ".php", ".swift", ".kt", ".cs", ".scala", ".r",
        ".m", ".sql", ".sh", ".yaml", ".yml", ".json", ".toml",
    }
)

DEFAULT_MAX_FILES = 25
DEFAULT_MAX_CHANGES = 1000
DEFAULT_MAX_INLINE_COMMENTS = 10
DEFAULT_MAX_CONTEXT_CHARS = 12000

DEFAULT_ASU_BASE_URL = "https://api-main.aiml.asu.edu/queryV2"
DEFAULT_ASU_MODEL_PROVIDER = "openai"
DEFAULT_ASU_TEMPERATURE = 0.2
DEFAULT_ASU_TIMEOUT_MS = 120000

PARALLEL_STAGE_LAUNCH_GAP_S = 1.0


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ParsedPatchHunk:
    old_start: int
    old_count: int
    new_start: int
    new_count: int
    changed_lines: list[int] = field(default_factory=list)
    changed_line_contents: list[tuple[int, str]] = field(default_factory=list)


@dataclass(frozen=True)
class ParsedPatchMap:
    hunks: list[ParsedPatchHunk] = field(default_factory=list)
    changed_lines: list[int] = field(default_factory=list)
    changed_line_content_by_line: dict[int, str] = field(default_factory=dict)


@dataclass(frozen=True)
class InlineReviewComment:
    path: str
    line: int
    start_line: Optional[int]
    body: str
    severity: str
    title: str


@dataclass(frozen=True)
class Finding:
    """A single review finding matching the JSON output contract."""
    path: str
    line: int
    body: str
    severity: str  # info | warning | concern


@dataclass(frozen=True)
class PRFile:
    filename: str
    status: str
    patch: str
    additions: int
    deletions: int


# ---------------------------------------------------------------------------
# ASU AIML Provider
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AsuConfig:
    api_key: str
    base_url: str
    model: str
    model_provider: str
    temperature: float
    timeout_ms: int


def _safe_float(value: str, fallback: float) -> float:
    try:
        return float(value)
    except (ValueError, TypeError):
        return fallback


def _safe_int(value: str, fallback: int) -> int:
    try:
        return int(value)
    except (ValueError, TypeError):
        return fallback


def load_asu_config() -> AsuConfig:
    """Build ASU config from environment variables."""
    api_key = os.getenv("ASU_API_KEY", "").strip()
    model = os.getenv("ASU_MODEL", "").strip()
    if not api_key or not model:
        raise SystemExit("ASU_API_KEY and ASU_MODEL are required.")
    return AsuConfig(
        api_key=api_key,
        base_url=os.getenv("ASU_BASE_URL", DEFAULT_ASU_BASE_URL).strip(),
        model=model,
        model_provider=os.getenv("ASU_MODEL_PROVIDER", DEFAULT_ASU_MODEL_PROVIDER).strip(),
        temperature=_safe_float(os.getenv("ASU_TEMPERATURE", ""), DEFAULT_ASU_TEMPERATURE),
        timeout_ms=_safe_int(os.getenv("ASU_TIMEOUT_MS", ""), DEFAULT_ASU_TIMEOUT_MS),
    )


def _parse_asu_response(raw: str) -> str:
    """Extract the text output from an ASU AIML API response."""
    data: dict[str, Any] = json.loads(raw)

    # Try common response field names
    for key in ("response", "output", "result", "content"):
        if key in data and isinstance(data[key], str):
            return data[key]

    # Try OpenAI-style choices
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message", {})
        if isinstance(msg, dict) and isinstance(msg.get("content"), str):
            return msg["content"]

    # Try nested response object
    resp = data.get("response")
    if isinstance(resp, dict):
        for key in ("content", "text", "message"):
            if key in resp and isinstance(resp[key], str):
                return resp[key]

    raise ValueError(f"Unexpected ASU response format: {raw[:500]}")


def call_asu(config: AsuConfig, system_prompt: str, user_prompt: str) -> str:
    """Send a single request to the ASU AIML API. Returns raw LLM text."""
    body: dict[str, Any] = {
        "action": "query",
        "request_source": "override_params",
        "query": user_prompt,
        "model_name": config.model,
        "model_params": {
            "temperature": config.temperature,
        },
    }

    if system_prompt.strip():
        body["model_params"]["system_prompt"] = system_prompt

    if config.model_provider:
        body["model_provider"] = config.model_provider

    response = requests.post(
        config.base_url,
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=config.timeout_ms / 1000,
    )

    if not response.ok:
        raise RuntimeError(
            f"ASU request failed ({response.status_code}): {response.text[:500]}"
        )

    return _parse_asu_response(response.text)


# ---------------------------------------------------------------------------
# 5-Layer Prompt System
# ---------------------------------------------------------------------------

# Layer 1: Identity (hardcoded, never loaded from file)
_IDENTITY_PROMPT = ""


def _load_shared_prompt(filename: str) -> str:
    """Load a shared prompt layer from prompts/shared/."""
    root = _find_repo_root()
    path = root / "prompts" / "shared" / filename
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def _build_layered_system_prompt(stage_prompt: str) -> str:
    """Assemble Layers 1 + 2 + 3 + 4 into the system prompt.

    Layer 1: Identity (hardcoded)
    Layer 2: Persona (shared/persona.md)
    Layer 3: Stage-specific instructions (editable stage prompt)
    Layer 4: Humanize (shared/humanize.md)
    """
    parts: list[str] = [_IDENTITY_PROMPT]

    persona = _load_shared_prompt("persona.md").strip()
    if persona:
        parts.append(persona)

    if stage_prompt.strip():
        parts.append(stage_prompt.strip())

    humanize = _load_shared_prompt("humanize.md").strip()
    if humanize:
        parts.append(humanize)

    return "\n\n---\n\n".join(parts)


def _get_output_format() -> str:
    """Load Layer 5: output format from shared file."""
    return _load_shared_prompt("output-format.md")


def build_user_prompt(
    framework_prompt: str,
    files: list[PRFile],
    previous_outputs: Optional[list[str]] = None,
    max_context_chars: int = DEFAULT_MAX_CONTEXT_CHARS,
) -> str:
    """Build the user prompt (level 2 + diffs + level 5)."""
    parts: list[str] = []

    # Level 2: Framework prompt (what to look for, persona)
    if framework_prompt.strip():
        parts.append("## Review Criteria\n")
        parts.append(framework_prompt.strip())
        parts.append("")

    # File diffs
    parts.append("## Code Changes to Review\n")
    file_budget = max(500, max_context_chars // max(len(files) * 2, 1))
    for f in files:
        patch_text = f.patch
        if len(patch_text) > file_budget:
            patch_text = patch_text[:file_budget] + "\n... [truncated]"
        parts.append(f"### File: {f.filename}")
        parts.append(f"Status: {f.status}")
        parts.append(f"```diff\n{patch_text}\n```\n")

    # Previous stage outputs (for sequential/parallel combine)
    if previous_outputs:
        parts.append("## Previous Stage Outputs\n")
        for i, output in enumerate(previous_outputs, 1):
            truncated = output[:2000] if len(output) > 2000 else output
            parts.append(f"### Stage {i} Output")
            parts.append(truncated)
            parts.append("")

    # Layer 5: Output format
    output_format = _get_output_format()
    if output_format.strip():
        parts.append(output_format.strip())

    result = "\n".join(parts)

    # Hard cap: if total prompt exceeds 3x the budget, truncate file diffs
    max_total = max_context_chars * 3
    if len(result) > max_total:
        # Rebuild with smaller per-file budget
        small_budget = max(200, max_context_chars // max(len(files) * 3, 1))
        truncated_parts: list[str] = []
        if framework_prompt.strip():
            truncated_parts.append("## Review Criteria\n")
            truncated_parts.append(framework_prompt.strip())
            truncated_parts.append("")
        truncated_parts.append("## Code Changes to Review\n")
        for f in files:
            patch_text = f.patch
            if len(patch_text) > small_budget:
                patch_text = patch_text[:small_budget] + "\n... [truncated]"
            truncated_parts.append(f"### File: {f.filename}")
            truncated_parts.append(f"Status: {f.status}")
            truncated_parts.append(f"```diff\n{patch_text}\n```\n")
        if previous_outputs:
            truncated_parts.append("## Previous Stage Outputs\n")
            for i, output in enumerate(previous_outputs, 1):
                truncated = output[:1000] if len(output) > 1000 else output
                truncated_parts.append(f"### Stage {i} Output")
                truncated_parts.append(truncated)
                truncated_parts.append("")
        output_format = _get_output_format()
        if output_format.strip():
            truncated_parts.append(output_format.strip())
        result = "\n".join(truncated_parts)

    return result


# ---------------------------------------------------------------------------
# Manifest / Prompt Loading
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class StageManifest:
    id: str
    label: str
    purpose: str
    prompt_path: str


@dataclass(frozen=True)
class ArchitectureManifest:
    id: str
    label: str
    description: str
    mode: str  # single | sequential | parallel
    stages: list[StageManifest]
    combine_stage: Optional[StageManifest] = None


_repo_root_cache: Optional[Path] = None


def _find_repo_root() -> Path:
    """Walk up from script location to find repo root (contains .git). Cached."""
    global _repo_root_cache
    if _repo_root_cache is not None:
        return _repo_root_cache

    current = Path(__file__).resolve().parent
    for _ in range(10):
        if (current / ".git").exists():
            _repo_root_cache = current
            return current
        parent = current.parent
        if parent == current:
            break
        current = parent

    _repo_root_cache = Path.cwd()
    return _repo_root_cache


def load_manifest(architecture_id: str, prompt_root: Optional[str] = None) -> ArchitectureManifest:
    """Load an architecture manifest and return it."""
    root = _find_repo_root()
    prompt_dir = root / (prompt_root or "prompts")
    manifest_path = prompt_dir / "architectures" / architecture_id / "manifest.json"

    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    data = json.loads(manifest_path.read_text(encoding="utf-8"))

    stages = [
        StageManifest(
            id=s["id"],
            label=s["label"],
            purpose=s["purpose"],
            prompt_path=s["promptPath"],
        )
        for s in data["stages"]
    ]

    combine = None
    if "combineStage" in data and data["combineStage"]:
        c = data["combineStage"]
        combine = StageManifest(
            id=c["id"], label=c["label"], purpose=c["purpose"], prompt_path=c["promptPath"]
        )

    return ArchitectureManifest(
        id=data["id"],
        label=data["label"],
        description=data["description"],
        mode=data["mode"],
        stages=stages,
        combine_stage=combine,
    )


def load_stage_prompt(stage: StageManifest, prompt_root: Optional[str] = None) -> str:
    """Read the markdown prompt file for a stage."""
    root = _find_repo_root()
    prompt_dir = root / (prompt_root or "prompts")
    path = prompt_dir / stage.prompt_path

    if path.exists():
        return path.read_text(encoding="utf-8")

    print(f"Warning: prompt file not found: {path}")
    return ""


def load_framework_md() -> str:
    """Load .github/ccr-framework.md for single-pass mode (level 2 prompt)."""
    root = _find_repo_root()
    path = root / ".github" / "ccr-framework.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


# ---------------------------------------------------------------------------
# Architecture Engine
# ---------------------------------------------------------------------------


def _execute_stage(
    config: AsuConfig,
    stage: StageManifest,
    stage_prompt: str,
    files: list[PRFile],
    previous_outputs: list[str],
    max_context_chars: int,
) -> str:
    """Run a single stage: call ASU and return raw output."""
    system_prompt = _build_layered_system_prompt(stage_prompt)
    user_prompt = build_user_prompt(stage_prompt, files, previous_outputs, max_context_chars)
    return call_asu(config, system_prompt, user_prompt)


def run_single(
    config: AsuConfig,
    manifest: ArchitectureManifest,
    files: list[PRFile],
    max_context_chars: int,
    prompt_root: Optional[str] = None,
) -> str:
    """Single mode: one LLM call.

    Level-2 prompt comes from .github/ccr-framework.md if it exists,
    otherwise falls back to the manifest's stage promptPath.
    """
    # User-editable framework takes priority
    stage_prompt = load_framework_md()
    if not stage_prompt.strip():
        stage = manifest.stages[0]
        stage_prompt = load_stage_prompt(stage, prompt_root)
        print(f"  Stage: {manifest.stages[0].label} (manifest prompt)")
    else:
        print(f"  Stage: Full Audit (.github/ccr-framework.md)")
    return _execute_stage(config, manifest.stages[0], stage_prompt, files, [], max_context_chars)


def run_sequential(
    config: AsuConfig,
    manifest: ArchitectureManifest,
    files: list[PRFile],
    max_context_chars: int,
    prompt_root: Optional[str] = None,
) -> str:
    """Sequential mode: stages run in order, each gets previous output."""
    previous: list[str] = []
    for i, stage in enumerate(manifest.stages):
        stage_prompt = load_stage_prompt(stage, prompt_root)
        print(f"  Stage {i + 1}/{len(manifest.stages)}: {stage.label}")
        try:
            output = _execute_stage(config, stage, stage_prompt, files, previous, max_context_chars)
            previous = [output]
        except Exception as exc:
            print(f"  Stage {i + 1} failed: {exc}")
            previous = ["[]"]
    return previous[0] if previous else "[]"


def run_parallel(
    config: AsuConfig,
    manifest: ArchitectureManifest,
    files: list[PRFile],
    max_context_chars: int,
    prompt_root: Optional[str] = None,
) -> str:
    """Parallel mode: stages run concurrently, then combine step merges."""
    stage_outputs: dict[int, str] = {}

    def _run_stage(index: int, stage: StageManifest) -> tuple[int, str]:
        stage_prompt = load_stage_prompt(stage, prompt_root)
        print(f"  Stage {index + 1}/{len(manifest.stages)}: {stage.label}")
        try:
            output = _execute_stage(config, stage, stage_prompt, files, [], max_context_chars)
            return (index, output)
        except Exception as exc:
            print(f"  Stage {index + 1} failed: {exc}")
            return (index, "[]")

    with ThreadPoolExecutor(max_workers=min(len(manifest.stages), 6)) as executor:
        futures = {}
        for i, stage in enumerate(manifest.stages):
            if i > 0:
                time.sleep(PARALLEL_STAGE_LAUNCH_GAP_S)
            futures[executor.submit(_run_stage, i, stage)] = i

        for future in as_completed(futures):
            idx, output = future.result()
            stage_outputs[idx] = output

    # Combine step
    if not manifest.combine_stage:
        raise RuntimeError(f"Parallel architecture '{manifest.id}' missing combine stage.")

    ordered_outputs = [stage_outputs[i] for i in sorted(stage_outputs.keys())]
    combine_prompt = load_stage_prompt(manifest.combine_stage, prompt_root)
    print(f"  Combine stage: {manifest.combine_stage.label}")
    return _execute_stage(
        config, manifest.combine_stage, combine_prompt, files, ordered_outputs, max_context_chars
    )


def run_engine(
    config: AsuConfig,
    architecture_id: str,
    files: list[PRFile],
    max_context_chars: int = DEFAULT_MAX_CONTEXT_CHARS,
    prompt_root: Optional[str] = None,
) -> str:
    """Load manifest and run the appropriate architecture mode."""
    manifest = load_manifest(architecture_id, prompt_root)
    print(f"Architecture: {manifest.label} (mode={manifest.mode})")

    if manifest.mode == "single":
        return run_single(config, manifest, files, max_context_chars, prompt_root)
    elif manifest.mode == "sequential":
        return run_sequential(config, manifest, files, max_context_chars, prompt_root)
    elif manifest.mode == "parallel":
        return run_parallel(config, manifest, files, max_context_chars, prompt_root)
    else:
        raise ValueError(f"Unknown architecture mode: {manifest.mode}")


# ---------------------------------------------------------------------------
# GitHub API
# ---------------------------------------------------------------------------


def get_changed_files(
    github_token: str, repo: str, pr_number: int
) -> list[PRFile]:
    """Fetch the files changed in a PR with their diffs."""
    headers: dict[str, str] = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/files"
    all_data: list[dict[str, Any]] = []
    page = 1

    while True:
        response = requests.get(
            url, headers=headers, timeout=30, params={"per_page": 100, "page": page}
        )
        response.raise_for_status()
        page_data = response.json()
        if not isinstance(page_data, list):
            break
        if not page_data:
            break
        all_data.extend(page_data)
        if len(page_data) < 100:
            break
        page += 1

    files: list[PRFile] = []
    for file_data in all_data:
        if file_data.get("status") == "removed":
            continue
        if file_data.get("changes", 0) > DEFAULT_MAX_CHANGES:
            continue

        files.append(
            PRFile(
                filename=file_data["filename"],
                status=file_data["status"],
                patch=file_data.get("patch", ""),
                additions=file_data.get("additions", 0),
                deletions=file_data.get("deletions", 0),
            )
        )

    return files


def filter_code_files(files: list[PRFile]) -> list[PRFile]:
    """Keep only code files."""
    return [
        f
        for f in files
        if any(f.filename.endswith(ext) for ext in CODE_EXTENSIONS)
    ]


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------


def extract_json_candidate(text: str) -> str:
    """Extract JSON from fenced code blocks or bare braces."""
    # Try fenced code block first
    fenced_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced_match and fenced_match.group(1):
        return fenced_match.group(1).strip()

    # Try bare array
    first_bracket = text.find("[")
    last_bracket = text.rfind("]")
    if first_bracket >= 0 and last_bracket > first_bracket:
        return text[first_bracket : last_bracket + 1].strip()

    # Try bare object (shouldn't happen per contract, but be safe)
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace >= 0 and last_brace > first_brace:
        return text[first_brace : last_brace + 1].strip()

    return text.strip()


def parse_findings(response_text: str) -> list[Finding]:
    """Parse LLM response into a list of Findings matching the JSON contract."""
    candidate = extract_json_candidate(response_text)

    try:
        data = json.loads(candidate)
    except json.JSONDecodeError as exc:
        print(f"Warning: Could not parse LLM response as JSON: {exc}")
        print(f"Response was: {candidate[:500]}")
        return []

    # Accept either an array directly or an object with an "issues" field
    if isinstance(data, dict):
        # Handle combine-stage output format: {issues: [...]}
        items = data.get("issues", data.get("findings", []))
        if not isinstance(items, list):
            items = []
    elif isinstance(data, list):
        items = data
    else:
        return []

    findings: list[Finding] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        path = item.get("path", item.get("file", ""))
        line_raw = item.get("line", 0)

        body_raw = item.get("body")
        if body_raw is None:
            title = str(item.get("title", "")).strip()
            detail = str(item.get("detail", "")).strip()
            recommendation = str(
                item.get("recommendation", item.get("suggestion", ""))
            ).strip()
            body = "\n".join(
                part for part in (title, detail, recommendation) if part
            )
        else:
            body = str(body_raw)

        raw_severity = str(item.get("severity", "info")).lower()
        if raw_severity in {"high", "critical", "concern"}:
            severity = "concern"
        elif raw_severity in {"medium", "warning"}:
            severity = "warning"
        else:
            severity = "info"

        # Coerce line to int (LLM may return string)
        try:
            line = int(line_raw)
        except (ValueError, TypeError):
            continue

        if not path or line <= 0:
            continue

        findings.append(
            Finding(
                path=str(path),
                line=line,
                body=body,
                severity=severity,
            )
        )

    return findings


# ---------------------------------------------------------------------------
# Patch parsing (ported from src/core/patch-map.ts)
# ---------------------------------------------------------------------------

HUNK_HEADER_RE = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


def _to_positive_int(raw: Optional[str], fallback: int) -> int:
    if not raw:
        return fallback
    try:
        value = int(raw, 10)
        return value if value >= 0 else fallback
    except (ValueError, TypeError):
        return fallback


def parse_unified_diff_patch(patch: str) -> ParsedPatchMap:
    """Parse a unified diff patch into structured hunk data."""
    if not patch or not patch.strip():
        return ParsedPatchMap()

    lines = patch.splitlines()
    hunks: list[ParsedPatchHunk] = []
    idx = 0

    while idx < len(lines):
        header = lines[idx]
        match = HUNK_HEADER_RE.match(header)
        if not match:
            idx += 1
            continue

        old_start = _to_positive_int(match.group(1), 0)
        old_count = _to_positive_int(match.group(2), 1)
        new_start = _to_positive_int(match.group(3), 0)
        new_count = _to_positive_int(match.group(4), 1)

        changed_lines: list[int] = []
        changed_line_contents: list[tuple[int, str]] = []
        current_line = new_start
        idx += 1

        while idx < len(lines):
            raw_line = lines[idx]
            if raw_line.startswith("@@ "):
                idx -= 1
                break

            if raw_line.startswith("+") and not raw_line.startswith("+++"):
                content = raw_line[1:]
                changed_lines.append(current_line)
                changed_line_contents.append((current_line, content))
                current_line += 1
            elif raw_line.startswith("-") and not raw_line.startswith("---"):
                pass  # removed line, don't advance new line counter
            elif raw_line.startswith(" "):
                current_line += 1

            idx += 1

        hunks.append(
            ParsedPatchHunk(
                old_start=old_start,
                old_count=old_count,
                new_start=new_start,
                new_count=new_count,
                changed_lines=changed_lines,
                changed_line_contents=changed_line_contents,
            )
        )
        idx += 1

    content_by_line: dict[int, str] = {}
    for hunk in hunks:
        for line_num, content in hunk.changed_line_contents:
            content_by_line[line_num] = content

    all_changed = sorted(content_by_line.keys())

    return ParsedPatchMap(
        hunks=hunks,
        changed_lines=all_changed,
        changed_line_content_by_line=content_by_line,
    )


# ---------------------------------------------------------------------------
# Line resolution (ported from src/core/patch-map.ts)
# ---------------------------------------------------------------------------


def _normalize_search_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).lower()


def _extract_search_candidates(value: str) -> list[str]:
    raw = value.strip()
    if not raw:
        return []

    from_newlines = [
        _normalize_search_text(entry)
        for entry in re.split(r"\r?\n+", raw)
        if len(_normalize_search_text(entry)) >= 8
    ]
    if from_newlines:
        return from_newlines[:4]

    from_punctuation = [
        _normalize_search_text(entry)
        for entry in re.split(r"[.;:!?]+", raw)
        if len(_normalize_search_text(entry)) >= 8
    ]
    if from_punctuation:
        return from_punctuation[:4]

    return [_normalize_search_text(raw)]


def _tokenize(value: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", _normalize_search_text(value)) if len(t) >= 3]


def _token_overlap_score(candidate: str, line: str) -> tuple[float, int]:
    candidate_tokens = _tokenize(candidate)
    if not candidate_tokens:
        return (0.0, 0)

    line_tokens = set(_tokenize(line))
    overlaps = sum(1 for token in candidate_tokens if token in line_tokens)
    return (overlaps / len(candidate_tokens), overlaps)


def _closest_line(target: int, lines: list[int]) -> Optional[int]:
    if not lines:
        return None

    best = lines[0]
    best_distance = abs(best - target)
    for line in lines[1:]:
        distance = abs(line - target)
        if distance < best_distance:
            best = line
            best_distance = distance

    return best


def resolve_changed_line(
    patch_map: ParsedPatchMap,
    requested_line: Optional[int] = None,
    search_text: Optional[str] = None,
    allow_fallback: bool = True,
) -> Optional[int]:
    """Map a requested line number to an actual changed line in the diff."""
    if not patch_map.changed_lines:
        return None

    changed_set = set(patch_map.changed_lines)

    if requested_line is not None and math.isfinite(requested_line):
        rounded = round(requested_line)
        if rounded in changed_set:
            return rounded
        return _closest_line(rounded, patch_map.changed_lines)

    if search_text and search_text.strip():
        candidates = _extract_search_candidates(search_text)
        best_line: Optional[int] = None
        best_score = 0.0
        best_overlap = 0

        for candidate in candidates:
            for line_num, content in patch_map.changed_line_content_by_line.items():
                normalized = _normalize_search_text(content)
                if normalized and (
                    candidate in normalized
                    or (len(candidate) >= 12 and normalized in candidate)
                ):
                    return line_num

                overlap, score = _token_overlap_score(candidate, normalized)
                if overlap > best_overlap or (overlap == best_overlap and score > best_score):
                    best_line = line_num
                    best_score = score
                    best_overlap = overlap

        if best_line is not None and best_overlap >= 2 and best_score >= 0.2:
            return best_line

    if not allow_fallback:
        return None

    return patch_map.changed_lines[0]


# ---------------------------------------------------------------------------
# Inline comment building
# ---------------------------------------------------------------------------

# Regex to strip any severity prefix the LLM might still add to body text
_SEVERITY_PREFIX_RE = re.compile(
    r"^\s*\[(?:HIGH|MEDIUM|LOW|INFO|WARNING|CONCERN|CRITICAL)\]\s*",
    re.IGNORECASE,
)


def _normalize_path(path_value: str) -> str:
    return path_value.replace("\\", "/").strip().lower()


def _resolve_file_record(
    finding_path: str, files: list[PRFile]
) -> Optional[PRFile]:
    normalized_target = _normalize_path(finding_path)

    exact = next(
        (f for f in files if _normalize_path(f.filename) == normalized_target), None
    )
    if exact:
        return exact

    suffix_matches = [
        f
        for f in files
        if _normalize_path(f.filename).endswith(f"/{normalized_target}")
        or _normalize_path(f.filename).endswith(normalized_target)
    ]

    if not suffix_matches:
        return None

    return min(suffix_matches, key=lambda f: len(f.filename))


def build_inline_comments(
    findings: list[Finding],
    files: list[PRFile],
    max_comments: int = DEFAULT_MAX_INLINE_COMMENTS,
) -> list[InlineReviewComment]:
    """Build inline review comments from findings with file-coverage and dedup."""
    if max_comments <= 0 or not findings:
        return []

    # Sort by severity: concern > warning > info
    severity_order = {"concern": 3, "warning": 2, "info": 1}
    sorted_findings = sorted(
        findings,
        key=lambda f: severity_order.get(f.severity, 0),
        reverse=True,
    )

    patch_cache: dict[str, ParsedPatchMap] = {}
    comment_keys: set[str] = set()
    comments: list[InlineReviewComment] = []

    # Build candidates: (filename, resolved_line, body, severity, dedupe_key)
    candidates: list[tuple[str, int, str, str, str]] = []
    for finding in sorted_findings:
        file_record = _resolve_file_record(finding.path, files)
        if not file_record:
            continue

        cache_key = file_record.filename
        if cache_key not in patch_cache:
            patch_cache[cache_key] = parse_unified_diff_patch(file_record.patch)

        patch_map = patch_cache[cache_key]
        if not patch_map.changed_lines:
            continue

        resolved = resolve_changed_line(
            patch_map,
            requested_line=finding.line,
            search_text=finding.body,
            allow_fallback=True,
        )

        if resolved is None:
            continue

        body = _SEVERITY_PREFIX_RE.sub("", finding.body.strip())
        dedupe_key = f"{file_record.filename}:{resolved}:{body.lower()}"

        candidates.append((file_record.filename, resolved, body, finding.severity, dedupe_key))

    # File-coverage pass: ensure at least one comment per file
    best_by_file: dict[str, tuple[str, int, str, str, str]] = {}
    for candidate in candidates:
        path = candidate[0]
        if path not in best_by_file:
            best_by_file[path] = candidate

    for candidate in best_by_file.values():
        if len(comments) >= max_comments:
            break
        dedupe_key = candidate[4]
        if dedupe_key in comment_keys:
            continue
        comment_keys.add(dedupe_key)
        comments.append(
            InlineReviewComment(
                path=candidate[0],
                line=candidate[1],
                start_line=None,
                body=candidate[2],
                severity=candidate[3],
                title="",
            )
        )

    # Fill remaining from sorted candidates
    for candidate in candidates:
        if len(comments) >= max_comments:
            break
        dedupe_key = candidate[4]
        if dedupe_key in comment_keys:
            continue
        comment_keys.add(dedupe_key)
        comments.append(
            InlineReviewComment(
                path=candidate[0],
                line=candidate[1],
                start_line=None,
                body=candidate[2],
                severity=candidate[3],
                title="",
            )
        )

    return comments


# ---------------------------------------------------------------------------
# Review posting
# ---------------------------------------------------------------------------


def _normalize_comment_body(body: str) -> str:
    return re.sub(r"\s+", " ", body.strip()).lower()


def _to_comment_dedupe_key(
    path: str, line: int, start_line: Optional[int], body: str
) -> str:
    normalized_start = (
        round(start_line) if start_line is not None and start_line < line else line
    )
    return ":".join(
        [
            _normalize_path(path),
            str(normalized_start),
            str(round(line)),
            _normalize_comment_body(body),
        ]
    )


def post_review_comments(
    github_token: str,
    repo: str,
    pr_number: int,
    commit_sha: str,
    comments: list[InlineReviewComment],
    review_body: str,
) -> int:
    """Post review comments to the GitHub PR. Returns count of posted comments."""
    headers: dict[str, str] = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    if not comments:
        url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/reviews"
        review_data = {
            "commit_id": commit_sha,
            "body": review_body,
            "event": "COMMENT",
            "comments": [],
        }
        response = requests.post(url, headers=headers, json=review_data, timeout=30)
        if response.status_code in (200, 201):
            print("Posted summary review (no inline comments).")
        return 0

    # Fetch existing comments for dedup (paginated)
    existing_keys: set[str] = set()
    list_url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/comments"
    dedup_page = 1
    while True:
        list_response = requests.get(
            list_url, headers=headers, timeout=30, params={"per_page": 100, "page": dedup_page}
        )
        if list_response.status_code != 200:
            break
        page_comments = list_response.json()
        if not isinstance(page_comments, list) or not page_comments:
            break
        for comment in page_comments:
            if (
                isinstance(comment.get("path"), str)
                and isinstance(comment.get("line"), int)
                and isinstance(comment.get("body"), str)
            ):
                existing_keys.add(
                    _to_comment_dedupe_key(
                        comment["path"],
                        comment["line"],
                        comment.get("start_line"),
                        comment["body"],
                    )
                )
        if len(page_comments) < 100:
            break
        dedup_page += 1

    # Filter out duplicates
    comments_to_post = [
        c for c in comments if _to_comment_dedupe_key(c.path, c.line, c.start_line, c.body) not in existing_keys
    ]

    if not comments_to_post:
        print("All comments are duplicates of existing reviews. Skipping.")
        return 0

    # Post the review
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/reviews"
    review_data: dict[str, Any] = {
        "commit_id": commit_sha,
        "body": review_body,
        "event": "COMMENT",
        "comments": [
            {
                "path": c.path,
                "line": c.line,
                "side": "RIGHT",
                **(
                    {"start_line": c.start_line, "start_side": "RIGHT"}
                    if isinstance(c.start_line, int) and c.start_line < c.line
                    else {}
                ),
                "body": c.body,
            }
            for c in comments_to_post
        ],
    }

    response = requests.post(url, headers=headers, json=review_data, timeout=30)

    if response.status_code in (200, 201):
        print(f"Posted review with {len(comments_to_post)} inline comments.")
        return len(comments_to_post)
    else:
        print(f"Failed to post review: {response.status_code}")
        print(response.text)
        return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    """Main entry point."""
    try:
        _main()
    except SystemExit:
        raise
    except Exception as exc:
        print(f"FATAL: {exc}")
        # Write error to step summary if available
        step_summary = os.getenv("GITHUB_STEP_SUMMARY")
        if step_summary:
            Path(step_summary).write_text(
                f"## CCR Review Failed\n\n```\n{exc}\n```\n", encoding="utf-8"
            )
        sys.exit(1)


def _main() -> None:
    """Core logic, wrapped by main() for error handling."""
    # --- GitHub context ---
    github_token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("GITHUB_REPOSITORY")
    pr_number_str = os.getenv("PR_NUMBER", "0")
    commit_sha = os.getenv("COMMIT_SHA")

    try:
        pr_number = int(pr_number_str)
    except ValueError:
        pr_number = 0

    if not all([github_token, repo, pr_number, commit_sha]):
        print("Missing required environment variables")
        print(f"  GITHUB_TOKEN: {'ok' if github_token else 'MISSING'}")
        print(f"  GITHUB_REPOSITORY: {repo or 'MISSING'}")
        print(f"  PR_NUMBER: {pr_number or 'MISSING'}")
        print(f"  COMMIT_SHA: {commit_sha or 'MISSING'}")
        sys.exit(1)

    # --- Settings ---
    architecture = os.getenv("ARCHITECTURE", "single-pass")
    prompt_root = os.getenv("PROMPT_ROOT", "prompts")
    max_files = int(os.getenv("CCR_MAX_FILES", str(DEFAULT_MAX_FILES)))
    max_inline = int(os.getenv("CCR_MAX_INLINE_COMMENTS", str(DEFAULT_MAX_INLINE_COMMENTS)))
    max_context_chars = int(os.getenv("MAX_CONTEXT_CHARS", str(DEFAULT_MAX_CONTEXT_CHARS)))
    post_inline = os.getenv("POST_INLINE_COMMENTS", "true").lower() in ("true", "1", "yes")

    print(f"Reviewing PR #{pr_number} in {repo}")
    print(f"Architecture: {architecture}")

    # --- Load ASU config ---
    config = load_asu_config()
    print(f"ASU model: {config.model}")

    # --- Fetch changed files ---
    files = get_changed_files(github_token, repo, pr_number)
    print(f"Found {len(files)} changed files")

    if not files:
        print("No files to review")
        return

    code_files = filter_code_files(files)[:max_files]
    if not code_files:
        print("No code files to review")
        return

    print(f"Reviewing {len(code_files)} code files")

    # --- Run architecture engine ---
    print("Running review...")
    raw_response = run_engine(config, architecture, code_files, max_context_chars, prompt_root)

    # --- Parse findings ---
    findings = parse_findings(raw_response)
    print(f"Generated {len(findings)} findings")

    # --- Build review body (summary for Conversation tab) ---
    review_body_lines = [
        "## CCR Review",
        "",
        f"Reviewed **{len(code_files)} file(s)** using the {architecture} architecture.",
    ]

    if findings:
        review_body_lines.append(f"Found **{len(findings)} item(s)** worth a closer look:")
        review_body_lines.append("")
        for f in findings[:5]:
            clean_body = _SEVERITY_PREFIX_RE.sub("", f.body.strip())
            # First sentence only, for the summary
            first_sentence = re.split(r"(?<=[.!?])\s", clean_body, maxsplit=1)[0]
            location = f"`{f.path}:{f.line}`"
            review_body_lines.append(f"- {location} — {first_sentence}")
        if len(findings) > 5:
            review_body_lines.append(f"- …and {len(findings) - 5} more")
    else:
        review_body_lines.append("Nothing stood out — looks good!")

    review_body = "\n".join(review_body_lines)

    # --- Post inline comments ---
    posted = 0
    if post_inline:
        inline_comments = build_inline_comments(findings, code_files, max_inline)
        print(f"Built {len(inline_comments)} inline comments")
        posted = post_review_comments(
            github_token, repo, pr_number, commit_sha, inline_comments, review_body
        )
    else:
        # Post summary-only review
        post_review_comments(github_token, repo, pr_number, commit_sha, [], review_body)

    print(f"Posted {posted} inline comments")

    # --- Write CCR.md report ---
    report_lines = [
        "# CCR.md",
        "",
        "## Summary",
        f"Architecture: {architecture}",
        f"Files reviewed: {len(code_files)}",
        f"Total findings: {len(findings)}",
        "",
    ]

    if findings:
        report_lines.append("## Findings")
        for finding in findings:
            clean_body = _SEVERITY_PREFIX_RE.sub("", finding.body.strip())
            report_lines.append(f"### `{finding.path}:{finding.line}`")
            report_lines.append(clean_body)
            report_lines.append("")
    else:
        report_lines.append("## Findings")
        report_lines.append("No issues found.")

    report_path = Path("CCR.md")
    report_path.write_text("\n".join(report_lines), encoding="utf-8")
    print(f"Report written to {report_path.resolve()}")

    # --- Write GitHub Step Summary ---
    step_summary = os.getenv("GITHUB_STEP_SUMMARY")
    if step_summary:
        summary_path = Path(step_summary)
        summary_path.write_text(review_body, encoding="utf-8")

    print("Review complete!")


if __name__ == "__main__":
    main()
