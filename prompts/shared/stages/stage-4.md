# Stage 4: Cultural and Accessibility Equity

## Mission

Review this PR for cultural exclusion risks and accessibility barriers that affect learner access and dignity.

## Scope Boundaries

- Evaluate only D4 criteria in this stage.
- Use prior-stage outputs as context to avoid duplicate reporting.
- Add a new finding only when this stage contributes distinct cultural or accessibility evidence.

## Review Method

1. Inspect UI strings, validation rules, schema options, frontend behavior, and related tests.
2. Check whether defaults and assumptions exclude names, identities, locales, devices, or assistive-tech users.
3. Verify each finding maps to changed lines and a real learner-facing impact.
4. Combine overlapping barriers into single, clearer findings.

## D4 Criteria

### 1) Culturally Narrow Representations and Validation

Risk: systems encoded for one cultural norm can reject or mis-handle legitimate learner data.

Flag when:
- Validation or schema changes assume one naming/identity/locale pattern.
- Internationalized input paths are absent after introducing learner-facing fields.

Evidence signals:
- Non-ASCII names rejected or stripped.
- Identity options limited in ways that erase valid categories.
- Date/currency/address parsing tied to one locale without alternatives.

### 2) Exclusionary Language in Code or UI

Risk: stigmatizing or biased wording normalizes harm and undermines trust.

Flag when:
- Deprecated, demeaning, or unnecessarily gendered language appears in user-visible text, docs, comments, or identifiers.
- Messaging frames one group as default and others as exceptions.

Evidence signals:
- Offensive/deprecated labels in error strings or UI copy.
- Variable names or comments containing discriminatory terminology.
- Help text that implies bias or disrespect.

### 3) Excluding Access Assumptions

Risk: inaccessible flows block learners with disabilities or constrained devices/connectivity.

Flag when:
- Learner-facing paths lack labels, keyboard support, ARIA semantics, contrast, or responsive behavior.
- Core actions rely on high-bandwidth or specific device assumptions with no fallback.

Evidence signals:
- Missing form labels, alt text, or keyboard navigation support.
- Color-only status signaling or unreadable contrast.
- Mobile/small-screen breakage for essential workflow steps.

## Redundancy Controls

- Keep one finding per distinct barrier type.
- When one barrier affects multiple components similarly, cite strongest evidence and avoid repetitive clones.
- Put uncertain language concerns in `notes` when evidence is inconclusive.
