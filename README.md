# CCR Review Action

CCR (Critical Code Review) is a reusable GitHub Action that performs automated ethical code review on pull requests in educational technology projects. It analyzes PR diffs against a fairness and ethics framework using an LLM, then posts findings as inline PR comments and writes a `CCR.md` report.

The action runs on Node 24 (defined in `action.yml`) and uses the ASU AIML provider as its LLM backend.

## What It Does

- Collects changed files from the GitHub PR API or falls back to local git ranges.
- Feeds diffs, context, and commit messages through a configurable review engine.
- Runs one of three prompt architectures:
  - **`single-pass`** — one LLM call over the entire change set.
  - **`iterative`** — six sequential stages that refine previous stage output.
  - **`parallel`** — six stages in parallel, followed by a combine step.
- Each architecture reviews changes across six ethical dimensions:
  1. **Data Fairness** — training/evaluation data coverage
  2. **Adaptive Progression Integrity** — adaptive fairness, thresholds
  3. **Protected Attribute Governance** — attribute handling, mitigation
  4. **Cultural and Accessibility Equity** — inclusivity, language, accessibility
  5. **Explainability and Human Oversight** — AI output explainability, oversight
  6. **Privacy and Consent** — learner privacy, consent handling
- Writes a markdown report to `CCR.md` (configurable via `output-path`).
- Optionally posts inline PR review comments on mapped changed lines.
- Exposes outputs for report path, summary, risk level, finding count, and inline comment counts.

## Project Structure

```
critical-code-reviewer/
├── action.yml                    # GitHub Action definition (Node 24)
├── src/                          # TypeScript action source
│   ├── action.ts                 # Action entry point
│   └── core/                     # Engine, LLM, GitHub, prompts, reporting
├── scripts/
│   ├── build-action.mjs          # esbuild bundler (src → dist/index.cjs)
│   └── ccr_reviewer.py           # Standalone Python CLI reviewer
├── prompts/
│   ├── architectures/
│   │   ├── single-pass/          # manifest.json + prompt.md
│   │   ├── iterative/            # manifest.json (uses shared stages)
│   │   └── parallel/             # manifest.json + combine.md
│   └── shared/stages/            # stage-1.md through stage-6.md
├── tests/
│   ├── engine.test.ts            # Vitest suite for review engine
│   └── test_ccr_reviewer.py      # Pytest suite for Python reviewer
├── .github/
│   ├── ccr-framework.md          # Single-pass review criteria (Level 2 prompt)
│   └── workflows/test.yml        # CI: typecheck, build, test
├── Context/                      # Legacy reference docs and examples
├── dist/index.cjs                # Bundled action (committed for releases)
├── package.json                  # Node dependencies and scripts
├── requirements.txt              # Python dependencies (requests)
└── tsconfig.json                 # TypeScript configuration
```

## Prompt Customization

### Bundled Prompts (Default)

Edit these files in this repository to change review behavior for all consumers:

| File | Purpose |
| --- | --- |
| `prompts/architectures/single-pass/manifest.json` | Single-pass architecture shape |
| `prompts/architectures/single-pass/prompt.md` | Single-pass prompt body |
| `prompts/architectures/iterative/manifest.json` | Iterative six-stage pipeline config |
| `prompts/architectures/parallel/manifest.json` | Parallel six-stage + combine config |
| `prompts/shared/stages/stage-1.md` through `stage-6.md` | Stage prompts (shared by iterative and parallel) |
| `prompts/architectures/parallel/combine.md` | Parallel merge prompt |
| `.github/ccr-framework.md` | Review criteria used by single-pass mode |

Release a new tag after editing prompts so consumers pick up changes.

### Repository-Local Prompts

Use custom prompts in the consuming repository by setting an absolute `prompt-root`:

```yaml
with:
  prompt-root: ${{ github.workspace }}/.github/ccr-prompts
```

Relative `prompt-root` resolves inside the action package path. Use an absolute path for repository-local prompt folders.

## Inputs

| Input | Required | Default | Purpose |
| --- | --- | --- | --- |
| `api-key` | Yes | — | API key for the ASU AIML provider. |
| `base-url` | No | `https://api-main.aiml.asu.edu/queryV2` | ASU AIML query endpoint. |
| `model-provider` | No | `asu` | ASU model provider identifier. |
| `model` | Yes | — | ASU model name (e.g. `gpt5_2`). |
| `github-token` | No | — | Token for inline PR comments. |
| `post-inline-comments` | No | `false` | Post inline comments on changed lines. |
| `inline-comment-limit` | No | `10` | Max inline comments per run. |
| `inline-comment-mode` | No | `findings` | `findings` for per-finding, `file-coverage` for one per file. |
| `architecture` | No | `single-pass` | Prompt architecture to run. |
| `prompt-root` | No | `prompts` | Directory with manifests and prompt files. |
| `output-path` | No | `CCR.md` | Report output path. |
| `base-ref` | No | inferred from PR or `HEAD~1` | Base git ref for diff. |
| `head-ref` | No | inferred from PR or `HEAD` | Head git ref for diff. |
| `include-globs` | No | `**/*` | Comma-separated included paths. |
| `exclude-globs` | No | `node_modules/**,dist/**,coverage/**,.git/**` | Comma-separated excluded paths. |
| `max-files` | No | `25` | Max changed files to include. |
| `max-context-chars` | No | `12000` | Total prompt payload budget. |
| `temperature` | No | `0.2` | Model sampling temperature. |
| `request-timeout-ms` | No | `120000` | Model request timeout. |

## Outputs

| Output | Meaning |
| --- | --- |
| `report-path` | Path to the generated `CCR.md`. |
| `summary` | Concise review summary. |
| `risk-level` | Overall risk level. |
| `finding-count` | Number of findings. |
| `architecture` | Architecture ID that ran. |
| `inline-comments-posted` | Inline comments posted. |
| `inline-comments-skipped` | Findings skipped during comment mapping. |

## Permissions

Report generation only:

```yaml
permissions:
  contents: read
```

With inline PR comments:

```yaml
permissions:
  contents: read
  pull-requests: write
```

For `pull_request` events, checkout is optional because the action collects files through the GitHub PR API. Use `actions/checkout@v6` with `fetch-depth: 0` when relying on non-PR execution or explicit `base-ref`/`head-ref`.

## Example Workflow

### Minimal Setup

Drop this into `.github/workflows/ccr-review.yml` to get started:

```yaml
name: CCR Review

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write

jobs:
  ccr-review:
    if: github.event.pull_request.draft == false && github.event.pull_request.head.repo.fork == false
    runs-on: ubuntu-latest

    steps:
      - name: Run CCR review
        uses: VanGoghCode/critical-code-reviewer@main
        with:
          api-key: ${{ secrets.ASU_API_KEY }}
          github-token: ${{ github.token }}
          model: gpt5_2
```

### Full Configuration

Every available input with inline comments explaining what each does:

```yaml
name: CCR Review

# ── Trigger on PR events ──────────────────────────────────────────────
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

# ── Required permissions ──────────────────────────────────────────────
permissions:
  contents: read          # needed to read repo files via API
  pull-requests: write    # needed to post inline review comments

jobs:
  ccr-review:
    # Skip draft PRs and fork PRs (forks cannot access secrets)
    if: github.event.pull_request.draft == false && github.event.pull_request.head.repo.fork == false
    runs-on: ubuntu-latest

    steps:
      # Checkout is optional for pull_request events — the action fetches
      # files through the GitHub PR API. Include it only if you need local
      # git operations or are using explicit base-ref/head-ref.
      - name: Checkout repository
        uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history needed for local git diff

      - name: Run CCR review
        uses: VanGoghCode/critical-code-reviewer@main
        with:

          # ── Required ──────────────────────────────────────────────
          # ASU AIML API key (store as a repository secret)
          api-key: ${{ secrets.ASU_API_KEY }}

          # ASU model name — see ASU AIML docs for available models
          # Examples: gpt5_2, gpt5_1, gpt4o, gpt4_1, claude4_5_sonnet
          model: gpt5_2

          # ── Authentication ────────────────────────────────────────
          # GitHub token for posting inline PR comments.
          # ${{ github.token }} is auto-provided by Actions.
          github-token: ${{ github.token }}

          # ── Provider endpoint ─────────────────────────────────────
          # Override if using a different ASU AIML environment.
          # Default: https://api-main.aiml.asu.edu/queryV2
          # base-url: https://api-main-beta.aiml.asu.edu/queryV2

          # ASU provider identifier sent with each request.
          # Default: asu
          # model-provider: asu

          # ── Architecture ──────────────────────────────────────────
          # single-pass : one LLM call, fastest, good for small PRs
          # iterative   : 6 sequential stages, thorough, slower
          # parallel    : 6 stages in parallel + combine, best coverage
          # Default: single-pass
          architecture: parallel

          # ── Inline comments ───────────────────────────────────────
          # Post short review comments on specific PR lines.
          # Default: "false"
          post-inline-comments: "true"

          # Cap on inline comments per run to avoid noisy PRs.
          # Default: "10"
          inline-comment-limit: "10"

          # Strategy for placing inline comments:
          #   findings      — one comment per finding (may cluster)
          #   file-coverage — one comment per file with findings (spread)
          # Default: findings
          inline-comment-mode: file-coverage

          # ── Scope filtering ───────────────────────────────────────
          # Comma-separated globs for files to include in review.
          # Default: "**/*"
          include-globs: "**/*"

          # Comma-separated globs for files to exclude from review.
          # Default: "node_modules/**,dist/**,coverage/**,.git/**"
          exclude-globs: "node_modules/**,dist/**,coverage/**,.git/**,*.lock,*.min.js"

          # ── Payload limits ────────────────────────────────────────
          # Maximum number of changed files to send to the LLM.
          # Default: "25"
          max-files: "25"

          # Total character budget for file context in the prompt.
          # Higher = more context but slower and more expensive.
          # Default: "12000"
          max-context-chars: "12000"

          # ── Model tuning ──────────────────────────────────────────
          # Sampling temperature — lower is more deterministic.
          # Default: "0.2"
          temperature: "0.2"

          # Request timeout in milliseconds.
          # Increase for large PRs or slow models.
          # Default: "120000" (2 minutes)
          request-timeout-ms: "120000"

          # ── Output ────────────────────────────────────────────────
          # Path where the CCR markdown report is written.
          # Default: CCR.md
          output-path: CCR.md

          # ── Custom prompts ────────────────────────────────────────
          # Directory containing architecture manifests and prompt files.
          # Relative paths resolve inside the action package.
          # Absolute paths point to files in the consuming repository.
          # Default: prompts
          # prompt-root: ${{ github.workspace }}/.github/ccr-prompts

          # ── Git refs (advanced) ───────────────────────────────────
          # Override the diff range. Auto-inferred for pull_request events.
          # Default: inferred from PR event or HEAD~1 / HEAD
          # base-ref: ${{ github.event.pull_request.base.sha }}
          # head-ref: ${{ github.event.pull_request.head.sha }}

      # Upload the report as a workflow artifact so it's downloadable
      # even if the review step fails.
      - name: Upload CCR report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ccr-report-${{ github.run_id }}
          path: CCR.md
          if-no-files-found: ignore
```

## Quick Setup

1. Add one of the workflows above at `.github/workflows/ccr-review.yml` in your repository.
2. Add a repository secret named `ASU_API_KEY` with your ASU AIML API key.
3. Open a PR and verify `CCR.md` appears in the workflow artifact.

For stability, pin to a release tag (e.g. `@v1`) or a commit SHA instead of `@main`.

## Build and Test

**TypeScript Action:**

```bash
npm ci
npm run typecheck
npm run build
npm test
```

**Python Reviewer:**

```bash
pip install -r requirements.txt
python -m pytest tests/ -v
```

## Release

1. Rebuild the bundle: `npm run build`
2. Commit the updated `dist/index.cjs`
3. Publish a versioned release tag (e.g. `v1.0.0`)
4. Move the major tag (`v1`) to the latest compatible release commit

## Notes

- The action always writes a markdown report. Inline comments require `post-inline-comments: "true"` plus `pull-requests: write`.
- Inline comments are published as PR review comments and support single-line or block ranges.
- The action deduplicates against existing inline review comments to avoid reposting on `synchronize` events.
- Fork PRs cannot access repository secrets (`ASU_API_KEY`), so the workflow should skip forks.
