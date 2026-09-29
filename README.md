# Multi-Site Platform Monorepo

Monorepo for the Sekai viewer platform and related sites.

## Stack

- pnpm workspace
- Turborepo
- TypeScript
- SvelteKit 2
- Tailwind CSS 4

## Monorepo Structure

```text
apps/
  content-site/
  tools-site/
  media-lab-site/
  account-site/
packages/
  i18n-runtime/
  sekai-api-sdk/
  sekai-master-api-sdk/
  auth-client/
  ui-shell/
  ui-tokens/
deploy/
  helm/
    sekai-viewer-reborn/
      Chart.yaml
      values.yaml
      templates/
```

## Apps

Apps in this workspace:

- `apps/content-site`
- `apps/tools-site`
- `apps/media-lab-site`
- `apps/account-site`

## Roadmap

High-level platform direction, content coverage, and current development
priorities are tracked in [`docs/roadmap.md`](docs/roadmap.md).

## Shared Packages

- `@platform/sekai-api-sdk`: sekai-api OpenAPI SDK generator scaffold
- `@platform/sekai-master-api-sdk`: sekai-master-api OpenAPI SDK generator and client package
- `@platform/auth-client`: Keycloak/OIDC helper URL builders
- `@platform/i18n-runtime`: shared remote dictionary loader and `svelte-i18n` runtime wrapper
- `@platform/ui-shell`: shared Svelte shell and region-switcher components
- `@platform/ui-tokens`: framework-agnostic design tokens (JSON + TS export)

## Prerequisites

- Node.js 24+
- pnpm 11+

## Local Development

Install dependencies:

```bash
pnpm install
```

Run all apps in parallel via Turborepo:

```bash
pnpm dev
```

Typical local URLs:

- content-site: `http://localhost:4101`
- tools-site: `http://localhost:4102`
- media-lab-site: `http://localhost:4103`
- account-site: `http://localhost:4104`

Run one app only:

```bash
pnpm --filter @apps/content-site dev
```

`content-site` currently depends on these environment variables:

- `SEKAI_MASTER_API_BASE_URL`
- `SEKAI_API_BASE_URL`
- `PUBLIC_REMOTE_ASSET_BASE_URL`
- `PUBLIC_SEKAI_I18N_BASE_URL` (defaults to `https://sekai-world.github.io/sekai-i18n-reborn`)
- `PUBLIC_TOOLS_SITE_BASE_URL` (optional; when unset, Event Tracker entry points stay hidden)

## Git Hooks

A `post-checkout` hook is provided to auto-restart the SvelteKit dev server
when switching branches. Without it, Vite's file watcher detects deleted route
files and crashes the dev server with an ENOENT error.

This repository uses native Git hooks, not Husky. The hooks are opt-in and are
not enabled automatically. The tracked hooks live at the relative path
`scripts/git-hooks`; `pnpm hooks:install` configures Git's local
`core.hooksPath` to use them. Enable them once after cloning:

```bash
pnpm hooks:install
```

This setting is local-only (not tracked by git). The `post-checkout` hook only
fires on branch switches (`git checkout` / `git switch` / fast-forward `git
pull`), not on single-file checkouts.

When installed:

- `pre-commit` runs a Prettier check on all staged files and fast ESLint
  validation on staged JavaScript, TypeScript, and Svelte source files under
  `apps/*/src`, `packages/*/src`, and `scripts`.
- `pre-push` requires a clean worktree, including ordinary untracked files, and
  validates the branch against its merge base with the default branch: a
  Prettier check on the changed files, one parallel
  `turbo run test lint check --affected --concurrency=4` over the changed packages and their
  dependents, and `pnpm i18n:check`. A change outside `apps/`, `packages/`,
  `docs/`, `.changeset/` and Markdown files (root configuration such as the
  lockfile, Prettier, ESLint, TypeScript or Turbo) runs the full gate over every
  package instead. It intentionally skips the full production build so that
  pushes get fast local feedback; CI continues to run the unchanged
  `pnpm verify:ci` sequence, including `pnpm build`.

Use `--no-verify` as an explicit escape hatch when a hook must be bypassed:

```bash
git commit --no-verify
git push --no-verify
```

## Build, Check, Lint, Format

Build everything:

```bash
pnpm build
```

Type/lint checks:

```bash
pnpm check
pnpm lint
pnpm i18n:check
```

Format:

```bash
pnpm format
pnpm format:check
```

## I18n Source Sync

`content-site` source strings live in:

- `packages/i18n-source/content-site/common.json`
- `packages/i18n-source/content-site/home.json`
- `packages/i18n-source/content-site/card.json`
- `packages/i18n-source/content-site/character.json`
- `packages/i18n-source/content-site/event.json`
- `packages/i18n-source/content-site/music.json`
- `packages/i18n-source/content-site/virtual-live.json`
- `packages/i18n-source/content-site/error.json`
- `packages/i18n-source/content-site/server.json`

`pnpm i18n:check` verifies referenced keys are present. On `main`, `.github/workflows/i18n-sync.yml` syncs these English source files to `Sekai-World/sekai-i18n-reborn` and opens a pull request for Weblate ingestion. Manual workflow runs can enable `prune` to remove stale English source keys from the translation repository.

## Release And Changelog

This repository now uses Changesets for workspace versioning and changelog generation.

Create a changeset for a user-facing change:

```bash
pnpm changeset
```

Check pending release state:

```bash
pnpm changeset:status
```

Generate version bumps and `CHANGELOG.md` updates locally:

```bash
pnpm release:version
```

Create Git tags after the version commit is ready:

```bash
pnpm release:tag
```

Run both steps together:

```bash
pnpm release
```

Notes:

- Pull requests that change `apps/*` or `packages/*` are checked by `.github/workflows/changeset.yml` and must include a changeset file, unless they are the auto-generated release PR.
- `.github/workflows/ci.yml` uses `pnpm verify:ci` as the validation source of truth on pushes to `main` and on pull requests.
- The GitHub Actions workflow at `.github/workflows/release.yml` opens or updates a release PR whenever changesets land on `main`.
- After the release PR is merged, `.github/workflows/release.yml` creates any missing workspace tags for the changed package versions and then creates matching GitHub releases.
- If you need to rerun just the GitHub Release publish step locally or in CI, use `pnpm release:github`.
- `pnpm release:publish` is an alias of `pnpm release:github`.
- All workspaces in this repo are private, so Changesets is configured to version and tag private packages too.
- Changeset entries should be committed as markdown files under `.changeset/`.
- If a code change should not produce a user-facing release note, use `pnpm changeset --empty`.

## Docker (Per App)

Each app has its own Dockerfile for independent image builds:

- `apps/content-site/Dockerfile`
- `apps/tools-site/Dockerfile`
- `apps/media-lab-site/Dockerfile`
- `apps/account-site/Dockerfile`

Build one image (example: content-site):

```bash
docker build -f apps/content-site/Dockerfile -t your-org/content-site:latest .
```

Run locally:

```bash
docker run --rm -p 3000:3000 your-org/content-site:latest
```

Repeat with the corresponding Dockerfile and image name for the other apps.

## Deployment (Helm and Kubernetes)

The recommended deployment path is the single application Helm chart at
[`deploy/helm/sekai-viewer-reborn`](deploy/helm/sekai-viewer-reborn). It manages
the four apps independently through `.Values.apps` in one release. Each enabled
app gets its own Deployment, ClusterIP Service, Ingress, and (by default) Pod
DisruptionBudget. The chart does not render a Namespace; Helm scopes names to
the release namespace, so use `--namespace` and `--create-namespace` when the
namespace should be created for the release.

Validate and render the chart:

```bash
helm lint deploy/helm/sekai-viewer-reborn
helm template viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --set-string apps.content-site.env.SEKAI_MASTER_API_BASE_URL=https://master-api.example.com \
  --set-string apps.content-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.content-site.env.PUBLIC_REMOTE_ASSET_BASE_URL=https://assets.example.com \
  --set-string apps.tools-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.media-lab-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.account-site.env.SEKAI_API_BASE_URL=https://api.example.com
```

Install or upgrade all enabled apps:

```bash
helm upgrade --install viewer deploy/helm/sekai-viewer-reborn \
  --namespace viewer \
  --create-namespace \
  --set-string apps.content-site.env.SEKAI_MASTER_API_BASE_URL=https://master-api.example.com \
  --set-string apps.content-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.content-site.env.PUBLIC_REMOTE_ASSET_BASE_URL=https://assets.example.com \
  --set-string apps.tools-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.media-lab-site.env.SEKAI_API_BASE_URL=https://api.example.com \
  --set-string apps.account-site.env.SEKAI_API_BASE_URL=https://api.example.com
```

Disable apps that are not being deployed with, for example,
`--set apps.tools-site.enabled=false`. Use `--set-string` for URL environment
values such as
`--set-string apps.content-site.env.SEKAI_MASTER_API_BASE_URL=...`. To roll back,
inspect `helm history viewer --namespace viewer` and run
`helm rollback viewer <REVISION> --namespace viewer`.

The chart's canonical operator prerequisites, values-file preparation,
validation, `--atomic` installation and upgrade recovery, and rollback
instructions are in
[`deploy/helm/sekai-viewer-reborn/README.md`](deploy/helm/sekai-viewer-reborn/README.md).
