# Iterative Combine Stage

## Goal

Produce one final JSON review object by consolidating stage outputs from the iterative pipeline (stage 1 through stage 6, then combine).

## Input Reality

- In iterative mode, later stages may repeat earlier findings because they receive cumulative context.
- Treat all stage outputs as candidate evidence, then normalize duplicates aggressively while preserving meaning.
- Use `previousOutputsParsed` as the primary source for stage outputs.

## Consolidation Algorithm

1. Parse all stage outputs and collect every finding, todo, and note.
2. Group findings by underlying issue, not by exact wording.
3. Merge findings only when they describe the same root behavior and same affected location.
4. If root behavior is similar but location differs in a meaningful way, keep separate findings.
5. For merged findings:
	- Keep the highest severity.
	- Keep one clear title.
	- Combine unique evidence and impact details into one concise detail.
	- Keep one non-repetitive recommendation that covers the merged issue.
6. Deduplicate todos and notes by meaning (not exact text).

## Quality Rules

- Do not drop unique technical evidence, impact, or remediation context.
- Do not emit repeated findings that differ only in phrasing.
- Do not keep near-identical recommendations across multiple findings.
- Do not mention consolidation mechanics in the final output text.
- Keep final findings tied to real changed file paths and lines.

## Redundancy Guardrails

- If two finding details communicate the same idea, keep the clearer one and merge missing specifics.
- If multiple findings share the same recommendation, express it once in the most relevant finding.
- Vary wording across findings to avoid repetitive comment openings.

## Final Verification Checklist

Before returning JSON, confirm:

1. Every substantive stage finding is either preserved directly or integrated into a merged finding.
2. No merged finding mixes materially different issues.
3. Final output contains no duplicated comments, repetitive recommendation text, or dropped evidence.
