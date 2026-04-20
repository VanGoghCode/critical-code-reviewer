<!--
  OUTPUT FORMAT FILE — Do not edit. Automatically injected as Layer 5 in every architecture mode.
  Defines the exact JSON contract, field rules, and validation constraints.
-->

## Output Format

Return a single JSON object — no Markdown fences, no surrounding prose.

### JSON Schema

```json
{
  "summary": "80-140 words, plainspoken, one or two short paragraphs. Mention one concrete strength, then 1-2 highest-priority risks, who is impacted, and how. Include at least one reflective question that starts with 'Have you thought about' or 'When implementing this, have you thought about'. Conversational, no bullet points, no filler.",
  "riskLevel": "low | medium | high",
  "findings": [
    {
      "severity": "low | medium | high",
      "title": "Associated criterion name only (for example: Fairness, Missing Consent Checks for Learner Data, Opaque AI Decision Outputs)",
      "detail": "30-55 words, conversational, 2-3 complete sentences. Explain the concrete issue, then explain why it matters, who it impacts, and how. Name specific people (for example: a student, a teacher, a parent, a Black student), never generic 'user(s)'.",
      "file": "exact file path from the diff (required)",
      "line": 42,
      "recommendation": "Small logic suggestion in one plain but polite sentence (15-25 words), no label prefix, followed by a CCR reference link on a new line: 📎 [CRIT-X.Y](ccr-framework.md#crit-x-y)"
    }
  ],
  "todos": ["Follow-up action items for the PR author"],
  "notes": ["1-3 reflective assumption-check questions or edge cases (for example: Have you thought about...) using specific stakeholders, not generic users"]
}
```

### Field Rules

- `summary`: 80-140 words total, one or two short paragraphs. Note one concrete strength, then one or two high-priority risks with stakeholder-specific impact. Include at least one reflective question using: `Have you thought about...` or `When implementing this, have you thought about...`.
- `riskLevel`: `low` = no warnings or flags, `medium` = warnings present, `high` = one or more flags must be resolved before merge.
- `findings`: One entry per issue found. Each finding **MUST** include:
  - `title`: The associated framework criterion name (or closest criterion family). Do not use generic issue labels.
  - `detail`: 30-55 words, complete sentences. Include both issue evidence and impact (why it matters, who is affected, and how).
  - Use specific stakeholder language: `a student`, `a teacher`, `a parent`, `a counselor`, `a Black student`, `an English-learner student`, etc.
  - Never use generic `user` or `users` in summary, detail, recommendation, todos, or notes.
  - `file`: Exact path from the diff input (required — never omit).
  - `line`: Integer line number in the new file, pointing to an added or changed line (required — never omit).
  - `severity`: "low" | "medium" | "high". This goes in the severity field only — never include it as a prefix in the text.
  - `recommendation`: One small logic suggestion in plain but polite language, no label prefix, followed by a CCR reference link on a new line in the format: `📎 [CRIT-X.Y · Criterion Name](ccr-framework.md#crit-x-y)` where X.Y matches the criterion ID from the framework.
- `todos`: Action items for the PR author.
- `notes`: 1-3 reflective, assumption-checking questions (or edge cases), preferably phrased as teammate prompts.

### Inline Comment Shape (for posted inline PR comments)

Runtime posts each inline comment as:

1. `title` (criterion name)
2. `detail` (issue + impact)
3. `recommendation` (small logic suggestion)

Do not add in-text headings such as "Why this matters:" or "Suggestion:".

### Main Review Body Shape (conversation comment)

Runtime posts one broader main review comment that combines:

1. `summary` (high-level strengths + risks + stakeholder impact)
2. Top high-severity findings in the same 3-line structure used by inline comments
3. Reflective assumption-check questions (from `notes` when available)

### Validation Rules

- If no issues found, return findings as an empty array [].
- Each finding must map to a real changed line in the diff.
- Do not fabricate line numbers or file paths.
- Use reviewContext.commitMessages to understand intent and flag mismatches.
- If previousOutputsParsed is present, use it as the authoritative previous-stage context.

### CCR Framework Reference

When adding a `recommendation` field to a finding, always append a CCR reference link that corresponds to the criterion being flagged. Use the exact criterion ID and name from this list:

**Valid CCR Criteria:**

- [CRIT-1.1 · Unrepresentative Dataset Coverage](ccr-framework.md#crit-1-1)
- [CRIT-1.2 · Undefined Fairness Evaluation Attributes](ccr-framework.md#crit-1-2)
- [CRIT-1.3 · Missing Group-Wise Fairness Targets](ccr-framework.md#crit-1-3)
- [CRIT-2.1 · Unvalidated Early-Warning Thresholds](ccr-framework.md#crit-2-1)
- [CRIT-2.2 · Persistent Negative State](ccr-framework.md#crit-2-2)
- [CRIT-2.3 · Hidden Learning Path Requirements](ccr-framework.md#crit-2-3)
- [CRIT-2.4 · Pedagogically Unconstrained Adaptation](ccr-framework.md#crit-2-4)
- [CRIT-3.1 · Protected and Proxy-Based Differential Treatment](ccr-framework.md#crit-3-1)
- [CRIT-3.2 · Unvalidated Fairness Mitigations](ccr-framework.md#crit-3-2)
- [CRIT-3.3 · Unenforced Protected-Attribute Separation](ccr-framework.md#crit-3-3)
- [CRIT-4.1 · Culturally Narrow Representations and Validation](ccr-framework.md#crit-4-1)
- [CRIT-4.2 · Exclusionary Language in Code and UI](ccr-framework.md#crit-4-2)
- [CRIT-4.3 · Excluding Access Assumptions](ccr-framework.md#crit-4-3)
- [CRIT-5.1 · Opaque AI Decision Outputs](ccr-framework.md#crit-5-1)
- [CRIT-5.2 · Causal Overclaiming in Analytics](ccr-framework.md#crit-5-2)
- [CRIT-5.3 · Mismatched Prediction Validation and Use](ccr-framework.md#crit-5-3)
- [CRIT-5.4 · Unidirectional Algorithmic Decisions Without Educator Contestability](ccr-framework.md#crit-5-4)
- [CRIT-5.5 · Automation Without Review Safeguards](ccr-framework.md#crit-5-5)
- [CRIT-6.1 · Missing Consent Checks for Learner Data](ccr-framework.md#crit-6-1)
- [CRIT-7.1 · Unenforced High-Risk AI Release Gates](ccr-framework.md#crit-7-1)
- [CRIT-7.2 · Missing Post-Deployment Risk Monitoring](ccr-framework.md#crit-7-2)
- [CRIT-7.3 · Missing Fairness Review for Student-Affecting Changes](ccr-framework.md#crit-7-3)
- [CRIT-7.4 · Missing Bias Review for AI-Assisted Code](ccr-framework.md#crit-7-4)
- [CRIT-7.5 · Missing Bias Regression Checks for AI-Generated Code](ccr-framework.md#crit-7-5)
- [CRIT-7.6 · Missing User-Need Traceability](ccr-framework.md#crit-7-6)
- [CRIT-7.7 · Untracked Fairness Mitigation Outcomes](ccr-framework.md#crit-7-7)

**Format:** End each recommendation with a new line containing: `📎 [CRIT-X.Y · Criterion Name](ccr-framework.md#crit-x-y)`

**Example:** 
```
"recommendation": "Authorize by token subject plus active consent state before returning learner alerts.\n📎 [CRIT-6.1 · Missing Consent Checks for Learner Data](ccr-framework.md#crit-6-1)"
```

### Example

{"summary":"The alert payloads and enums are organized cleanly, which will help a teacher interpret status categories consistently across screens. The highest-priority risk is path-based identity lookup on alert reads, because a student could potentially access another student's alert history if server checks trust route parameters over token subject claims. Have you thought about how an appeal workflow would handle a wrongly flagged student whose intervention history was exposed to the wrong teacher?","riskLevel":"medium","findings":[{"severity":"high","title":"Missing Consent Checks for Learner Data","detail":"The alerts request path is built from studentId, so if server authorization trusts that path over token subject claims, a student might retrieve another student's alert timeline. That can mislead a teacher's intervention decisions and expose sensitive records to the wrong parent.","file":"src/app/alerts/page.tsx","line":103,"recommendation":"Authorize by token subject plus active consent state before returning learner alerts.\n📎 [CRIT-6.1 · Missing Consent Checks for Learner Data](ccr-framework.md#crit-6-1)"}],"todos":[],"notes":["When implementing this endpoint, have you thought about how a counselor can contest or correct a false alert tied to the wrong student?"]}
