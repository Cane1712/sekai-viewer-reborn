# Single-app Docker builds

- The repository root `tsconfig.json` is an aggregate TypeScript solution that references every SvelteKit app and each app's generated `.svelte-kit/tsconfig.json`.
- Each app Dockerfile uses the repository root as its build context but builds only one app. After `COPY . .`, remove the aggregate `tsconfig.json` from the build stage, run `svelte-kit sync` only for the target app, and then run that app's build. Otherwise a clean build can fail while resolving another app's missing generated tsconfig.
- Keep the aggregate `tsconfig.json` available for local and CI workspace-wide checks; this is a container-only workaround for single-app image builds.
- The pattern is implemented in `apps/account-site/Dockerfile`, `apps/content-site/Dockerfile`, `apps/media-lab-site/Dockerfile`, and `apps/tools-site/Dockerfile`.
- `pnpm verify:adapter-node-build` rebuilds all four apps and checks adapter-node server chunks, SSR route-node imports, unprefixed runtime environment variables, and content-site client retention for Howler and EventDebugDialog.
