<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import Icon from "@iconify/svelte";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";

  export type CatalogueLabels = {
    title: string;
    home: string;
    search: string;
    searchAction: string;
    loading: string;
    empty: string;
    error: string;
    retry: string;
    previous: string;
    next: string;
  };

  let {
    labels,
    homeHref,
    regions,
    status = "ready",
    empty = false,
    query = "",
    resetKey = null,
    pageIdentity,
    resultsLabel,
    onSearch,
    onRetry,
    onPrevious,
    onNext,
    pageLabel,
    loadingPlaceholder,
    controls,
    filters,
    children
  }: {
    labels: CatalogueLabels;
    homeHref: string;
    regions: RegionBadgeOption[];
    status?: "ready" | "loading" | "error";
    empty?: boolean;
    query?: string;
    /** Any change (for example a new category) also drops unsubmitted search text. */
    resetKey?: string | null;
    pageIdentity?: Snippet;
    resultsLabel?: string;
    onSearch?: (query: string) => void;
    onRetry?: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    pageLabel?: string;
    loadingPlaceholder?: Snippet;
    controls?: Snippet;
    /** Filters that narrow the chosen tab, in their own card below the tabs. */
    filters?: Snippet;
    children: Snippet;
  } = $props();

  const searchInput = $state({ value: untrack(() => query) });

  // Emptying the field, by deleting the text or with its clear button, drops an applied
  // search at once, so the URL never keeps a search the field no longer shows.
  const clearAppliedSearchIfEmpty = (event: Event & { currentTarget: HTMLInputElement }): void => {
    if (event.currentTarget.value.trim() === "" && query !== "") onSearch?.("");
  };

  // Only query and reset-key changes reset the draft; typing does not retrigger this effect.
  $effect(() => {
    void resetKey;
    searchInput.value = query;
  });
</script>

<section use:swipeRegion class="content-page-shell gap-4 pb-6">
  <PageHeader breadcrumbs={[{ label: labels.home, href: homeHref }, { label: labels.title }]}>
    {#snippet actions()}<RegionBadgeSwitch options={regions} />{/snippet}
  </PageHeader>
  {#if pageIdentity}{@render pageIdentity()}{/if}

  {#if controls}
    <!-- Search gets its own row, so its width never depends on the controls beside it. -->
    <div
      class="content-card-elevated flex flex-col gap-4 rounded-2xl border border-(--archive-border-subtle) p-4"
    >
      {#if onSearch}
        <form
          role="search"
          class="w-full min-w-0 sm:max-w-md"
          onsubmit={(event) => {
            event.preventDefault();
            onSearch?.(searchInput.value.trim());
          }}
        >
          <div class="flex gap-2">
            <input
              type="search"
              class="input min-h-11 min-w-0 flex-1 bg-(--archive-surface-default)"
              bind:value={searchInput.value}
              placeholder={labels.search}
              oninput={clearAppliedSearchIfEmpty}
              aria-label={labels.search}
            />
            <button
              type="submit"
              class="btn btn-square touch-target size-11 shrink-0"
              aria-label={labels.searchAction}
              title={labels.searchAction}
              disabled={status === "loading"}
            >
              <Icon icon="mdi:magnify" class="size-5" aria-hidden="true" />
            </button>
          </div>
        </form>
      {/if}
      <div class="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {@render controls()}
      </div>
    </div>
  {:else if onSearch}
    <form
      role="search"
      class="content-card-elevated rounded-2xl border border-(--archive-border-subtle) p-4"
      onsubmit={(event) => {
        event.preventDefault();
        onSearch?.(searchInput.value.trim());
      }}
    >
      <div class="flex gap-2">
        <input
          type="search"
          class="input min-h-11 min-w-0 flex-1 bg-(--archive-surface-default)"
          bind:value={searchInput.value}
          placeholder={labels.search}
          oninput={clearAppliedSearchIfEmpty}
          aria-label={labels.search}
        />
        <button
          type="submit"
          class="btn btn-square touch-target size-11 shrink-0"
          aria-label={labels.searchAction}
          title={labels.searchAction}
          disabled={status === "loading"}
        >
          <Icon icon="mdi:magnify" class="size-5" aria-hidden="true" />
        </button>
      </div>
    </form>
  {/if}

  {#if filters}
    <div
      class="content-card-elevated rounded-2xl border border-(--archive-border-subtle) p-4"
      data-swipe-region-skip
    >
      {@render filters()}
    </div>
  {/if}

  <section
    class="content-card-inset rounded-2xl border border-(--archive-border-subtle) p-3 sm:p-4"
    aria-busy={status === "loading"}
    aria-label={resultsLabel ?? labels.title}
  >
    {#if status === "loading"}
      <!-- The skeleton shows the loading state; the status stays for screen readers. -->
      <p role="status" class="sr-only">{labels.loading}</p>
      {#if loadingPlaceholder}
        <div aria-hidden="true">{@render loadingPlaceholder()}</div>
      {:else}
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {#each [0, 1, 2, 3, 4, 5] as index (index)}
            <div class="content-card-shell min-h-40 rounded-2xl p-4">
              <div class="h-16 rounded-xl bg-(--archive-surface-sunken)"></div>
              <div class="mt-4 h-4 w-3/4 rounded bg-(--archive-surface-sunken)"></div>
            </div>
          {/each}
        </div>
      {/if}
    {:else if status === "error"}
      <div
        class="flex min-h-48 flex-col items-center justify-center gap-4 p-4 text-center"
        role="status"
      >
        <Icon icon="mdi:alert-circle-outline" class="size-8 text-error" aria-hidden="true" />
        <p>{labels.error}</p>
        {#if onRetry}<button type="button" class="btn touch-target" onclick={onRetry}
            >{labels.retry}</button
          >{/if}
      </div>
    {:else if empty}
      <p
        class="flex min-h-48 items-center justify-center p-4 text-center text-(--archive-text-muted)"
        role="status"
      >
        {labels.empty}
      </p>
    {:else}
      {@render children()}
    {/if}
  </section>

  {#if onPrevious || onNext || pageLabel}
    <nav class="flex flex-wrap items-center justify-center gap-3" aria-label={labels.title}>
      <button
        type="button"
        class="btn touch-target"
        disabled={!onPrevious || status === "loading"}
        onclick={onPrevious}
      >
        <Icon icon="mdi:chevron-left" class="size-5" aria-hidden="true" />
        {labels.previous}
      </button>
      {#if pageLabel}<span class="text-sm tabular-nums text-(--archive-text-muted)"
          >{pageLabel}</span
        >{/if}
      <button
        type="button"
        class="btn touch-target"
        disabled={!onNext || status === "loading"}
        onclick={onNext}
      >
        {labels.next}
        <Icon icon="mdi:chevron-right" class="size-5" aria-hidden="true" />
      </button>
    </nav>
  {/if}
</section>
