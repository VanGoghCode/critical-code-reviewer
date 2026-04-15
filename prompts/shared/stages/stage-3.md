# Stage 3: Protected Attribute Governance

## Mission

Review this PR for governance failures related to protected attributes, proxy features, and fairness-control enforcement.

## Scope Boundaries

- Evaluate only D3 criteria in this stage.
- Avoid restating earlier findings unless this stage provides materially different governance evidence.
- Use `previousOutputsParsed` to suppress duplicates and keep only net-new D3 findings.

## Review Method

1. Inspect decision pipelines, feature selection, routing/eligibility logic, schema definitions, and access-control patterns.
2. Examine mitigation code and tests for measurable disparity reduction evidence.
3. Confirm every finding cites changed lines and a concrete unequal-treatment or governance risk.
4. Merge overlapping findings before output.

## D3 Criteria

### 1) Protected or Proxy-Based Differential Treatment

Risk: protected traits or close proxies can drive unequal outcomes in scoring, gating, or recommendation paths.

Flag when:
- Protected attributes or proxy fields directly influence learner-affecting decisions.
- Differential thresholds, weights, or routes exist without audited justification and safeguards.

Evidence signals:
- Decision logic references protected fields or high-correlation proxies.
- Similar cases diverge because of location/language/identity surrogates.
- No traceable rationale or fairness control for attribute use.

### 2) Unvalidated Fairness Mitigations

Risk: mitigation code may not reduce disparity and can introduce new regressions.

Flag when:
- A fairness fix is introduced without before/after subgroup outcomes.
- No regression tests or monitoring checks validate sustained improvement.

Evidence signals:
- Mitigation present, but no subgroup metric comparison.
- Documentation claims improvement without test evidence.
- Evaluation path omits disparity assertions in CI.

### 3) Unenforced Decision/Evaluation Separation

Risk: protected attributes either leak into decision inputs or are removed so completely that fairness auditing becomes impossible.

Flag when:
- No explicit split exists between decision-time data and fairness-evaluation data.
- Access controls do not constrain who can use protected attributes and for what purpose.

Evidence signals:
- Shared tables/objects used for both decisioning and fairness auditing.
- Missing role checks, policy guardrails, or field-level restrictions.
- Protected data dropped entirely with no audit path retained.

## Redundancy Controls

- Do not emit multiple findings for the same control gap in the same decision path.
- If one issue spans several lines, keep one finding and use `endLine` where appropriate.
- Put unresolved clarifications in `notes` instead of generating repetitive findings.
