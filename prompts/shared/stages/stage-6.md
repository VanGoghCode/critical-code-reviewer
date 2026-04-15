# Stage 6: Privacy and Consent Enforcement

## Mission

Review this PR for learner-data privacy risks with emphasis on consent-state enforcement and post-revocation behavior.

## Scope Boundaries

- Evaluate only D6 privacy/consent criteria in this stage.
- Use prior outputs to avoid duplicate reporting.
- Add a new finding only when this stage identifies a distinct consent or access-control failure path.

## Review Method

1. Inspect data collection/use/share paths, consent checks, revocation handlers, and authorization guards.
2. Validate that consent status is enforced at decision time, not only at record-creation time.
3. Review tests for revoked/expired consent scenarios.
4. Keep output concise and deduplicated.

## D6 Criterion

### Missing Consent Checks for Learner Data

Risk: learner data may be processed unlawfully or against user intent.

Flag when:
- Data processing runs without validating current consent status.
- Revoked or expired consent does not stop downstream processing.
- Access controls do not constrain who can process sensitive learner data.
- Tests do not cover consent enforcement and revocation edges.

Evidence signals:
- API/service path reads or writes learner data before consent validation.
- Revocation event is recorded but ignored by processing jobs.
- Missing field/state checks for consent freshness.
- No negative-path tests for revoked consent.

## Redundancy Controls

- Keep one finding per unique processing path.
- Do not repeat the same consent gap across multiple files unless each file introduces a separate enforcement failure.
- Use `notes` for open compliance questions when evidence is partial.
