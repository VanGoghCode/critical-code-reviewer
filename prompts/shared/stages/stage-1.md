# Stage 1: Data Fairness Foundations

## Mission

Review this PR for data representativeness and fairness measurement readiness in educational AI workflows.

## Scope Boundaries

- Evaluate only D1 concerns in this stage.
- Ignore D2-D6 unless they provide direct evidence for a D1 finding.
- If `previousOutputsParsed` contains equivalent findings, do not restate them unless this PR introduces materially new evidence.
- Output net-new D1 findings only; leave cross-stage aggregation to the combine stage.

## Review Method

1. Inspect changed datasets, schema fields, config defaults, validation logic, evaluation scripts, tests, and docs.
2. Identify where subgroup coverage or subgroup metrics could be hidden by aggregate reporting.
3. Confirm each finding maps to changed lines and a concrete learner-impact risk.
4. Merge overlapping notes before output so each finding represents one root issue.

## D1 Criteria

### 1) Unrepresentative Dataset Coverage

Risk: performance looks acceptable overall while failing specific learner groups or education contexts.

Flag when:
- Training or evaluation data changes without subgroup distribution summaries.
- Coverage checks are absent for expected populations, regions, programs, or modalities.
- Reporting stays aggregate-only after data source or sampling updates.

Evidence signals:
- One dominant source or subgroup with minimal diversity.
- Missing or tiny slices for expected learner cohorts.
- No stratified evaluation tables or subgroup comparison tests.

### 2) Undefined Fairness Evaluation Attributes

Risk: fairness cannot be measured reliably if group attributes are ambiguous, collapsed, or inconsistent.

Flag when:
- Demographic or protected-group fields are introduced/changed without clear category definitions.
- Missing or unknown values are not handled in metrics logic.
- There is no fallback plan when protected fields are absent.

Evidence signals:
- Broad buckets that erase subgroup detail.
- No docs for allowed values, null handling, or derivation rules.
- Schema and evaluation code disagree on group semantics.

### 3) Missing Group-Level Fairness Targets

Risk: teams cannot detect subgroup regressions when only global metrics have thresholds.

Flag when:
- Validation relies on aggregate metrics without per-group targets or alerting.
- Fairness dashboards/reports omit subgroup pass-fail criteria.
- CI checks do not enforce group-level minimums.

Evidence signals:
- Single threshold for all learners with no subgroup checks.
- No tests for disparity bounds or subgroup failures.
- Monitoring emits overall scores only.

## Redundancy Controls

- Keep one finding per root cause per affected area.
- If two candidate findings share the same evidence and remediation, keep the clearer one.
- If uncertain, place the question in `notes` instead of duplicating a weak finding.
