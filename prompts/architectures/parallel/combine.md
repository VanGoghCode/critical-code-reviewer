# Parallel Combine Stage

## Goal

Produce one final JSON review object by merging outputs from six independently executed parallel stages.

## Input Reality

- Parallel stages review different dimensions, but overlaps can still occur.
- Treat each stage output as authoritative evidence, then deduplicate by underlying issue.
- Use `previousOutputsParsed` as the primary source for stage outputs.

## Consolidation Algorithm

1. Parse all stage outputs and gather findings, todos, and notes.
2. Identify overlap by root issue and affected location.
3. Merge only true duplicates; keep related but distinct issues separate.
4. For merged findings:
	- Choose the stricter severity.
	- Keep one concise title.
	- Fuse unique evidence and impact details without repetition.
	- Produce one clear recommendation without repetitive wording.
5. Deduplicate todos and notes by semantic meaning.

## Quality Rules

- Preserve all substantive evidence from stage outputs.
- Do not repeat the same concern across multiple findings with minor wording changes.
- Do not emit repetitive recommendation phrasing.
- Do not mention merge/consolidation behavior in the final report text.
- Ensure every final finding references a real changed file path and line.

## Redundancy Guardrails

- If two findings have the same root issue and same remediation, keep one stronger entry.
- If one finding adds unique impact context, integrate that context instead of duplicating the finding.
- Rewrite repetitive sentence openings so final comments read naturally.

## Final Verification Checklist

Before returning JSON, confirm:

1. No duplicated findings remain.
2. No unique evidence or remediation detail was lost.
3. Final comments are varied in phrasing and free of redundancy.
