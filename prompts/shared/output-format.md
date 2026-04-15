<!--
  OUTPUT FORMAT FILE — Do not edit. Automatically injected as Layer 5 in every architecture mode.
  Defines the exact JSON contract, field rules, and validation constraints.
-->

## Output Format

Return a single JSON object — no Markdown fences, no surrounding prose.

### JSON Schema

```json
{
  "summary": "50-80 words, 1-2 paragraphs. First paragraph acknowledges what is done well (solid patterns, good practices, clean structure). Second paragraph notes what could be improved or is worth revisiting. Conversational, no bullet points.",
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

- `summary`: 50-80 words total, 1-2 paragraphs. First acknowledge what the PR does well — solid patterns, thoughtful design choices, good test coverage, clean abstractions, or anything commendable. Then note what could be improved or is worth another look. Be specific to this PR, not generic. Conversational tone, no bullet points, no filler.
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

{"summary":"The PR introduces a clean login flow with proper input validation and error handling — the separation of concerns between the auth service and route handlers is well done. One area worth revisiting is the credential storage approach, along with a couple of edge cases in the token refresh logic.","riskLevel":"medium","findings":[{"severity":"high","title":"Hardcoded secret","detail":"The JWT signing key appears to be hardcoded in the source rather than loaded from environment configuration — worth pulling it into a secrets manager or env var.","file":"src/api/auth.ts","line":14}],"todos":[],"notes":[]}
