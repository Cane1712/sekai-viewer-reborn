<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Snippet } from "svelte";
  import BrandLockup from "./brand-lockup.svelte";
  import type { SidebarItem } from "./viewer-shell.types";

  type Props = {
    drawerId: string;
    navTitle: string;
    navBadge?: string;
    navActions?: Snippet;
    bottomNavigation?: Snippet;
    siteVersion?: string;
    desktopRailOpen?: boolean;
    skipToMainLabel?: string;
    openSidebarLabel?: string;
    closeSidebarLabel?: string;
    sidebarLabel?: string;
    sidebarItems?: SidebarItem[];
    showTitle?: boolean;
    title?: string;
    titleBadge?: string;
    /** Width cap for the centered navbar row and main content column. */
    mainWidthClass?: string;
    children?: Snippet;
  };

  let {
    drawerId,
    navTitle,
    navBadge,
    navActions,
    bottomNavigation,
    siteVersion,
    desktopRailOpen = false,
    skipToMainLabel = "Skip to main content",
    openSidebarLabel = "Open navigation",
    closeSidebarLabel = "Close navigation",
    sidebarLabel = "Navigation",
    sidebarItems = [],
    showTitle = true,
    title = "Sekai Viewer",
    titleBadge = "reborn",
    mainWidthClass = "max-w-384",
    children
  }: Props = $props();

  let sidebarOpen = $state(false);
  const sidebarPanelId = $derived(`${drawerId}-panel`);
  const mainId = $derived(`${drawerId}-main`);

  const siteVersionDisplay = $derived(
    siteVersion ? (siteVersion.startsWith("v") ? siteVersion : `v${siteVersion}`) : ""
  );
</script>

<a class="viewer-shell-skip" href={`#${mainId}`}>{skipToMainLabel}</a>

<div class:xl:drawer-open={desktopRailOpen} class="drawer min-h-dvh">
  <input
    id={drawerId}
    type="checkbox"
    class="drawer-toggle"
    bind:checked={sidebarOpen}
    aria-hidden="true"
    tabindex="-1"
  />

  <div class="drawer-content bg-base-200">
    <header
      class="viewer-shell-nav sticky top-3 z-40 mx-3 mt-3 isolate overflow-visible rounded-full border px-2 lg:top-4 lg:mx-6 lg:mt-4"
    >
      <div class={`navbar relative z-10 mx-auto min-h-14 w-full ${mainWidthClass} px-2`}>
        <div class="navbar-start">
          <button
            type="button"
            class={`btn btn-ghost btn-circle size-11! min-h-11! ${desktopRailOpen ? "xl:hidden" : ""}`}
            aria-label={openSidebarLabel}
            aria-controls={sidebarPanelId}
            aria-expanded={sidebarOpen}
            onclick={() => {
              sidebarOpen = true;
            }}
          >
            <Icon icon="mdi:menu" class="size-5" aria-hidden="true" />
          </button>
          <span
            class="hidden text-xs font-semibold tracking-[0.16em] text-base-content/55 uppercase lg:inline"
          >
            {navTitle}
          </span>
        </div>
        <div class="navbar-center lg:hidden">
          <span
            class="max-w-28 truncate text-xs font-semibold tracking-wide sm:max-w-none sm:text-sm"
          >
            {navTitle}
          </span>
        </div>
        <div class="navbar-end gap-2">
          {#if siteVersion}
            <span
              class="badge badge-outline badge-sm font-medium text-base-content/60"
              title="Site version"
            >
              <span class="sr-only">Site version: </span>{siteVersionDisplay}
            </span>
          {/if}
          {#if navActions}
            {@render navActions()}
          {:else if navBadge}
            <span class="badge badge-outline">{navBadge}</span>
          {/if}
        </div>
      </div>
    </header>

    <main
      id={mainId}
      tabindex="-1"
      class:viewer-shell-main-with-bottom-navigation={bottomNavigation}
      class={`viewer-shell-main mx-auto w-full ${mainWidthClass} px-3 pb-8 pt-6 md:px-6 lg:px-8`}
    >
      {#if showTitle}
        <section class="py-12 text-center">
          <BrandLockup heading={true} {title} badge={titleBadge} />
        </section>
      {/if}

      {@render children?.()}
    </main>
  </div>

  <div class={`drawer-side z-50 ${desktopRailOpen ? "xl:z-30" : ""}`}>
    <button
      type="button"
      aria-label={closeSidebarLabel}
      class={`drawer-overlay ${desktopRailOpen ? "xl:hidden" : ""}`}
      onclick={() => {
        sidebarOpen = false;
      }}
    ></button>
    <nav
      id={sidebarPanelId}
      aria-label={sidebarLabel}
      class={`viewer-shell-rail menu min-h-full w-72 bg-base-100 p-4 ${desktopRailOpen ? "xl:w-68 xl:border-r xl:border-base-content/10 xl:px-3 xl:py-5" : ""}`}
    >
      <div class="mb-2 flex items-center justify-between px-2 py-1">
        <span class="text-sm font-semibold">{sidebarLabel}</span>
        <button
          type="button"
          class={`btn btn-ghost btn-sm btn-circle size-11! min-h-11! ${desktopRailOpen ? "xl:hidden" : ""}`}
          aria-label={closeSidebarLabel}
          aria-controls={sidebarPanelId}
          onclick={() => {
            sidebarOpen = false;
          }}
        >
          <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
        </button>
      </div>
      <ul>
        {#each sidebarItems as item (`${item.type ?? "link"}:${item.label}`)}
          {#if item.type === "section"}
            <li class="px-2 pt-4 first:pt-0">
              <div class="menu-title pointer-events-none px-0 py-1 select-none">
                <span>{item.label}</span>
              </div>
            </li>
          {:else if item.href && !item.disabled}
            <li>
              <a
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                class={`grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-3 ${item.active ? "active" : ""}`}
                onclick={() => {
                  sidebarOpen = false;
                }}
              >
                {#if item.icon}
                  <span class="grid size-5 shrink-0 place-items-center">
                    <Icon icon={item.icon} class="size-4 shrink-0" aria-hidden="true" />
                  </span>
                {/if}
                <span class={item.icon ? "" : "col-span-2"}>{item.label}</span>
              </a>
            </li>
          {:else}
            <li>
              <button
                type="button"
                disabled
                class="grid min-h-11 w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-3 opacity-45"
              >
                {#if item.icon}
                  <span class="grid size-5 shrink-0 place-items-center">
                    <Icon icon={item.icon} class="size-4 shrink-0" aria-hidden="true" />
                  </span>
                {/if}
                <span class={item.icon ? "" : "col-span-2"}>{item.label}</span>
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    </nav>
  </div>
</div>

{#if bottomNavigation}
  {@render bottomNavigation()}
{/if}

<style>
  .viewer-shell-skip {
    position: fixed;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 100;
    transform: translateY(-160%);
    border-radius: 9999px;
    background: var(--color-primary);
    color: var(--color-primary-content);
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 700;
    transition: transform 150ms ease-out;
  }

  .viewer-shell-skip:focus-visible,
  .viewer-shell-main:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 4px;
  }

  .viewer-shell-skip:focus-visible {
    transform: translateY(0);
    outline-color: var(--color-primary-content);
    outline-offset: 2px;
  }

  .viewer-shell-nav {
    background: color-mix(in oklab, var(--color-base-100) 92%, transparent);
    border-color: color-mix(in oklab, var(--color-base-content) 12%, transparent);
    box-shadow: 0 4px 14px color-mix(in oklab, var(--color-base-content) 7%, transparent);
  }

  /* Frosted glass: the page shows through a lighter tint, and the edge reads as glass
     through a light rim, a top highlight, a faint bottom edge, and a hairline outline. */
  @supports (backdrop-filter: blur(1px)) {
    .viewer-shell-nav {
      background: color-mix(in oklab, var(--color-base-100) 62%, transparent);
      border-color: color-mix(in oklab, var(--color-base-100) 75%, transparent);
      box-shadow:
        inset 0 1px 0 color-mix(in oklab, var(--color-base-100) 90%, transparent),
        inset 0 -1px 0 color-mix(in oklab, var(--color-base-content) 6%, transparent),
        0 0 0 1px color-mix(in oklab, var(--color-base-content) 8%, transparent),
        0 6px 20px color-mix(in oklab, var(--color-base-content) 9%, transparent);
      backdrop-filter: blur(16px) saturate(160%);
      -webkit-backdrop-filter: blur(16px) saturate(160%);
    }

    /* On a dark base the rim and highlight come from the light foreground instead. */
    :global(:root.dark) .viewer-shell-nav {
      border-color: color-mix(in oklab, var(--color-base-content) 16%, transparent);
      box-shadow:
        inset 0 1px 0 color-mix(in oklab, var(--color-base-content) 18%, transparent),
        inset 0 -1px 0 color-mix(in oklab, var(--color-base-100) 40%, transparent),
        0 0 0 1px color-mix(in oklab, var(--color-base-100) 50%, transparent),
        0 6px 20px color-mix(in oklab, var(--color-base-300) 70%, transparent);
    }
  }

  .viewer-shell-rail {
    background: color-mix(in oklab, var(--color-base-100) 96%, var(--color-base-200));
  }

  :global([data-low-motion]) .viewer-shell-nav {
    background: color-mix(in oklab, var(--color-base-100) 92%, transparent);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .viewer-shell-nav {
      background: color-mix(in oklab, var(--color-base-100) 92%, transparent);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    .viewer-shell-skip {
      transition: none;
    }
  }

  :global([data-low-motion]) .viewer-shell-skip {
    transition: none;
  }
</style>
