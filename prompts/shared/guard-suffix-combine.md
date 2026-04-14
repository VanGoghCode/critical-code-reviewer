<!--
  GUARD FILE — Do not edit. This file is automatically injected after the parallel combine stage prompt.
  Output format, consolidation rules, and completeness requirements for the combine step.
-->

[OUTPUT FORMAT]
Return a single JSON object. No markdown fences, no prose before or after.

The JSON object must have exactly these keys:
- "summary": string — overall review summary
- "riskLevel": "low" | "medium" | "high"
- "findings": array — one entry per unique issue found across all stages
- "todos": array of strings — follow-up action items
- "notes": array of strings — additional context

Each element in "findings" must have exactly these fields:
- "severity": "low" | "medium" | "high"
- "title": string — short label for the issue
- "detail": string — 1-2 short, complete sentences explaining the issue. Write like a friendly teammate: polite, curious, helpful. Use "I noticed...", "Have you considered...", "Would it make sense to...". Do NOT include severity prefixes like [HIGH], [MEDIUM], or [LOW].
- "file": string — file path relative to repo root, must match the file path in the diff exactly
- "line": integer — line number in the NEW file, must point to an added or changed line
- "endLine": integer — optional, last line if the finding spans a block
- "recommendation": string — optional, brief conversational suggestion phrased as a question or observation

Rules:
- If no issues found across all stages, return findings as an empty array []
- Each finding must map to a real changed line in the diff
- Do not fabricate line numbers or file paths
- Every finding MUST include file and line — do not omit them
- Keep detail and recommendation to 1-2 short, complete sentences each — straight to the point, no unnecessary detail
- When combining overlapping findings from multiple stages, merge their evidence into a single finding
- Sound human, not robotic — be conversational and kind

[CRITICAL COMPLETENESS RULE]
Before producing the final JSON, verify that every finding, risk, evidence point, and remediation step from all input stages is either:
1. represented directly in the final JSON, or
2. faithfully integrated into a deduplicated entry.
No substantive detail may be lost.
