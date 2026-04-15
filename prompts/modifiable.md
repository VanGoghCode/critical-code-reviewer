# Prompt File Map

Quick reference for which files to edit when changing review behavior.

---

## Shared Across All Architectures

| File | Controls |
|---|---|
| `prompts/shared/persona.md` | Reviewer identity, voice, behavioral posture |
| `prompts/shared/humanize.md` | Writing quality, tone, anti-repetition rules |
| `prompts/shared/output-format.md` | JSON schema, field rules, validation constraints |

## single-pass

| File | Controls |
|---|---|
| `prompts/architectures/single-pass/prompt.md` | Full audit instructions, all 19 criteria across 6 dimensions |
| Persona | Uses `shared/persona.md` (no stage-specific override) |

## parallel

| Stage | Instructions | Persona |
|---|---|---|
| Stage 1 — Data Fairness | `prompts/shared/stages/stage-1.md` | `prompts/shared/stages/stage-1-persona.md` |
| Stage 2 — Adaptive Progression | `prompts/shared/stages/stage-2.md` | `prompts/shared/stages/stage-2-persona.md` |
| Stage 3 — Protected Attributes | `prompts/shared/stages/stage-3.md` | `prompts/shared/stages/stage-3-persona.md` |
| Stage 4 — Cultural & Accessibility | `prompts/shared/stages/stage-4.md` | `prompts/shared/stages/stage-4-persona.md` |
| Stage 5 — Explainability & Oversight | `prompts/shared/stages/stage-5.md` | `prompts/shared/stages/stage-5-persona.md` |
| Stage 6 — Privacy & Consent | `prompts/shared/stages/stage-6.md` | `prompts/shared/stages/stage-6-persona.md` |
| Combine | `prompts/architectures/parallel/combine.md` | `prompts/architectures/iterative/combine-persona.md` |

## iterative

| Stage | Instructions | Persona |
|---|---|---|
| Stage 1 — Data Fairness | `prompts/shared/stages/stage-1.md` | `prompts/shared/stages/stage-1-persona.md` |
| Stage 2 — Adaptive Progression | `prompts/shared/stages/stage-2.md` | `prompts/shared/stages/stage-2-persona.md` |
| Stage 3 — Protected Attributes | `prompts/shared/stages/stage-3.md` | `prompts/shared/stages/stage-3-persona.md` |
| Stage 4 — Cultural & Accessibility | `prompts/shared/stages/stage-4.md` | `prompts/shared/stages/stage-4-persona.md` |
| Stage 5 — Explainability & Oversight | `prompts/shared/stages/stage-5.md` | `prompts/shared/stages/stage-5-persona.md` |
| Stage 6 — Privacy & Consent | `prompts/shared/stages/stage-6.md` | `prompts/shared/stages/stage-6-persona.md` |
| Combine | `prompts/architectures/iterative/combine.md` | `prompts/architectures/iterative/combine-persona.md` |

---

## Notes

- **parallel and iterative share the same 6 stage files.** Editing `shared/stages/stage-N.md` or `shared/stages/stage-N-persona.md` changes both architectures.
- **single-pass** bundles all 19 criteria into one prompt. The stage-based architectures split them across stages.
- **Combine personas** for both parallel and iterative point to the same file: `architectures/iterative/combine-persona.md`.
- **Manifests** wire the files together: `prompts/architectures/{single-pass,parallel,iterative}/manifest.json`. Only edit manifests to restructure stages, not to change prompt content.
