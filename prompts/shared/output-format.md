<!--
  OUTPUT FORMAT FILE — Do not edit. Automatically injected as Layer 5 in every architecture mode.
  Defines the exact JSON contract, field rules, and validation constraints.
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
      "detail": "20-40 words, conversational, complete sentences, no truncation. Includes core issue and optional suggestion (max 60 words total)",
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
- `findings`: One entry per issue found. Each finding **MUST** include:
  - `file`: Exact path from the diff input (required — never omit).
  - `line`: Integer line number in the new file, pointing to an added or changed line (required — never omit).
  - `endLine`: Optional — use when a finding spans a block of lines.
  - `severity`: "low" | "medium" | "high". This goes in the severity field only — never include it as a prefix in the text.
  - `recommendation`: Brief, conversational suggestion phrased as a question or observation.
- `todos`: Action items for the PR author.
- `notes`: Additional context, edge cases, or follow-up questions.

### Validation Rules

- If no issues found, return findings as an empty array [].
- Each finding must map to a real changed line in the diff.
- Do not fabricate line numbers or file paths.
- Use reviewContext.commitMessages to understand intent and flag mismatches.
- If previousOutputsParsed is present, use it as the authoritative previous-stage context.

### Example

{"summary":"Adds login flow","riskLevel":"medium","findings":[{"severity":"high","title":"Hardcoded secret","detail":"I noticed the JWT secret is hardcoded in source — have you considered loading it from an environment variable instead?","file":"src/api/auth.ts","line":14}],"todos":[],"notes":[]}
