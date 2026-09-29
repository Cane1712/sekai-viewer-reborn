import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    svelte({
      prebundleSvelteLibraries: false
    }),
    svelteTesting()
  ],
  resolve: {
    alias: [
      { find: /^node:module$/, replacement: "module" },
      {
        find: "$app/paths",
        replacement: new URL("./src/lib/test/app-paths.ts", import.meta.url).pathname
      },
      {
        find: "$app/environment",
        replacement: new URL("./src/lib/test/app-environment.ts", import.meta.url).pathname
      },
      {
        find: "$app/navigation",
        replacement: new URL("./src/lib/test/app-navigation.ts", import.meta.url).pathname
      },
      {
        find: "$app/state",
        replacement: new URL("./src/lib/test/app-state.ts", import.meta.url).pathname
      },
      {
        find: "$env/dynamic/public",
        replacement: new URL("./src/lib/test/public-env.ts", import.meta.url).pathname
      },
      {
        find: "$lib",
        replacement: new URL("./src/lib", import.meta.url).pathname
      }
    ],
    conditions: ["browser", "node", "module-sync"]
  },
  ssr: {
    noExternal: [
      "svelte",
      /^svelte\//,
      "@iconify/svelte",
      "@testing-library/svelte",
      "@testing-library/svelte-core"
    ],
    resolve: {
      conditions: ["node", "module-sync"],
      externalConditions: ["node", "module-sync"]
    }
  },
  test: {
    deps: {
      optimizer: {
        client: { enabled: false }
      }
    },
    server: {
      deps: {
        inline: [
          "svelte",
          "@iconify/svelte",
          "@testing-library/svelte",
          "@testing-library/svelte-core",
          // Node's native loader re-parses this package's 1.5 MB exports map for
          // every icon file it imports; inlining keeps icon loads off that path.
          "@iconify-icons/mdi"
        ]
      }
    },
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/.svelte-kit/**", "**/dist/**", "**/build/**"],
    include: ["src/**/*.test.ts"],
    setupFiles: ["../../test/setup.js"],
    coverage: {
      include: [
        "src/lib/a11y/tablist.ts",
        "src/lib/i18n/region.ts",
        "src/lib/i18n/runtime.ts",
        "src/lib/icons/mdi.ts",
        "src/lib/promise-cache.ts",
        "src/lib/page-title.ts",
        "src/lib/tools-site.ts",
        "src/lib/support-provider-url.ts",
        "src/lib/server/music-list.ts",
        "src/lib/server/music-detail.ts",
        "src/lib/server/gacha-detail.ts",
        "src/lib/server/gacha-list.ts",
        "src/lib/server/unit-detail.ts",
        "src/lib/server/gacha-probability.ts",
        "src/lib/server/game-news.ts",
        "src/lib/server/home-latest-data.ts",
        "src/lib/server/home-page-data.ts",
        "src/lib/server/honor-list.ts",
        "src/lib/server/mission-list.ts",
        "src/lib/server/catalogue-data.ts",
        "src/lib/server/event-detail.ts",
        "src/lib/server/title-preview.ts",
        "src/lib/server/virtual-live-detail.ts",
        "src/lib/server/response-values.ts",
        "src/lib/server/secure-random.ts",
        "src/lib/components/mission/catalogue-groups.ts",
        "src/lib/components/shared/title-preview-labels.ts",
        "src/lib/domain/mission.ts",
        "src/lib/domain/reward-item.ts",
        "src/lib/domain/title-preview.ts",
        "src/lib/domain/unit-detail.ts",
        "src/lib/domain/unit-icon.ts",
        "src/lib/styles/event-card.ts",
        "src/lib/styles/reward-chip.ts",
        "src/routes/api/gacha/[region]/[id]/pull/+server.ts",
        "src/routes/api/home/[region]/+server.ts",
        "src/routes/api/gacha/[region]/[id]/pull/pull-behavior.ts",
        "src/routes/api/gacha/[region]/[id]/pull/pull-pool.ts",
        "src/routes/card/[region]/[id]/+page.server.ts",
        "src/routes/character/[region]/[id]/+page.server.ts",
        "src/routes/event/[region]/[id]/+page.server.ts",
        "src/routes/+page.server.ts",
        "src/routes/news/[region]/+page.server.ts",
        "src/routes/news/[region]/region-options.ts",
        "src/routes/honors/[region]/+page.server.ts",
        "src/routes/honors/[region]/preview/[kind]/[id]/+server.ts",
        "src/routes/missions/[region]/+page.server.ts",
        "src/routes/unit/[region]/[unit]/+page.server.ts",
        "src/routes/+layout.server.ts",
        "src/routes/musics/[region]/+page.server.ts",
        "src/routes/musics/[region]/data/+server.ts",
        "src/routes/musics/[region]/metadata/+server.ts",
        "src/routes/virtual-live/[region]/[id]/+page.server.ts"
      ],
      reporter: ["lcov"]
    }
  }
});
