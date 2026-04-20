# CCR Review Action

Automated code review for pull requests. Analyzes PR diffs using an LLM, posts inline comments on changed lines, and writes a summary to the GitHub Actions job summary.

Runs on Node 24 via the ASU AIML provider.

## Quick Start

1. Add the workflow below to `.github/workflows/ccr-review.yml`
2. Add a repository secret `ASU_API_KEY` with your ASU AIML API key
3. Open a PR

Pin to a release tag (`@v1`) or commit SHA instead of `@main` for stability.

## Architectures

| Mode | LLM Calls | Description |
| --- | --- | --- |
| `single-pass` | 1 | One LLM call. Fastest, good for small PRs. |
| `iterative` | 7 | Six sequential stages + combine. Each stage refines the previous, then a merge step deduplicates all findings. |
| `parallel` | 7 | Six stages in parallel + combine step. Best coverage. |

Each stage has its own specialized persona. The combine stage merges and deduplicates findings across all stages. All architectures review across six dimensions: Data Fairness, Adaptive Progression Integrity, Protected Attribute Governance, Cultural/Accessibility Equity, Explainability/Human Oversight, Privacy/Consent.

## Inputs

| Input | Required | Default | Purpose |
| --- | --- | --- | --- |
| `api-key` | Yes | — | ASU AIML API key |
| `model` | Yes | — | Model name (e.g. `gpt5_2`, `claude4_5_sonnet`) |
| `github-token` | No | — | Token for inline PR comments |
| `base-url` | No | `https://api-main.aiml.asu.edu/queryV2` | ASU AIML endpoint |
| `model-provider` | No | `openai` | Provider identifier |
| `architecture` | No | `single-pass` | Prompt architecture |
| `post-inline-comments` | No | `true` | Post inline comments on changed lines |
| `inline-comment-limit` | No | `10` | Max inline comments per run |
| `inline-comment-mode` | No | `findings` | `findings` or `file-coverage` |
| `prompt-root` | No | `prompts` | Custom prompt directory |
| `base-ref` | No | inferred | Base git ref for diff |
| `head-ref` | No | inferred | Head git ref for diff |
| `include-globs` | No | `**/*` | Included file globs |
| `exclude-globs` | No | `node_modules/**,dist/**,...` | Excluded file globs |
| `max-files` | No | `25` | Max changed files in payload |
| `max-context-chars` | No | `12000` | Prompt payload character budget |
| `temperature` | No | `0.2` | Model sampling temperature |
| `request-timeout-ms` | No | `120000` | Model request timeout (ms) |

## Outputs

| Output | Meaning |
| --- | --- |
| `summary` | Review summary text |
| `risk-level` | `low`, `medium`, or `high` |
| `finding-count` | Number of findings |
| `architecture` | Architecture ID that ran |
| `inline-comments-posted` | Inline comments posted |
| `inline-comments-skipped` | Findings skipped during mapping |

## Example Workflow

```yaml
name: CCR Review

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

concurrency:
  group: ccr-${{ github.event.pull_request.number }}
  cancel-in-progress: false

permissions:
  contents: read
  pull-requests: write

jobs:
  ccr-review:
    if: github.event.pull_request.draft == false && github.event.pull_request.head.repo.fork == false
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Run CCR review
        uses: VanGoghCode/critical-code-reviewer@main
        with:
          api-key: ${{ secrets.ASU_API_KEY }}
          model: gpt5_2
          github-token: ${{ github.token }}
          post-inline-comments: "true"
          inline-comment-mode: file-coverage
```

## Build and Test

```bash
npm ci
npm run typecheck
npm run build
npm test
```

## Prompt Customization

Each LLM call receives a 5-layer prompt:

| Layer | Source | Purpose |
| --- | --- | --- |
| 1. Identity | hardcoded | Architecture and stage metadata |
| 2. Persona | per-stage persona file | Specialized reviewer voice for each dimension |
| 3. Instructions | stage prompt (editable) | Review criteria and dimension rules |
| 4. Humanize | shared `humanize.md` | Word counts, tone rules |
| 5. Output format | shared `output-format.md` | JSON schema and field rules |

### Editable Files

| File | Purpose |
| --- | --- |
| `prompts/architectures/single-pass/prompt.md` | Single-pass review criteria |
| `prompts/shared/stages/stage-1.md` through `stage-6.md` | Stage-specific criteria |
| `prompts/shared/stages/stage-1-persona.md` through `stage-6-persona.md` | Per-stage personas |
| `prompts/architectures/parallel/combine.md` | Parallel consolidation rules |
| `prompts/architectures/iterative/combine.md` | Iterative consolidation rules |

For repository-local prompts, set an absolute `prompt-root`:

```yaml
with:
  prompt-root: ${{ github.workspace }}/.github/ccr-prompts
```
