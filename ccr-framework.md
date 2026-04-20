# CCR Framework — Criteria & Dimensions Reference
> **Version:** v4.2 · Sheet: `v4.2 Criteria & Dimensions`
> **Usage:** Each criterion and dimension has a stable anchor ID (e.g. `#crit-1-1`).
> AI suggestions can link directly to a criterion using `[CRIT-1.1](ccr-framework.md#crit-1-1)`.
> To extend this file, follow the same heading + anchor pattern defined below.

---

## Table of Contents

- [How to Use This File](#how-to-use)
- [Dimensions Overview](#dimensions-overview)
- **[DIM-1 · Fairness Evaluation](#dim-1)** — Fair & Representative Training Data Assurance
  - [CRIT-1.1 · Unrepresentative Dataset Coverage](#crit-1-1)
  - [CRIT-1.2 · Undefined Fairness Evaluation Attributes](#crit-1-2)
  - [CRIT-1.3 · Missing Group-Wise Fairness Targets](#crit-1-3)
- **[DIM-2 · Pedagogy](#dim-2)** — Adaptive Fairness & Transparent Learner Progression Integrity
  - [CRIT-2.1 · Unvalidated Early-Warning Thresholds](#crit-2-1)
  - [CRIT-2.2 · Persistent Negative State](#crit-2-2)
  - [CRIT-2.3 · Hidden Learning Path Requirements](#crit-2-3)
  - [CRIT-2.4 · Pedagogically Unconstrained Adaptation](#crit-2-4)
- **[DIM-3 · Decision Fairness](#dim-3)** — Protected Attribute Governance & Validated Fairness Enforcement
  - [CRIT-3.1 · Protected and Proxy-Based Differential Treatment](#crit-3-1)
  - [CRIT-3.2 · Unvalidated Fairness Mitigations](#crit-3-2)
  - [CRIT-3.3 · Unenforced Protected-Attribute Separation](#crit-3-3)
- **[DIM-4 · Inclusion](#dim-4)** — Cultural & Accessibility Equity in Design and Code
  - [CRIT-4.1 · Culturally Narrow Representations and Validation](#crit-4-1)
  - [CRIT-4.2 · Exclusionary Language in Code and UI](#crit-4-2)
  - [CRIT-4.3 · Excluding Access Assumptions](#crit-4-3)
- **[DIM-5 · Transparency](#dim-5)** — Transparent, Explainable, Validated & Human-Supervised AI Decisioning
  - [CRIT-5.1 · Opaque AI Decision Outputs](#crit-5-1)
  - [CRIT-5.2 · Causal Overclaiming in Analytics](#crit-5-2)
  - [CRIT-5.3 · Mismatched Prediction Validation and Use](#crit-5-3)
  - [CRIT-5.4 · Unidirectional Algorithmic Decisions Without Educator Contestability](#crit-5-4)
  - [CRIT-5.5 · Automation Without Review Safeguards](#crit-5-5)
- **[DIM-6 · Privacy](#dim-6)** — Safe & Respectful Handling of Learner Data
  - [CRIT-6.1 · Missing Consent Checks for Learner Data](#crit-6-1)
- **[DIM-7 · AI Governance](#dim-7)** — Managing AI Risk Across Development, Release, and Use
  - [CRIT-7.1 · Unenforced High-Risk AI Release Gates](#crit-7-1)
  - [CRIT-7.2 · Missing Post-Deployment Risk Monitoring](#crit-7-2)
  - [CRIT-7.3 · Missing Fairness Review for Student-Affecting Changes](#crit-7-3)
  - [CRIT-7.4 · Missing Bias Review for AI-Assisted Code](#crit-7-4)
  - [CRIT-7.5 · Missing Bias Regression Checks for AI-Generated Code](#crit-7-5)
  - [CRIT-7.6 · Missing User-Need Traceability](#crit-7-6)
  - [CRIT-7.7 · Untracked Fairness Mitigation Outcomes](#crit-7-7)

---

## <a id="how-to-use"></a>How to Use This File

### For AI Suggestion References

When an AI tool flags a code issue against this framework, it appends a reference in the form:

```
📎 CCR Reference: [CRIT-X.Y · Criterion Name](ccr-framework.md#crit-x-y)
```

Clicking that link navigates directly to the criterion's anchor in this document.

### Stable Anchor ID Scheme

| Element | ID Format | Example |
|---|---|---|
| Dimension | `dim-{N}` | `#dim-1` |
| Criterion | `crit-{N}-{M}` | `#crit-1-3` |

### Adding New Content

To add a new criterion to an existing dimension, follow this template and increment the criterion number:

```markdown
### <a id="crit-N-M"></a>CRIT-N.M · Your Criterion Name
| | |
|---|---|
| **Dimension** | [DIM-N · Dimension Name](#dim-N) |
| **Review Level** | Code level / Process level |
| **Simple Definition** | One-line plain-language summary. |

**Full Description**

Detailed description here.

**Simple Explanation**

Expanded plain-language explanation.

**Indicators**

Flag PRs that...

- Indicator 1
- Indicator 2
```

To add a new dimension, add `## <a id="dim-N"></a>DIM-N · ...` and update the Table of Contents.

---

## <a id="dimensions-overview"></a>Dimensions Overview

| ID | Dimension | Full Name | # Criteria |
|---|---|---|---|
| [DIM-1](#dim-1) | Fairness Evaluation | Fair & Representative Training Data Assurance | 3 |
| [DIM-2](#dim-2) | Pedagogy | Adaptive Fairness & Transparent Learner Progression Integrity | 4 |
| [DIM-3](#dim-3) | Decision Fairness | Protected Attribute Governance & Validated Fairness Enforcement | 3 |
| [DIM-4](#dim-4) | Inclusion | Cultural & Accessibility Equity in Design and Code | 3 |
| [DIM-5](#dim-5) | Transparency | Transparent, Explainable, Validated & Human-Supervised AI Decisioning | 5 |
| [DIM-6](#dim-6) | Privacy | Safe & Respectful Handling of Learner Data | 1 |
| [DIM-7](#dim-7) | AI Governance | Managing AI Risk Across Development, Release, and Use | 7 |

---

## <a id="dim-1"></a>DIM-1 · Fairness Evaluation

> **Full Name:** Fair & Representative Training Data Assurance
>
> **Dimension Definition:** Problems in data choice, group definitions, fairness targets, and thresholds used to judge fairness. It is about how fairness is measured before looking at later decision behavior.

---

### <a id="crit-1-1"></a>CRIT-1.1 · Unrepresentative Dataset Coverage

| | |
|---|---|
| **Dimension** | [DIM-1 · Fairness Evaluation](#dim-1) |
| **Review Level** | Code level |
| **Simple Definition** | Data misses intended groups or settings. If your data doesn't include everyone or every situation, your results can be misleading. |

**Full Description**

The training or evaluation data for the feature does not adequately cover the learner groups, educational settings, or case types it is meant to serve. In educational technology, data dominated by one population or context can make aggregate results look acceptable while masking failures for underrepresented learner groups or settings. Flag PRs that add or change a model or dataset without visible coverage evidence, or where manifests, dataset schemas, sampling logic, coverage summaries, or evaluation outputs show missing intended groups, severe subgroup or setting imbalance, narrowly sourced benchmark data, or only aggregate results when subgroup labels are already available.

**Indicators**

Flag PRs that change training, sampling, or eval data without subgroup coverage evidence, representative manifests, or group-level results.

- Data mostly comes from one group, source, or setting
- Some expected groups are missing or very small
- Only overall results are shown (no breakdown by group)
- No clear info about what the dataset covers

---

### <a id="crit-1-2"></a>CRIT-1.2 · Undefined Fairness Evaluation Attributes

| | |
|---|---|
| **Dimension** | [DIM-1 · Fairness Evaluation](#dim-1) |
| **Review Level** | Code level |
| **Simple Definition** | Fairness groups are unclear or too broad. If you don't clearly name and track groups, you can't check if things are fair. |

**Full Description**

Fairness groups are unclear or too broad. Group definitions lack clear categories, granularity, or handling for missing values, making evaluation unreliable.

**Indicators**

Flag PRs that add or revise demographic fields without clear categories, subgroup granularity, missing-value handling, or a fallback evaluation plan.

- No demographic or group fields are defined
- Group categories are too broad (e.g., everything lumped together)
- No explanation of what each group means
- Missing or unclear handling of unknown/missing values
- No plan to evaluate fairness if group data isn't collected

---

### <a id="crit-1-3"></a>CRIT-1.3 · Missing Group-Wise Fairness Targets

| | |
|---|---|
| **Dimension** | [DIM-1 · Fairness Evaluation](#dim-1) |
| **Review Level** | Code level |
| **Simple Definition** | No fairness targets for each group. If you don't check each group separately, you might miss unfair results. |

**Full Description**

No fairness targets for each group. Models are assessed without defined group-level benchmarks, so disparities cannot be detected or enforced.

**Indicators**

Flag PRs that validate models or rules with aggregate metrics only and omit group-level targets, assertions, or reports.

- Only aggregate metrics are used (no group breakdowns)
- No group-level metrics (e.g., accuracy per group)
- No thresholds or targets for each group
- No tests, alerts, or reports for group performance

---

## <a id="dim-2"></a>DIM-2 · Pedagogy

> **Full Name:** Adaptive Fairness & Transparent Learner Progression Integrity
>
> **Dimension Definition:** Problems where automation, predictions, or adaptation do not fit educational purpose or remove needed human judgment. It is about learning quality and proper educational use.

---

### <a id="crit-2-1"></a>CRIT-2.1 · Unvalidated Early-Warning Thresholds

| | |
|---|---|
| **Dimension** | [DIM-2 · Pedagogy](#dim-2) |
| **Review Level** | Code level |
| **Simple Definition** | Early-warning settings were not tested. Don't use early guesses unless you've proven they work well. |

**Full Description**

The system makes or surfaces early-stage predictions using thresholds, confidence rules, or missing-data defaults without visible evidence that those settings were validated for that stage of available data across learner groups. In educational technology, acting on predictions too early can create subgroup-skewed false positives or false negatives that affect support allocation, placement, or educator expectations. Flag PRs where release timing, threshold values, minimum-evidence requirements, or missing-data logic are added or changed without calibration results, subgroup error analysis, or tests showing acceptable performance before sufficient learner data is available.

**Indicators**

Flag PRs that add early-warning thresholds, minimum-data rules, or missing-data defaults without subgroup calibration or timing validation.

- Threshold values are set or changed without validation results
- Predictions are made with very little data (too early stage)
- No subgroup performance or error analysis is shown
- Missing-data rules are used without testing impact
- No tests or calibration for early-stage predictions

---

### <a id="crit-2-2"></a>CRIT-2.2 · Persistent Negative State

| | |
|---|---|
| **Dimension** | [DIM-2 · Pedagogy](#dim-2) |
| **Review Level** | Code level |
| **Simple Definition** | Negative status keeps carrying forward. The system doesn't "forget" or update negative judgments when it should. |

**Full Description**

Negative scores, flags, penalties, or risk states persist across sessions or decisions without clear reset, decay, or re-evaluation logic, causing earlier errors or low-confidence judgments to shape later treatment of the same learner. In educational technology, this can escalate restrictions, interventions, or risk labels over time instead of reassessing each case on current evidence. Reviewable evidence includes cumulative scoring formulas, recursive flagging rules, history-based thresholds, state fields that carry forward adverse status, missing reset or decay conditions, and tests that fail to check whether repeated decisions amplify harm across cycles.

**Indicators**

Flag PRs that carry forward negative scores, flags, or penalties without reset, decay, re-evaluation logic, or anti-amplification tests.

- Negative flags/scores are stored and reused across sessions
- No reset, decay, or re-evaluation logic exists
- Decisions depend heavily on past negative states
- No checks to prevent repeated penalties over time
- No tests ensuring old errors don't keep affecting new outcomes

---

### <a id="crit-2-3"></a>CRIT-2.3 · Hidden Learning Path Requirements

| | |
|---|---|
| **Dimension** | [DIM-2 · Pedagogy](#dim-2) |
| **Review Level** | Code level |
| **Simple Definition** | Steps to progress are hidden. If requirements aren't clearly shown, learners can't move forward. |

**Full Description**

Learning interfaces hide or obscure the requirements learners must satisfy to move through coursework. In educational technology, this causes avoidable failure when prerequisites, completion rules, locked-content reasons, deadlines, or required next actions are enforced in code or config but not clearly presented in the UI at the point of use. Reviewable failures include route guards or feature flags that block access without an explanatory state, labels or status text that do not identify what remains to be done, progress indicators that omit required steps, and missing tests for prerequisite visibility, locked-state messaging, and consistent next-step guidance across devices and assistive flows.

**Indicators**

Flag PRs that enforce prerequisites, locks, deadlines, or completion rules without visible explanations, next steps, or locked-state tests.

- Access is blocked (locked content) without clear reason/message
- Prerequisites exist in code but are not displayed in UI
- No clear "what to do next" guidance
- Progress indicators miss required steps
- Missing or unclear messages for locked or incomplete states
- No tests for showing requirements or next steps

---

### <a id="crit-2-4"></a>CRIT-2.4 · Pedagogically Unconstrained Adaptation

| | |
|---|---|
| **Dimension** | [DIM-2 · Pedagogy](#dim-2) |
| **Review Level** | Code level |
| **Simple Definition** | Adaptation ignores teaching rules or context. The system adapts, but not in a smart or educationally correct way. |

**Full Description**

Adaptive system code keeps recommendations, sequencing, and interventions bounded by explicit pedagogical rules, course-design constraints, and learner-state checks rather than relying only on optimization scores. In educational technology, adaptation that ignores course intent or learner context can mis-sequence instruction, narrow options, and trap students in low-quality paths. Reviewable failures include recommenders or routing logic that act only on model scores or engagement metrics, missing prerequisite or progression constraints in rules or configuration, and threshold-based gating that lacks re-evaluation logic, override controls, or human-review checkpoints.

**Indicators**

Flag PRs that let adaptive rules change sequencing or interventions using optimization scores alone without pedagogical constraints or override paths.

- Recommendations or sequencing use only model scores or engagement metrics
- No prerequisite or progression rules are enforced
- Learner state (level, progress, needs) is ignored
- No re-evaluation or update of decisions over time
- No override, fallback, or human-review option
- Threshold-based decisions lack safeguards

---

## <a id="dim-3"></a>DIM-3 · Decision Fairness

> **Full Name:** Protected Attribute Governance & Validated Fairness Enforcement
>
> **Dimension Definition:** Problems in rules, model behavior, proxy use, protected-attribute handling, and fairness controls that change how learners are treated. It is about the decision path itself.

---

### <a id="crit-3-1"></a>CRIT-3.1 · Protected and Proxy-Based Differential Treatment

| | |
|---|---|
| **Dimension** | [DIM-3 · Decision Fairness](#dim-3) |
| **Review Level** | Code level |
| **Simple Definition** | Protected or proxy traits change treatment. Using personal traits (or hints of them) can lead to unfair treatment. |

**Full Description**

Protected attributes or close proxies, such as geography, language, or coded labels, are used in code, configuration, or decision logic to rank, score, route, gate, or recommend users differently in ways that can produce unequal treatment. In educational technology, this can change access, support, or outcomes for similar learners based on signals that stand in for protected status. Reviewable evidence includes protected or proxy fields in schemas, feature mappings, policy rules, filters, thresholds, weighting logic, and tests that apply different handling to comparable cases.

**Indicators**

Flag PRs that use protected attributes or close proxies to score, route, rank, gate, or recommend users differently without an audited justification.

- Protected attributes (e.g., race, gender) are used in logic
- Proxy fields (e.g., location, language, ZIP code) influence outcomes
- Different rules, thresholds, or weights are applied based on these fields
- Similar users are treated differently due to these attributes
- No justification or safeguards for using these features

---

### <a id="crit-3-2"></a>CRIT-3.2 · Unvalidated Fairness Mitigations

| | |
|---|---|
| **Dimension** | [DIM-3 · Decision Fairness](#dim-3) |
| **Review Level** | Code level (using previous review file) |
| **Simple Definition** | Fairness fixes were not tested. Problems are found, but no real or proven fix is applied. |

**Full Description**

Fairness fixes were not tested. Thresholds or rules are used without validation across groups or data conditions, risking biased or unstable outcomes.

**Indicators**

Flag PRs that add fairness mitigations without before/after subgroup metrics or regression tests showing the disparity improves.

- Disparities are reported but no code/config changes follow
- Fixes are added without before/after group metrics
- No validation that the mitigation improves outcomes
- No tests or checks for fairness after changes
- Mitigation logic exists but lacks evidence or evaluation

---

### <a id="crit-3-3"></a>CRIT-3.3 · Unenforced Protected-Attribute Separation

| | |
|---|---|
| **Dimension** | [DIM-3 · Decision Fairness](#dim-3) |
| **Review Level** | Code level |
| **Simple Definition** | Protected data is not kept separate. You must separate sensitive data: don't use it for decisions, but keep it (safely) to check fairness. |

**Full Description**

Protected attributes are not given an explicit, enforced handling path that separates decision inputs from fairness-evaluation data. In educational technology, protected traits or close proxies can improperly influence predictions, rankings, alerts, or access decisions, while indiscriminate removal can also prevent reviewers from checking whether outcomes are equitable across groups. This issue is visible when code, schemas, feature definitions, prompts, config, data pipelines, or tests do not clearly enforce exclusion from decision logic, restricted retention for evaluation only, or a specifically justified and audited allowed use.

**Indicators**

Flag PRs that mix protected attributes into decision inputs or fail to enforce a separate evaluation-only path with restricted access.

- Protected attributes (e.g., race, gender) are used directly in decisions
- No clear rule separating decision inputs vs fairness-evaluation data
- Protected data is removed entirely with no way to evaluate fairness
- No access control or restriction on how these attributes are used
- No documentation or justification for allowed use

---

## <a id="dim-4"></a>DIM-4 · Inclusion

> **Full Name:** Cultural & Accessibility Equity in Design and Code
>
> **Dimension Definition:** Problems that exclude learners through interface language, validation rules, navigation, defaults, or resource assumptions. It is about practical access and participation for different learners.

---

### <a id="crit-4-1"></a>CRIT-4.1 · Culturally Narrow Representations and Validation

| | |
|---|---|
| **Dimension** | [DIM-4 · Inclusion](#dim-4) |
| **Review Level** | Code level |
| **Simple Definition** | Cultural defaults do not fit all users. The system is built for one culture and doesn't handle others well. The system assumes everyone is the same kind of user. |

**Full Description**

Code, schema, model inputs, or configuration relies on culturally narrow representations, validation rules, or defaults that treat one naming, language, identity, or formatting pattern as normal and mis-handle users from other cultural contexts. In educational technology, this can prevent learners from entering valid information, force inaccurate self-representation, or degrade system behavior for users whose names, categories, or input formats do not match the assumed norm. Reviewable evidence includes ASCII-only validation, binary or limited identity fields, locale-specific assumptions for names, dates, currencies, or addresses, embedding or feature mappings that collapse distinct groups, and tests that cover only one cultural pattern.

**Indicators**

Flag PRs that assume ASCII-only names, binary-only identities, or locale-specific formats without inclusive alternatives and diverse tests.

- Validation is too strict (e.g., ASCII-only names, limited characters)
- Identity fields are too limited (e.g., only binary options)
- Assumptions about formats (dates, names, addresses, currency) are fixed to one locale
- Different groups are merged or simplified in data/embeddings
- Tests only cover one cultural pattern

---

### <a id="crit-4-2"></a>CRIT-4.2 · Exclusionary Language in Code and UI

| | |
|---|---|
| **Dimension** | [DIM-4 · Inclusion](#dim-4) |
| **Review Level** | Code level |
| **Simple Definition** | Language excludes or stigmatizes users. The system uses words that can make people feel left out or disrespected. Language in the system should be respectful and inclusive for everyone. |

**Full Description**

Code, UI strings, error messages, comments, documentation, or identifiers use exclusionary, stigmatizing, or unnecessarily gendered language that can marginalize users or normalize harmful assumptions. In educational technology, this can make learners feel unwelcome, encode disrespect into everyday product interactions, and reinforce biased norms in systems used by diverse students and educators. Reviewable evidence includes deprecated discriminatory terms in identifiers, hostile or loaded wording in UI text or errors, gendered defaults where gender is irrelevant, and comments or documentation that describe some users as normal and others as deviations.

**Indicators**

Flag PRs that add exclusionary, stigmatizing, deprecated, or unnecessarily gendered terms in identifiers, comments, errors, or UI strings.

- Use of offensive, outdated, or stigmatizing terms
- Gendered language where not needed (e.g., "he/she" instead of neutral terms)
- Some users described as "normal" and others as different
- Biased or disrespectful wording in UI text, errors, comments, or docs
- Variable names or identifiers with problematic terms

---

### <a id="crit-4-3"></a>CRIT-4.3 · Excluding Access Assumptions

| | |
|---|---|
| **Dimension** | [DIM-4 · Inclusion](#dim-4) |
| **Review Level** | Code level |
| **Simple Definition** | Access assumptions shut some learners out. If you don't design for different needs and devices, some people get left out. |

**Full Description**

Core user flows contain access assumptions that make the tool unusable for learners with disabilities or for learners using constrained devices, bandwidth, or locations. In educational technology, this directly blocks participation even when the underlying model or decision logic is otherwise fair. Reviewable failures include missing alt text or form labels, incorrect ARIA use, keyboard traps, color-only status signals, insufficient contrast, screen-reader-incompatible components, layouts that fail on mobile, large required assets with no low-bandwidth path, or configuration that blocks use by device or location without an equivalent educational path.

**Indicators**

Flag PRs that add learner-facing flows without labels, alt text, correct ARIA, keyboard access, contrast, mobile fit, or low-bandwidth paths.

- Missing accessibility features (alt text, labels, keyboard support, ARIA)
- UI relies only on color or has poor contrast
- Not usable with screen readers
- Layout breaks on mobile or small screens
- Requires high bandwidth with no fallback
- Blocks users by device, location, or connection without alternatives
- Does not meet WCAG 2.1 AA standards

---

## <a id="dim-5"></a>DIM-5 · Transparency

> **Full Name:** Transparent, Explainable, Validated & Human-Supervised AI Decisioning
>
> **Dimension Definition:** Problems in explanations, labels, analytics wording, and result framing that make system behavior hard to understand or easy to misread. It is about correct interpretation of outputs and claims.

---

### <a id="crit-5-1"></a>CRIT-5.1 · Opaque AI Decision Outputs

| | |
|---|---|
| **Dimension** | [DIM-5 · Transparency](#dim-5) |
| **Review Level** | Code level |
| **Simple Definition** | AI outputs are not clearly explained. AI should explain its decisions, not just give results. |

**Full Description**

AI-driven decisions or recommendations are surfaced without clear, reviewable disclosures of what the output means, what information influenced it at a high level, and what confidence, uncertainty, or usage limits apply. In educational technology, students, educators, or administrators may over-trust or misread opaque scores, flags, placements, or recommendations when the system does not explain them well enough to interpret or challenge them. Reviewable failures include UI text, response schemas, audit or log fields, and tests or documentation that return only a prediction, label, score, or action without accompanying explanation content, confidence or context metadata, or plain-language statements about limitations and appropriate use.

**Indicators**

Flag PRs that expose AI scores, labels, placements, or recommendations without plain-language meaning, influencing factors, confidence, or limits.

- Only a score, label, or decision is returned
- No explanation of what influenced the result
- No confidence or uncertainty information
- No description of limitations or proper use
- Missing fields for explanation, metadata, or logs

---

### <a id="crit-5-2"></a>CRIT-5.2 · Causal Overclaiming in Analytics

| | |
|---|---|
| **Dimension** | [DIM-5 · Transparency](#dim-5) |
| **Review Level** | Code level |
| **Simple Definition** | Analytics present patterns as causes. Don't treat patterns as causes unless you're sure. |

**Full Description**

Analytics dashboards, reports, or generated insights describe observational patterns as causes or explanations of student outcomes without clear qualification. In educational technology, causal overclaiming can mislead educators into acting on attendance, behavior, engagement, or performance associations as though the system has shown why a result occurred. Reviewable failures include UI copy, chart titles, labels, annotations, metric definitions, tooltip or help text, generated summaries, and tests or documentation that frame correlational measures as causal findings instead of explicitly limiting them to association, trend, or risk information.

**Indicators**

Flag PRs that describe correlational analytics as causes or explanations in dashboards, reports, summaries, chart labels, or help text.

- Text says "caused by," "leads to," or "because of" without proof
- Charts or reports imply reasons instead of just patterns
- No disclaimers about limits (e.g., "this is only a correlation")
- Metrics or summaries are described as explanations, not associations
- Generated insights overstate certainty

---

### <a id="crit-5-3"></a>CRIT-5.3 · Mismatched Prediction Validation and Use

| | |
|---|---|
| **Dimension** | [DIM-5 · Transparency](#dim-5) |
| **Review Level** | Code level |
| **Simple Definition** | Predictions are used beyond what was tested. If you use a model outside what it was tested for, you can't trust its results. |

**Full Description**

Student-success prediction implementations keep the deployed model consistent with the population, outcome label, and decision use they were validated for. In educational technology, using a model outside its validated scope can trigger inappropriate interventions, miss students who need support, or drive decisions from unreliable signals. Reviewable failures include training or evaluation code that uses a different student population than deployment, label definitions in code, schema, or feature pipelines that do not match the intended outcome, and prediction-serving logic, thresholds, or UI actions that allow use beyond documented constraints or required safeguards.

**Indicators**

Flag PRs that deploy or reuse prediction models outside their validated population, outcome, timing, or decision context.

- Training data population differs from deployment population
- Outcome labels don't match the intended prediction use
- Prediction logic is used for a different purpose than validated
- Thresholds or actions don't match validation setup
- No safeguards to prevent out-of-scope use

---

### <a id="crit-5-4"></a>CRIT-5.4 · Unidirectional Algorithmic Decisions Without Educator Contestability

| | |
|---|---|
| **Dimension** | [DIM-5 · Transparency](#dim-5) |
| **Review Level** | Code level |
| **Simple Definition** | Decisions cannot be challenged or corrected by users. Decisions go one way — no way for humans to challenge or correct them. |

**Full Description**

AI or algorithmic outputs such as risk flags, placement recommendations, or intervention triggers are applied without a structured mechanism for educators, learners, or administrators to submit context, contest a decision, or have that input meaningfully reflected in the system's current or future behavior. In educational technology, this creates a one-way decision flow where human knowledge and contextual judgment cannot correct or qualify what the algorithm surfaces. Reviewable failures include risk or flag workflows that lack a contestation UI, API endpoint, or audit field for human-provided context, systems that accept feedback but do not route it to decision logic or reviewer queues, and missing tests or documentation for override, appeal, or feedback pathways.

**Indicators**

Flag PRs that apply risk flags, placements, or interventions without a way for educators or learners to contest decisions, submit context, or trigger review, or where feedback is not routed into decision logic, audit logs, or override workflows.

- No UI/API to submit feedback, appeal, or override decisions
- No way to add human context to decisions (e.g., notes, comments)
- Feedback is collected but not used in decision logic or review process
- No audit trail of human input or changes
- No tests or docs for override or appeal workflows

---

### <a id="crit-5-5"></a>CRIT-5.5 · Automation Without Review Safeguards

| | |
|---|---|
| **Dimension** | [DIM-5 · Transparency](#dim-5) |
| **Review Level** | Code level |
| **Simple Definition** | High-impact actions skip human review. Big decisions should have a human check, not be fully automatic. |

**Full Description**

Consequential learner-affecting actions are not gated by human review or override controls in code. In educational technology, this matters because incorrect automated recommendations, restrictions, or interventions may be applied before a staff member can assess context and stop harm. Failure is visible when UI workflows, API logic, background jobs, permission rules, configuration, or tests let high-impact actions execute automatically, omit an approval step, or lack an authorized path to override or reverse the action.

**Indicators**

Flag PRs that let high-impact learner-affecting actions run automatically without approval, human review, override, reversal, or permission checks.

- Important decisions execute automatically (no approval step)
- No option to override or cancel decisions
- No role/permission check for sensitive actions
- No workflow for human review before applying changes
- No way to reverse or audit decisions
- Missing tests for review/approval logic

---

## <a id="dim-6"></a>DIM-6 · Privacy

> **Full Name:** Safe & Respectful Handling of Learner Data
>
> **Dimension Definition:** Problems in consent, access, retention, sharing, and protection of learner data. It is about safe and respectful handling of personal and educational information.

---

### <a id="crit-6-1"></a>CRIT-6.1 · Missing Consent Checks for Learner Data

| | |
|---|---|
| **Dimension** | [DIM-6 · Privacy](#dim-6) |
| **Review Level** | Code level |
| **Simple Definition** | Learner data is used without consent checks. Always check permission before using someone's data. |

**Full Description**

Learner personal or educational data is processed without enforced consent checks in code. In educational technology, this matters because student data may be collected or shared even when the user never agreed or later withdrew permission. Failure is visible when UI actions, API endpoints, service logic, queues, or tests allow collection, use, or sharing of learner data without verifying current consent state or without blocking processing after consent is revoked.

**Indicators**

Flag PRs that collect, use, or share learner data without consent-state checks, revocation handling, access controls, or tests.

- Data is collected, used, or shared without checking consent status
- No check for revoked or expired consent
- Processing continues after consent is withdrawn
- Missing consent fields or validation in APIs/services
- No tests for consent enforcement

---

## <a id="dim-7"></a>DIM-7 · AI Governance

> **Full Name:** Managing AI Risk Across Development, Release, and Use
>
> **Dimension Definition:** Problems in review gates, release control, monitoring, and ongoing checks for AI-related changes. It is about managing AI risk across development, release, and use.

---

### <a id="crit-7-1"></a>CRIT-7.1 · Unenforced High-Risk AI Release Gates

| | |
|---|---|
| **Dimension** | [DIM-7 · AI Governance](#dim-7) |
| **Review Level** | Process level |
| **Simple Definition** | High-risk AI can ship without required checks. |

**Full Description**

High-impact learner-facing AI changes can be released without enforced workflow gates for risk classification, accountable ownership, and approval. In educational technology, this matters because model, prompt, or configuration changes may affect learners before required review occurs. Failure is visible when CI/CD checks, model registry schemas, deployment configuration, feature flags, or tests allow an AI capability to be enabled or updated without required risk tier, owner, and approval fields.

**Indicators**

Flag PRs that enable or update high-risk learner-facing AI without risk tier, accountable owner, approvals, or deployment gates.

---

### <a id="crit-7-2"></a>CRIT-7.2 · Missing Post-Deployment Risk Monitoring

| | |
|---|---|
| **Dimension** | [DIM-7 · AI Governance](#dim-7) |
| **Review Level** | Process level |
| **Simple Definition** | High-risk AI is not monitored after launch. |

**Full Description**

High-impact learner-facing AI features are released without instrumented post-deployment monitoring and threshold-based alerts. In educational technology, this matters because harmful model behavior may appear only after release as learner populations, data, or usage patterns change. Failure is visible when application code, logging schemas, metrics configuration, scheduled evaluation jobs, alert rules, or tests omit required event logging, outcome metrics, drift checks, or alert thresholds for high-risk AI behavior.

**Indicators**

Flag PRs that release high-risk AI without logging, drift or outcome metrics, subgroup monitoring, alert thresholds, or response hooks.

---

### <a id="crit-7-3"></a>CRIT-7.3 · Missing Fairness Review for Student-Affecting Changes

| | |
|---|---|
| **Dimension** | [DIM-7 · AI Governance](#dim-7) |
| **Review Level** | Process level |
| **Simple Definition** | Student-affecting changes skip fairness review. |

**Full Description**

Student-affecting changes are not gated by required fairness-focused review and targeted validation before merge or release. In educational technology, logic, rule, or configuration updates can change access, support, placement, grading, or opportunity for specific learner groups without anyone checking likely impacts or edge cases. Failure is visible when PR workflows, required fields, reviewer checklists, approval rules, CI checks, or required tests allow changes through without documenting affected learners, impacted decision points, likely downstream educational effects, fairness-specific review questions, targeted edge-case coverage, and resolution of flagged issues.

**Indicators**

Flag PRs that change learner-affecting logic without documented affected groups, fairness review questions, targeted validation, or edge-case tests.

---

### <a id="crit-7-4"></a>CRIT-7.4 · Missing Bias Review for AI-Assisted Code

| | |
|---|---|
| **Dimension** | [DIM-7 · AI Governance](#dim-7) |
| **Review Level** | Process level |
| **Simple Definition** | AI-assisted code is not checked for bias. |

**Full Description**

AI-assisted student-affecting code changes are not gated by required disclosure, human review, and bias-focused validation before merge. In educational technology, coding assistants or generated code can introduce stereotypes, discriminatory logic, or unsafe learner-facing behavior into labels, conditions, prompts, validation rules, or data handling. Failure is visible when PR workflows, source-disclosure fields, reviewer checklists, CI checks, or tests allow AI-assisted or AI-generated changes to merge without being identified and reviewed for bias-related risks.

**Indicators**

Flag PRs that include AI-assisted code without disclosure, human review, and bias-focused validation of labels, rules, prompts, or data handling.

---

### <a id="crit-7-5"></a>CRIT-7.5 · Missing Bias Regression Checks for AI-Generated Code

| | |
|---|---|
| **Dimension** | [DIM-7 · AI Governance](#dim-7) |
| **Review Level** | Process level |
| **Simple Definition** | AI-generated code is not retested for bias. |

**Full Description**

AI code-generation workflows used for student-affecting software are not gated by repeatable bias benchmarks and regression tests before tool, prompt, or model changes are adopted. In educational technology, this matters because discriminatory generated patterns may persist or worsen across versions without consistent measurement. Failure is visible when benchmark prompt sets, scoring scripts, evaluation harnesses, CI checks, or release rules do not quantify and compare bias-related risks in generated labels, conditions, thresholds, proxies, or data-handling logic.

**Indicators**

Flag PRs that change AI coding tools, prompts, or models without benchmark prompts, scoring scripts, baseline comparisons, or bias regression checks.

---

### <a id="crit-7-6"></a>CRIT-7.6 · Missing User-Need Traceability

| | |
|---|---|
| **Dimension** | [DIM-7 · AI Governance](#dim-7) |
| **Review Level** | Process level |
| **Simple Definition** | Changes are not tied to user needs. |

**Full Description**

User-affecting workflows, defaults, and constraints are changed without visible traceability to documented learner, educator, or administrator needs. In educational technology, this allows technically efficient designs to override autonomy, trust, or practical usability in core learning tasks. Reviewable failures include PRs that add or change required steps, defaults, permissions, nudges, or restrictions without linked requirements, referenced user research findings, acceptance criteria, or tests showing whose need the change serves and how that need is preserved in the implementation.

**Indicators**

Flag PRs that alter workflows, defaults, permissions, nudges, or restrictions without linked user needs, acceptance criteria, or preserving tests.

---

### <a id="crit-7-7"></a>CRIT-7.7 · Untracked Fairness Mitigation Outcomes

| | |
|---|---|
| **Dimension** | [DIM-7 · AI Governance](#dim-7) |
| **Review Level** | Process level |
| **Simple Definition** | Fairness fixes have no owner, plan, or follow-up to confirm they worked. |

**Full Description**

In educational systems, a mitigation that is implemented but never tracked can quietly fail while the team assumes the problem is solved. This criterion flags cases where a detected disparity has no assigned owner, no documented rationale for the chosen fix, no post-release evaluation plan, and no escalation path if the fix does not improve group outcomes. Fairness mitigations that are not owned, planned, and validated after release cannot be trusted to hold.

**Indicators**

Flag PRs where a fairness disparity has been identified but is missing an assigned owner, documented mitigation rationale, post-release evaluation plan, or escalation path if group outcomes do not improve.

---

*End of CCR Framework Reference — v4.2*
