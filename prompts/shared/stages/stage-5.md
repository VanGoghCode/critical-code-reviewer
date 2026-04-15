# Stage 5: Explainability and Human Oversight

## Mission

Review this PR for transparency failures and missing human-control safeguards in AI-driven educational decisions.

## Scope Boundaries

- Evaluate only D5 criteria in this stage.
- Avoid repeating risks already documented unless you can add distinct explainability or oversight evidence.
- Keep findings additive and non-redundant relative to `previousOutputsParsed`.

## Review Method

1. Inspect model output schemas, UI/reporting copy, decision pathways, and approval/override workflows.
2. Verify claims language aligns with evidence type (association vs causation).
3. Check that model use context matches validation context.
4. Ensure each finding is tied to changed lines and a concrete learner-impact scenario.

## D5 Criteria

### 1) Opaque AI Decision Outputs

Risk: users may over-trust scores or labels they cannot interpret or challenge.

Flag when:
- AI outputs expose labels/scores without plain-language meaning, confidence, uncertainty, or known limitations.
- There is no metadata path for auditability.

Evidence signals:
- Score returned with no rationale fields.
- Missing uncertainty/confidence display or payload keys.
- No documentation of intended use boundaries.

### 2) Causal Overclaiming in Analytics

Risk: causal language on correlational data can drive harmful interventions.

Flag when:
- Dashboards, summaries, or generated text claim causes without causal design evidence.
- Labels imply explanations rather than correlations.

Evidence signals:
- Terms such as "caused by" or "because" in observational analytics.
- Missing disclaimer text for non-causal interpretations.

### 3) Mismatched Prediction Validation and Use

Risk: predictions become unreliable when deployed outside validated populations, outcomes, timing, or decision context.

Flag when:
- Model reuse exceeds validated scope without safeguards.
- Threshold/action policies differ from validation assumptions.

Evidence signals:
- Population/outcome mismatch between training docs and runtime code.
- No runtime guard preventing out-of-scope invocation.

### 4) Decisions Without Educator Contestability

Risk: harmful errors remain uncorrected when humans cannot submit context or request review.

Flag when:
- Learner-affecting outputs lack appeal, feedback, or override intake pathways.
- Human input is captured but not connected to review/revision logic.

Evidence signals:
- No API/UI endpoint for contesting decisions.
- No audit trail for submitted context and disposition.

### 5) Automation Without Review Safeguards

Risk: consequential actions execute without accountable human checkpoints.

Flag when:
- High-impact actions run automatically without approval, permission checks, override, or rollback support.
- Tests do not cover review-gate behavior.

Evidence signals:
- Direct execution path from model output to enforcement action.
- Missing role checks or approval state transitions.
- No reversal workflow for erroneous actions.

## Redundancy Controls

- Prefer one comprehensive finding per oversight failure mode.
- Remove repetitive recommendation phrasing before output.
- Place unresolved intent questions in `notes` rather than duplicating findings.
