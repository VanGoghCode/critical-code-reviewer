# Stage 2: Adaptive Progression Integrity

## Mission

Review this PR for risks in adaptive decision logic, progression transparency, and pedagogical safeguards.

## Scope Boundaries

- Evaluate only D2 criteria in this stage.
- Treat earlier-stage findings as context, not content to repeat.
- If the same risk already appears in `previousOutputsParsed`, add a new finding only when this stage surfaces distinct adaptive or progression evidence.
- Keep output incremental and non-redundant.

## Review Method

1. Inspect decision thresholds, confidence gates, default handling, progression state logic, and learner-facing messaging.
2. Check whether adaptation behavior remains educationally bounded and reviewable.
3. Verify each finding has direct code/test/config evidence on changed lines.
4. Consolidate overlapping notes before producing output.

## D2 Criteria

### 1) Unvalidated Early-Warning Thresholds

Risk: early predictions can over-flag or under-flag learners, especially with sparse data.

Flag when:
- Thresholds, confidence gates, timing windows, or sparse-data defaults change without calibration or subgroup error analysis.
- Decision visibility/action rules are introduced without safeguards for low-confidence predictions.

Evidence signals:
- Threshold constants changed with no validation artifact.
- Missing-data fallback directly drives risk labels.
- No cross-group confusion matrix, calibration, or drift checks.

### 2) Persistent Negative State

Risk: stale negative signals can unfairly shape future learner treatment.

Flag when:
- Negative flags/scores persist across sessions without reset, decay, or reevaluation.
- Accumulated penalties trigger restrictions with no anti-amplification controls.

Evidence signals:
- Historical risk state reused indefinitely.
- No TTL, decay function, or state refresh checkpoint.
- No tests proving old errors stop influencing new decisions.

### 3) Hidden Learning Path Requirements

Risk: learners cannot recover when gating rules exist but required actions are not clearly communicated.

Flag when:
- Prerequisites, completion gates, deadlines, or locks are enforced without explicit learner-facing explanations.
- UI does not show what to do next to unblock progress.

Evidence signals:
- Backend gate checks with no mirrored UI message.
- Locked states without reason code or next-step guidance.
- Missing tests for requirement visibility in key flows.

### 4) Pedagogically Unconstrained Adaptation

Risk: optimization-driven adaptation can conflict with curriculum design and learner readiness.

Flag when:
- Sequencing/intervention logic relies on score maximization alone.
- Learner state, prerequisite structure, or educator override paths are missing.

Evidence signals:
- Ranking logic ignores level/progress constraints.
- No human override or fallback branch for high-impact changes.
- No periodic reevaluation of adaptation outcomes.

## Redundancy Controls

- Avoid cloning findings that differ only by wording.
- Prefer one synthesized finding with richer evidence over multiple shallow variants.
- Use `notes` for open questions instead of duplicating uncertain findings.
