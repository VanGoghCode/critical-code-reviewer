# CCR Review Action

CCR Review is a reusable GitHub Action that reviews a PR-style change set, runs one of three configurable prompt architectures, and writes the resulting report to `CCR.md` in the repository root.

The published action surface is the Node 24 action defined in `action.yml`.

## What It Does

- Collects changed files from the pull request API when PR context is available, or falls back to explicit local git ranges.
- Feeds changed file content, git range context, and commit messages into a shared review engine.
- Runs one of three architectures:
  - `single-pass`: one review call over the entire change set.
  - `iterative`: six shared sequential stages that refine the previous stage output.
  - `parallel`: the same six shared stages in parallel followed by a combine stage.
- Writes the final markdown report to `CCR.md` or a path you choose.
- Optionally posts short inline pull request review comments on mapped changed lines.
- Exposes outputs for report path, summary, risk level, finding count, architecture ID, and inline comment counts.

Prompt files are part of this repository and are bundled with each action release tag.

## Where To Set Up Prompts

Edit these files to define the review behavior:

- [prompts/architectures/single-pass/manifest.json](prompts/architectures/single-pass/manifest.json) to control the single-pass architecture shape.
- [prompts/architectures/iterative/manifest.json](prompts/architectures/iterative/manifest.json) to control the six-stage iterative pipeline.
- [prompts/architectures/parallel/manifest.json](prompts/architectures/parallel/manifest.json) to control the six-stage parallel pipeline and its final combiner.
- [prompts/architectures/single-pass/prompt.md](prompts/architectures/single-pass/prompt.md) for the single-pass prompt body.
- [prompts/shared/stages/stage-1.md](prompts/shared/stages/stage-1.md) through [prompts/shared/stages/stage-6.md](prompts/shared/stages/stage-6.md) for the shared iterative and parallel stages.
- [prompts/architectures/parallel/combine.md](prompts/architectures/parallel/combine.md) for the final parallel merge prompt.

The action reads these prompts from the bundled action path in GitHub Actions, so consumers do not need to copy the prompts into their own repository.

## Why Use It

- You want a reusable review action with a publishable GitHub Action package.
- You want to compare multiple prompt architectures against the same sample change set.
- You want deterministic PR review automation in CI with configurable prompt architectures.

## Inputs

| Input | Required | Default | Purpose |
| --- | --- | --- | --- |
| `api-key` | Yes | - | API key for the ASU AIML review provider. |
| `base-url` | No | `https://api-main.aiml.asu.edu/queryV2` | Base URL for the ASU AIML query endpoint. |
| `model-provider` | No | `asu` | ASU model provider identifier included in query requests. |
| `model` | Yes | - | ASU model name to use for the review. |
| `github-token` | No | - | GitHub token used to publish inline PR comments when enabled. |
| `post-inline-comments` | No | `false` | Whether to publish short inline comments on changed lines in pull requests. |
| `inline-comment-limit` | No | `10` | Maximum number of inline comments posted per run. |
| `inline-comment-mode` | No | `findings` | Inline comment strategy: `findings` posts per finding, `file-coverage` ensures at least one comment per file with mappable findings. |
| `architecture` | No | `single-pass` | Which architecture manifest to run. |
| `prompt-root` | No | `prompts` | Directory containing the architecture manifests and prompt files. |
| `output-path` | No | `CCR.md` | Where the final markdown report should be written. |
| `base-ref` | No | inferred from the PR event or `HEAD~1` | Base git ref for the diff. |
| `head-ref` | No | inferred from the PR event or `HEAD` | Head git ref for the diff. |
| `include-globs` | No | `**/*` | Comma-separated list of included paths. |
| `exclude-globs` | No | `node_modules/**,dist/**,coverage/**,.git/**` | Comma-separated list of excluded paths. |
| `max-files` | No | `25` | Maximum number of changed files to include. |
| `max-context-chars` | No | `12000` | Total prompt payload budget used to truncate file context. |
| `temperature` | No | `0.2` | Sampling temperature for the model request. |
| `request-timeout-ms` | No | `120000` | Timeout for the model request. |

## Outputs

| Output | Meaning |
| --- | --- |
| `report-path` | Absolute or workspace-relative path to the generated `CCR.md` file. |
| `summary` | Concise summary extracted from the final review output. |
| `risk-level` | Final risk level returned by the review. |
| `finding-count` | Number of findings in the generated report. |
| `architecture` | Architecture ID that ran for the review. |
| `inline-comments-posted` | Number of inline comments posted on the pull request. |
| `inline-comments-skipped` | Number of findings skipped during inline comment mapping. |

## Permissions

Minimum permission for report generation:

```yaml
permissions:
  contents: read
```

If you enable inline PR comments, add pull request write permission:

```yaml
permissions:
  contents: read
  pull-requests: write
```

For `pull_request` runs with `github-token`, checkout is optional because changed files and patches are collected through GitHub pull request APIs.
Use `actions/checkout@v5` with `fetch-depth: 0` when you rely on non-PR execution or explicit `base-ref`/`head-ref` local git diff workflows.

## Example Workflow

```yaml
name: CCR Review

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest

    steps:
      - name: Run CCR review
        uses: VanGoghCode/critical-code-reviewer@main
        with:
          api-key: ${{ secrets.ASU_API_KEY }}
          github-token: ${{ github.token }}
          base-url: https://api-main.aiml.asu.edu/queryV2
          model-provider: asu
          model: gpt5_2
          architecture: parallel
          post-inline-comments: "true"
          inline-comment-limit: "10"
          inline-comment-mode: file-coverage
          output-path: CCR.md

      - name: Upload CCR report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ccr-report-${{ github.run_id }}
          path: CCR.md
          if-no-files-found: ignore
```

## Quick Setup In Any Repository

1. Add the workflow shown above at `.github/workflows/ccr-review.yml`.
2. Set `uses` to this action ref, for example `VanGoghCode/critical-code-reviewer@main`.
3. Add a repository secret named `ASU_API_KEY`.
4. Open a PR and verify `CCR.md` is generated in the workflow artifact.

For production stability, pin to a release tag (for example `@v1`) or a commit SHA once published.

## Common Customizations

Change these `with` inputs in the workflow:

- `architecture`: `single-pass` | `iterative` | `parallel`
- `model`: set your preferred model name
- `base-url`: set your ASU AIML endpoint
- `model-provider`: set your ASU provider identifier when required
- `post-inline-comments`: `true` to publish short line-level PR comments
- `inline-comment-limit`: cap inline comments per run
- `inline-comment-mode`: `findings` for per-finding comments, `file-coverage` to prioritize one comment per changed file with mappable findings
- `output-path`: change review report output file
- `include-globs` / `exclude-globs`: limit reviewed files
- `max-files` / `max-context-chars`: control payload size
- `temperature` / `request-timeout-ms`: tune model behavior and timeout

## Prompt Source Options

- Default: use prompts bundled inside this action release.
- Repository-specific prompts: keep the same prompt/manifest structure in the repository where the workflow runs and set an absolute prompt root.

```yaml
with:
  prompt-root: ${{ github.workspace }}/.github/ccr-prompts
```

Relative `prompt-root` resolves inside the action package path. Use absolute path for repository-local prompt folders.

## Build And Test

```bash
npm run build
npm test
npm run lint
npm run typecheck
```

## Release Guidance

1. Publish a versioned release tag, for example `v1.0.0`.
2. Move the major tag `v1` to the latest compatible `v1.x.y` release commit.
3. Ask consumers to pin either `@v1` for compatibility or a full commit SHA for maximum reproducibility.
4. Keep the committed `dist/index.cjs` in sync with the TypeScript source by rebuilding before each release.

## Notes

- The action always writes a markdown report (default `CCR.md`, configurable via `output-path`). Inline PR comments are optional and require `post-inline-comments: "true"` plus `pull-requests: write` permission.
- Inline PR comments are published as pull request review comments and support single-line or block ranges when findings include `line` and `endLine`.
- Pull request mode deduplicates against existing inline review comments to avoid reposting identical comments on every synchronize event.
- Update prompts in this repository and release a new tag when you want all repositories using this action to get new review behavior.
