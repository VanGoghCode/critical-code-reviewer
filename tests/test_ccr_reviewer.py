"""Tests for ccr_reviewer.py — ported from TypeScript test suite."""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure scripts/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import ccr_reviewer as ccr


# ---------------------------------------------------------------------------
# Patch parsing tests
# ---------------------------------------------------------------------------


class TestParseUnifiedDiffPatch:
    """Ported from tests/patch-map.test.ts"""

    def test_empty_patch(self) -> None:
        result = ccr.parse_unified_diff_patch("")
        assert result.hunks == []
        assert result.changed_lines == []

    def test_whitespace_only_patch(self) -> None:
        result = ccr.parse_unified_diff_patch("   \n  \n")
        assert result.hunks == []

    def test_single_hunk_added_lines(self) -> None:
        patch = (
            "@@ -1,3 +1,5 @@\n"
            " unchanged\n"
            "+added line 1\n"
            "+added line 2\n"
            " unchanged 2\n"
        )
        result = ccr.parse_unified_diff_patch(patch)
        assert len(result.hunks) == 1
        assert result.changed_lines == [2, 3]
        assert result.changed_line_content_by_line[2] == "added line 1"
        assert result.changed_line_content_by_line[3] == "added line 2"

    def test_mixed_add_remove_context(self) -> None:
        patch = (
            "@@ -10,4 +10,4 @@\n"
            " context line\n"
            "-removed line\n"
            "+added line\n"
            " more context\n"
        )
        result = ccr.parse_unified_diff_patch(patch)
        assert result.changed_lines == [11]
        assert result.changed_line_content_by_line[11] == "added line"

    def test_multiple_hunks(self) -> None:
        patch = (
            "@@ -1,3 +1,4 @@\n"
            " a\n"
            "+b\n"
            " c\n"
            "@@ -10,3 +11,4 @@\n"
            " d\n"
            "+e\n"
            " f\n"
        )
        result = ccr.parse_unified_diff_patch(patch)
        assert len(result.hunks) == 2
        assert result.changed_lines == [2, 12]

    def test_no_plus_header_confusion(self) -> None:
        """Lines starting with +++ should not be counted as added."""
        patch = (
            "--- a/file.txt\n"
            "+++ b/file.txt\n"
            "@@ -1,2 +1,3 @@\n"
            " old\n"
            "+new\n"
            " old2\n"
        )
        result = ccr.parse_unified_diff_patch(patch)
        assert result.changed_lines == [2]

    def test_no_minus_header_confusion(self) -> None:
        """Lines starting with --- should not be counted as removed."""
        patch = (
            "--- a/file.txt\n"
            "+++ b/file.txt\n"
            "@@ -1,2 +1,3 @@\n"
            " old\n"
            "+new\n"
        )
        result = ccr.parse_unified_diff_patch(patch)
        assert result.changed_lines == [2]


# ---------------------------------------------------------------------------
# Line resolution tests
# ---------------------------------------------------------------------------


class TestResolveChangedLine:
    """Ported from tests/patch-map.test.ts"""

    def _make_patch_map(self, lines: dict[int, str]) -> ccr.ParsedPatchMap:
        return ccr.ParsedPatchMap(
            hunks=[],
            changed_lines=sorted(lines.keys()),
            changed_line_content_by_line=lines,
        )

    def test_exact_match(self) -> None:
        pm = self._make_patch_map({10: "foo()", 20: "bar()"})
        assert ccr.resolve_changed_line(pm, requested_line=10) == 10

    def test_closest_line_fallback(self) -> None:
        pm = self._make_patch_map({10: "foo()", 20: "bar()"})
        assert ccr.resolve_changed_line(pm, requested_line=15) in (10, 20)

    def test_search_text_exact_substring(self) -> None:
        pm = self._make_patch_map({10: "def authenticate(user):", 20: "return True"})
        result = ccr.resolve_changed_line(pm, search_text="authenticate")
        assert result == 10

    def test_no_fallback_returns_none(self) -> None:
        pm = self._make_patch_map({10: "foo()"})
        assert ccr.resolve_changed_line(pm, search_text="xyz", allow_fallback=False) is None

    def test_empty_patch_returns_none(self) -> None:
        pm = ccr.ParsedPatchMap()
        assert ccr.resolve_changed_line(pm, requested_line=10) is None


# ---------------------------------------------------------------------------
# JSON extraction tests
# ---------------------------------------------------------------------------


class TestExtractJsonCandidate:

    def test_bare_array(self) -> None:
        text = '[{"path": "a.py", "line": 1, "body": "x", "severity": "info"}]'
        result = ccr.extract_json_candidate(text)
        assert json.loads(result)

    def test_fenced_json(self) -> None:
        text = '```json\n[{"path": "a.py", "line": 1, "body": "x", "severity": "info"}]\n```'
        result = ccr.extract_json_candidate(text)
        assert json.loads(result)

    def test_fenced_no_language(self) -> None:
        text = '```\n[{"path": "a.py", "line": 1, "body": "x", "severity": "info"}]\n```'
        result = ccr.extract_json_candidate(text)
        assert json.loads(result)

    def test_embedded_in_prose(self) -> None:
        text = 'Here are the findings:\n[{"path": "a.py", "line": 1, "body": "x", "severity": "info"}]\nDone.'
        result = ccr.extract_json_candidate(text)
        assert json.loads(result)

    def test_empty_array(self) -> None:
        text = "[]"
        result = ccr.extract_json_candidate(text)
        assert json.loads(result) == []


# ---------------------------------------------------------------------------
# Finding parsing tests
# ---------------------------------------------------------------------------


class TestParseFindings:

    def test_valid_array(self) -> None:
        response = json.dumps([
            {"path": "src/main.py", "line": 10, "body": "issue here", "severity": "warning"},
            {"path": "src/util.py", "line": 5, "body": "minor thing", "severity": "info"},
        ])
        findings = ccr.parse_findings(response)
        assert len(findings) == 2
        assert findings[0].path == "src/main.py"
        assert findings[0].line == 10
        assert findings[0].severity == "warning"
        assert findings[1].severity == "info"

    def test_empty_array(self) -> None:
        findings = ccr.parse_findings("[]")
        assert findings == []

    def test_fenced_response(self) -> None:
        response = '```json\n[{"path": "a.py", "line": 1, "body": "x", "severity": "info"}]\n```'
        findings = ccr.parse_findings(response)
        assert len(findings) == 1

    def test_object_with_issues_key(self) -> None:
        response = json.dumps({
            "issues": [
                {"path": "a.py", "line": 1, "body": "x", "severity": "warning"}
            ]
        })
        findings = ccr.parse_findings(response)
        assert len(findings) == 1

    def test_object_with_findings_key(self) -> None:
        response = json.dumps({
            "findings": [
                {"path": "a.py", "line": 1, "body": "x", "severity": "concern"}
            ]
        })
        findings = ccr.parse_findings(response)
        assert len(findings) == 1

    def test_invalid_json_returns_empty(self) -> None:
        findings = ccr.parse_findings("not json at all")
        assert findings == []

    def test_skips_items_without_path_or_line(self) -> None:
        response = json.dumps([
            {"line": 1, "body": "x", "severity": "info"},  # missing path
            {"path": "a.py", "body": "x", "severity": "info"},  # missing line
            {"path": "a.py", "line": 0, "body": "x", "severity": "info"},  # line=0
        ])
        findings = ccr.parse_findings(response)
        assert findings == []

    def test_string_line_coerced_to_int(self) -> None:
        response = json.dumps([
            {"path": "a.py", "line": "42", "body": "x", "severity": "info"}
        ])
        findings = ccr.parse_findings(response)
        assert len(findings) == 1
        assert findings[0].line == 42


# ---------------------------------------------------------------------------
# Inline comment building tests
# ---------------------------------------------------------------------------


class TestBuildInlineComments:

    def _make_files(self, patches: dict[str, str]) -> list[ccr.PRFile]:
        return [
            ccr.PRFile(filename=name, status="modified", patch=patch, additions=5, deletions=2)
            for name, patch in patches.items()
        ]

    def test_no_findings(self) -> None:
        files = self._make_files({"a.py": "@@ -1 +1 @@\n+new\n"})
        assert ccr.build_inline_comments([], files) == []

    def test_finding_mapped_to_changed_line(self) -> None:
        patch = "@@ -1,3 +1,4 @@\n context\n+added line\n context\n"
        files = self._make_files({"src/a.py": patch})
        findings = [ccr.Finding(path="src/a.py", line=2, body="issue", severity="warning")]
        comments = ccr.build_inline_comments(findings, files, max_comments=5)
        assert len(comments) >= 1
        assert comments[0].path == "src/a.py"
        assert comments[0].line == 2

    def test_dedup(self) -> None:
        patch = "@@ -1 +1,3 @@\n+line1\n+line2\n"
        files = self._make_files({"a.py": patch})
        findings = [
            ccr.Finding(path="a.py", line=1, body="same issue", severity="warning"),
            ccr.Finding(path="a.py", line=1, body="same issue", severity="warning"),
        ]
        comments = ccr.build_inline_comments(findings, files, max_comments=10)
        # Should deduplicate
        assert len(comments) == 1

    def test_respects_max_comments(self) -> None:
        patch = "@@ -1 +1,6 @@\n+line1\n+line2\n+line3\n+line4\n+line5\n"
        files = self._make_files({"a.py": patch})
        findings = [
            ccr.Finding(path="a.py", line=i, body=f"issue {i}", severity="warning")
            for i in range(1, 6)
        ]
        comments = ccr.build_inline_comments(findings, files, max_comments=2)
        assert len(comments) <= 2

    def test_file_coverage_ensures_one_per_file(self) -> None:
        patch_a = "@@ -1 +1,2 @@\n+a\n"
        patch_b = "@@ -1 +1,2 @@\n+b\n"
        files = self._make_files({"a.py": patch_a, "b.py": patch_b})
        findings = [
            ccr.Finding(path="a.py", line=1, body="issue in a", severity="info"),
            ccr.Finding(path="b.py", line=1, body="issue in b", severity="info"),
        ]
        comments = ccr.build_inline_comments(findings, files, max_comments=10)
        paths = {c.path for c in comments}
        assert "a.py" in paths
        assert "b.py" in paths

    def test_severity_sorting(self) -> None:
        patch = "@@ -1 +1,4 @@\n+line1\n+line2\n+line3\n"
        files = self._make_files({"a.py": patch})
        findings = [
            ccr.Finding(path="a.py", line=1, body="info", severity="info"),
            ccr.Finding(path="a.py", line=2, body="concern", severity="concern"),
            ccr.Finding(path="a.py", line=3, body="warning", severity="warning"),
        ]
        comments = ccr.build_inline_comments(findings, files, max_comments=3)
        assert comments[0].severity == "concern"


# ---------------------------------------------------------------------------
# ASU provider tests
# ---------------------------------------------------------------------------


class TestAsuProvider:

    def test_parse_asu_response_response_field(self) -> None:
        raw = json.dumps({"response": "hello world"})
        assert ccr._parse_asu_response(raw) == "hello world"

    def test_parse_asu_response_output_field(self) -> None:
        raw = json.dumps({"output": "test output"})
        assert ccr._parse_asu_response(raw) == "test output"

    def test_parse_asu_response_choices(self) -> None:
        raw = json.dumps({"choices": [{"message": {"content": "from choices"}}]})
        assert ccr._parse_asu_response(raw) == "from choices"

    def test_parse_asu_response_nested_response(self) -> None:
        raw = json.dumps({"response": {"content": "nested"}})
        assert ccr._parse_asu_response(raw) == "nested"

    def test_parse_asu_response_unknown_format_raises(self) -> None:
        with pytest.raises(ValueError, match="Unexpected ASU response"):
            ccr._parse_asu_response('{"foo": "bar"}')

    def test_load_asu_config_missing_key(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(SystemExit):
                ccr.load_asu_config()

    def test_load_asu_config_defaults(self) -> None:
        with patch.dict(os.environ, {"ASU_API_KEY": "test", "ASU_MODEL": "gpt5_2"}):
            config = ccr.load_asu_config()
            assert config.api_key == "test"
            assert config.model == "gpt5_2"
            assert config.base_url == ccr.DEFAULT_ASU_BASE_URL
            assert config.model_provider == ccr.DEFAULT_ASU_MODEL_PROVIDER
            assert config.temperature == ccr.DEFAULT_ASU_TEMPERATURE

    def test_load_asu_config_bad_temperature_falls_back(self) -> None:
        with patch.dict(os.environ, {"ASU_API_KEY": "test", "ASU_MODEL": "gpt5_2", "ASU_TEMPERATURE": "abc"}):
            config = ccr.load_asu_config()
            assert config.temperature == ccr.DEFAULT_ASU_TEMPERATURE

    def test_load_asu_config_bad_timeout_falls_back(self) -> None:
        with patch.dict(os.environ, {"ASU_API_KEY": "test", "ASU_MODEL": "gpt5_2", "ASU_TIMEOUT_MS": "xyz"}):
            config = ccr.load_asu_config()
            assert config.timeout_ms == ccr.DEFAULT_ASU_TIMEOUT_MS

    @patch("ccr_reviewer.requests.post")
    def test_call_asu_builds_correct_payload(self, mock_post: MagicMock) -> None:
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.text = json.dumps({"response": "LLM output"})
        mock_post.return_value = mock_response

        config = ccr.AsuConfig(
            api_key="key123",
            base_url="https://api.example.com/query",
            model="gpt5_2",
            model_provider="openai",
            temperature=0.2,
            timeout_ms=120000,
        )

        result = ccr.call_asu(config, "system prompt", "user prompt")
        assert result == "LLM output"

        call_args = mock_post.call_args
        body = call_args.kwargs["json"]
        assert body["action"] == "query"
        assert body["request_source"] == "override_params"
        assert body["query"] == "user prompt"
        assert body["model_name"] == "gpt5_2"
        assert body["model_params"]["temperature"] == 0.2
        assert body["model_params"]["system_prompt"] == "system prompt"
        assert body["model_provider"] == "openai"


# ---------------------------------------------------------------------------
# Manifest loading tests
# ---------------------------------------------------------------------------


class TestManifestLoading:

    def test_load_single_pass_manifest(self) -> None:
        root = Path(__file__).resolve().parent.parent
        manifest_path = root / "prompts" / "architectures" / "single-pass" / "manifest.json"
        if not manifest_path.exists():
            pytest.skip("single-pass manifest not found")

        with tempfile.TemporaryDirectory() as tmpdir:
            prompt_dir = Path(tmpdir) / "prompts" / "architectures" / "single-pass"
            prompt_dir.mkdir(parents=True)
            manifest_path_tmp = prompt_dir / "manifest.json"
            manifest_path_tmp.write_text(manifest_path.read_text())

            # Create the prompt file
            prompt_file = Path(tmpdir) / "prompts" / "architectures" / "single-pass" / "prompt.md"
            prompt_file.write_text("test prompt")

            with patch.object(ccr, "_find_repo_root", return_value=Path(tmpdir)):
                manifest = ccr.load_manifest("single-pass", "prompts")
                assert manifest.id == "single-pass"
                assert manifest.mode == "single"
                assert len(manifest.stages) == 1

    def test_load_parallel_manifest(self) -> None:
        root = Path(__file__).resolve().parent.parent
        manifest_path = root / "prompts" / "architectures" / "parallel" / "manifest.json"
        if not manifest_path.exists():
            pytest.skip("parallel manifest not found")

        data = json.loads(manifest_path.read_text())
        assert data["mode"] == "parallel"
        assert len(data["stages"]) == 6
        assert "combineStage" in data


# ---------------------------------------------------------------------------
# Output format contract tests
# ---------------------------------------------------------------------------


class TestOutputFormatContract:
    """Verify the JSON output matches the checklist contract."""

    def test_valid_contract_format(self) -> None:
        response = json.dumps([
            {
                "path": "src/example.ts",
                "line": 42,
                "body": "**Warning**\n\nExplain the issue.",
                "severity": "warning",
            }
        ])
        findings = ccr.parse_findings(response)
        assert len(findings) == 1
        f = findings[0]
        assert isinstance(f.path, str)
        assert isinstance(f.line, int) and f.line > 0
        assert isinstance(f.body, str)
        assert f.severity in ("info", "warning", "concern")

    def test_conversational_contract_format(self) -> None:
        """New expected format: conversational body, no severity prefix."""
        response = json.dumps([
            {
                "path": "src/example.ts",
                "line": 42,
                "body": "I noticed this validation rejects non-ASCII names — have you considered unicode-aware validation?",
                "severity": "warning",
            }
        ])
        findings = ccr.parse_findings(response)
        assert len(findings) == 1
        f = findings[0]
        assert f.body.startswith("I noticed")
        assert "[" not in f.body  # no severity prefix

    def test_empty_review_contract(self) -> None:
        findings = ccr.parse_findings("[]")
        assert findings == []

    def test_severity_values(self) -> None:
        for sev in ("info", "warning", "concern"):
            response = json.dumps([{"path": "a.py", "line": 1, "body": "x", "severity": sev}])
            findings = ccr.parse_findings(response)
            assert findings[0].severity == sev


# ---------------------------------------------------------------------------
# User prompt builder tests
# ---------------------------------------------------------------------------


class TestBuildUserPrompt:

    def test_includes_framework(self) -> None:
        files = [ccr.PRFile("a.py", "modified", "@@ -1 +1 @@\n+x\n", 1, 0)]
        prompt = ccr.build_user_prompt("Look for bias", files)
        assert "Look for bias" in prompt

    def test_includes_file_diff(self) -> None:
        files = [ccr.PRFile("src/main.py", "modified", "@@ -1 +1 @@\n+new code\n", 1, 0)]
        prompt = ccr.build_user_prompt("Review", files)
        assert "src/main.py" in prompt
        assert "new code" in prompt

    def test_includes_output_format(self) -> None:
        files = [ccr.PRFile("a.py", "modified", "@@ -1 +1 @@\n+x\n", 1, 0)]
        prompt = ccr.build_user_prompt("Review", files)
        assert "path" in prompt
        assert "severity" in prompt
        assert '"info"' in prompt or "info" in prompt

    def test_includes_previous_outputs(self) -> None:
        files = [ccr.PRFile("a.py", "modified", "@@ -1 +1 @@\n+x\n", 1, 0)]
        prompt = ccr.build_user_prompt("Review", files, previous_outputs=["stage 1 output"])
        assert "stage 1 output" in prompt


# ---------------------------------------------------------------------------
# Review body tests
# ---------------------------------------------------------------------------


class TestReviewBody:

    def test_severity_prefix_stripped_from_body(self) -> None:
        stripped = ccr._SEVERITY_PREFIX_RE.sub("", "[HIGH] something bad")
        assert stripped == "something bad"

    def test_severity_prefix_case_insensitive(self) -> None:
        stripped = ccr._SEVERITY_PREFIX_RE.sub("", "[medium] issue here")
        assert stripped == "issue here"

    def test_no_severity_prefix_unchanged(self) -> None:
        stripped = ccr._SEVERITY_PREFIX_RE.sub("", "I noticed something odd here")
        assert stripped == "I noticed something odd here"

    def test_all_severity_prefixes_stripped(self) -> None:
        for prefix in ["HIGH", "MEDIUM", "LOW", "INFO", "WARNING", "CONCERN", "CRITICAL"]:
            stripped = ccr._SEVERITY_PREFIX_RE.sub("", f"[{prefix}] test")
            assert stripped == "test"

    def test_severity_prefix_with_leading_whitespace(self) -> None:
        stripped = ccr._SEVERITY_PREFIX_RE.sub("", "  [HIGH] trimmed")
        assert stripped == "trimmed"

    def test_inline_comment_strips_severity_prefix(self) -> None:
        """build_inline_comments must strip [HIGH] from the body of posted comments."""
        patch = "@@ -1,3 +1,4 @@\n context\n+added line\n context\n"
        files = [ccr.PRFile("src/a.py", "modified", patch, 5, 2)]
        findings = [ccr.Finding(
            path="src/a.py", line=2,
            body="[HIGH] I noticed a privacy concern here",
            severity="concern",
        )]
        comments = ccr.build_inline_comments(findings, files, max_comments=5)
        assert len(comments) >= 1
        assert not comments[0].body.startswith("[")
        assert "I noticed a privacy concern here" in comments[0].body

    def test_long_body_not_truncated_at_old_limit(self) -> None:
        """Bodies longer than 300 chars (old limit) should not be truncated."""
        long_body = "I noticed this validation might cause issues. " * 10  # ~480 chars
        patch = "@@ -1,3 +1,4 @@\n context\n+added line\n context\n"
        files = [ccr.PRFile("src/a.py", "modified", patch, 5, 2)]
        findings = [ccr.Finding(path="src/a.py", line=2, body=long_body, severity="warning")]
        comments = ccr.build_inline_comments(findings, files, max_comments=5)
        assert len(comments) >= 1
        assert len(comments[0].body) > 300

    def test_system_prompt_has_tone_instructions(self) -> None:
        assert "polite" in ccr.SYSTEM_PROMPT.lower()
        assert "curious" in ccr.SYSTEM_PROMPT.lower()
        assert "helpful" in ccr.SYSTEM_PROMPT.lower()
        assert "[HIGH]" in ccr.SYSTEM_PROMPT  # explicitly banned

    def test_output_format_has_tone_instructions(self) -> None:
        prompt = ccr.OUTPUT_FORMAT_PROMPT.lower()
        assert "conversational" in prompt
        assert "i noticed" in prompt
        assert "have you considered" in prompt
        assert "[high]" in prompt  # explicitly banned in body

    def test_output_format_example_is_conversational(self) -> None:
        """The example body in OUTPUT_FORMAT_PROMPT should use conversational style."""
        assert "I noticed" in ccr.OUTPUT_FORMAT_PROMPT
        # Should NOT contain the old bold-label style
        assert "**Warning**" not in ccr.OUTPUT_FORMAT_PROMPT
