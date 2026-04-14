<!--
  GUARD FILE — Do not edit. This file is automatically injected after the single-pass stage prompt.
  Output format and field rules for single-pass architecture mode.
-->

## Output Format

Return a single JSON object — no Markdown fences, no surrounding prose.

### JSON Schema

```json
{
  "summary": "Brief description of what the PR does and which learner-facing systems it affects.",
  "riskLevel": "low | medium | high",
  "findings": [
    {
      "severity": "low | medium | high",
      "title": "Short label for the issue",
      "detail": "1-2 short, conversational sentences explaining what you noticed and why it matters",
      "file": "exact file path from the diff (required)",
      "line": 42,
      "endLine": 45,
      "recommendation": "Brief suggestion phrased as a question or friendly observation"
    }
  ],
  "todos": ["Follow-up action items for the PR author"],
  "notes": ["Any additional context, edge cases, or questions"]
}
```

### Field Rules

- `summary`: What the PR does and which learner-facing systems it affects.
- `riskLevel`: `low` = no warnings or flags, `medium` = warnings present, `high` = one or more flags must be resolved before merge.
- `findings`: One entry per WARNING or FLAG from the criteria review. Each finding **MUST** include:
  - `file`: Exact path from the diff input (required — never omit).
  - `line`: Integer line number in the new file, pointing to an added or changed line (required — never omit).
  - `endLine`: Optional — use when a finding spans a block of lines.
  - `severity`: Map WARNING → `medium`, FLAG → `high`, minor suggestions → `low`. This goes in the severity field only — **never** include it as a prefix like [HIGH] in the body text.
  - `recommendation`: Brief, conversational suggestion phrased as a question or observation.
- `todos`: Action items for the PR author.
- `notes`: Additional context, edge cases, or follow-up questions.
