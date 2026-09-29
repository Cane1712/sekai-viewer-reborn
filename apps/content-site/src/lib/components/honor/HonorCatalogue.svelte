<script lang="ts">
  import { tick, type ComponentProps } from "svelte";
  import Icon from "@iconify/svelte";
  import CatalogueFrame from "$lib/components/mission/CatalogueFrame.svelte";
  import ListToolbarButton from "$lib/components/shared/ListToolbarButton.svelte";
  import HonorSummary from "./HonorSummary.svelte";
  import HonorArtwork from "./HonorArtwork.svelte";
  import { defaultBondsHonorView, type BondsHonorView } from "$lib/domain/honor";
  import type { CatalogueHonorDegree } from "$lib/honor-degree";
  import type { HonorDegreeAssetResolver } from "@platform/ui-shell";

  export type HonorCatalogueGroup = {
    key: string;
    name: string;
    degree?: CatalogueHonorDegree;
    countLabel: string;
    /** A Bonds pair's display options, which its members' `degreeFor` apply. */
    bondsView?: {
      words: { id: number; name: string; description: string | null }[];
      /** The Virtual Singer's own outfit and the partner's unit outfit, when both exist. */
      outfit: { defaultLabel: string; unitLabel: string } | null;
    };
    members: {
      key: string;
      name: string;
      variantLabel?: string;
      degree: CatalogueHonorDegree;
      degreeFor?: (view: BondsHonorView) => CatalogueHonorDegree;
      levels: { label: string; description: string | null }[];
    }[];
  };
  let {
    items,
    catalogueKey,
    imageUnavailableLabel,
    levelsLabel,
    closeLabel = "Close",
    honorTypes = [],
    selectedHonorType = null,
    categoryLabel,
    getHonorTypeLabel,
    onHonorTypeChange,
    sortOrder = "asc",
    sortOrderLabel,
    sortAscendingLabel,
    sortDescendingLabel,
    onSortOrderChange,
    hasNext = false,
    isLoadingMore = false,
    loadingMoreLabel,
    loadMoreError = null,
    onLoadMore,
    onRetryLoadMore,
    resolveAsset,
    bondsViewLabels = {
      options: "Display",
      word: "Word",
      outfit: "Virtual Singer outfit",
      swapSides: "Swap sides"
    },
    ...frame
  }: Omit<
    ComponentProps<typeof CatalogueFrame>,
    "children" | "empty" | "loadingPlaceholder" | "controls"
  > & {
    items: HonorCatalogueGroup[];
    catalogueKey: string;
    imageUnavailableLabel: string;
    levelsLabel: string;
    closeLabel?: string;
    honorTypes?: string[];
    selectedHonorType?: string | null;
    categoryLabel?: string;
    getHonorTypeLabel?: (honorType: string | null) => string;
    onHonorTypeChange?: (honorType: string | null) => void;
    sortOrder?: "asc" | "desc";
    sortOrderLabel?: string;
    sortAscendingLabel?: string;
    sortDescendingLabel?: string;
    onSortOrderChange?: (sortOrder: "asc" | "desc") => void;
    hasNext?: boolean;
    isLoadingMore?: boolean;
    loadingMoreLabel?: string;
    loadMoreError?: string | null;
    onLoadMore?: () => void;
    onRetryLoadMore?: () => void;
    resolveAsset: HonorDegreeAssetResolver;
    bondsViewLabels?: { options: string; word: string; outfit: string; swapSides: string };
  } = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  let activeGroupKey = $state<string | null>(null);
  let lastTrigger: HTMLButtonElement | null = null;
  let sentinel: HTMLDivElement | null = $state(null);
  let previousCatalogueKey = $state<string | null>(null);
  const activeGroup = $derived(items.find((group) => group.key === activeGroupKey) ?? null);
  // How the open Bonds pair is shown; each pair opens with the game's defaults.
  let bondsView = $state<BondsHonorView>({ ...defaultBondsHonorView });
  const selectedWord = $derived(
    activeGroup?.bondsView?.words.find((word) => word.id === bondsView.wordId) ??
      activeGroup?.bondsView?.words[0] ??
      null
  );
  const categoryTypes = $derived([
    ...new Set(honorTypes.filter((honorType) => honorType.trim().length > 0))
  ]);
  const dialogId = $derived(`honor-group-dialog-${catalogueKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`);
  const dialogTitleId = $derived(`${dialogId}-title`);
  const resultsId = $derived(`${dialogId}-results`);
  const getLevelCount = (group: HonorCatalogueGroup): number =>
    group.members.reduce((count, member) => count + member.levels.length, 0);
  const getDialogTriggerLabel = (group: HonorCatalogueGroup): string =>
    `${levelsLabel}: ${getLevelCount(group)}`;

  const restoreFocus = (trigger: HTMLButtonElement | null): void => {
    void tick().then(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  };

  const handleDialogClose = (): void => {
    const trigger = lastTrigger;
    lastTrigger = null;
    activeGroupKey = null;
    restoreFocus(trigger);
  };

  const closeDialog = (): void => {
    if (!dialog) {
      if (activeGroupKey !== null) handleDialogClose();
      return;
    }

    if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
      return;
    }

    if (dialog.open) dialog.removeAttribute("open");
    handleDialogClose();
  };

  const openDialog = async (event: MouseEvent, group: HonorCatalogueGroup): Promise<void> => {
    if (!dialog) return;

    lastTrigger = event.currentTarget as HTMLButtonElement;
    activeGroupKey = group.key;
    bondsView = { ...defaultBondsHonorView };
    await tick();
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
  };

  $effect(() => {
    if (previousCatalogueKey === null) {
      previousCatalogueKey = catalogueKey;
      return;
    }
    if (catalogueKey === previousCatalogueKey) return;
    previousCatalogueKey = catalogueKey;
    closeDialog();
  });

  $effect(() => {
    if (
      !sentinel ||
      !hasNext ||
      isLoadingMore ||
      loadMoreError ||
      !onLoadMore ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore?.();
      },
      { rootMargin: "240px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

{#snippet identity(group: HonorCatalogueGroup)}
  <HonorSummary
    name={group.name}
    degree={group.degree}
    {resolveAsset}
    {imageUnavailableLabel}
    compact
  />
  {#if group.members.length > 1}
    <p class="mt-2 text-sm font-normal text-(--archive-text-muted)">{group.countLabel}</p>
  {/if}
{/snippet}

{#snippet pageIdentity()}
  <h1 class="text-2xl font-bold text-(--archive-text-strong)">{frame.labels.title}</h1>
{/snippet}

{#snippet levelSummary(group: HonorCatalogueGroup)}
  <p class="text-sm text-(--archive-text-muted)">{levelsLabel}: {getLevelCount(group)}</p>
{/snippet}

{#snippet bondsViewControls(options: NonNullable<HonorCatalogueGroup["bondsView"]>)}
  <fieldset
    class="fieldset mb-4 gap-3 rounded-xl border border-(--archive-border-subtle) bg-(--archive-surface-sunken) p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
  >
    <legend class="fieldset-legend text-sm font-medium">{bondsViewLabels.options}</legend>
    {#if options.words.length > 0}
      <div class="flex min-w-0 flex-col gap-1 sm:col-span-2">
        <span id={`${dialogId}-word`} class="text-sm font-medium text-(--archive-text-default)">
          {bondsViewLabels.word}
        </span>
        <!-- A pair has at most five words, so they fit as choices. -->
        <div
          class="flex flex-wrap gap-2"
          role="radiogroup"
          aria-labelledby={`${dialogId}-word`}
          aria-describedby={selectedWord?.description ? `${dialogId}-word-note` : undefined}
        >
          {#each options.words as word (word.id)}
            {@const checked = selectedWord?.id === word.id}
            <label
              class="btn touch-target h-auto min-h-11 whitespace-normal wrap-anywhere has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary {checked
                ? 'btn-primary'
                : 'btn-outline border-primary text-primary'}"
            >
              <input
                type="radio"
                class="sr-only"
                name={`${dialogId}-word`}
                {checked}
                onchange={() => {
                  bondsView = { ...bondsView, wordId: word.id };
                }}
              />
              {word.name}
            </label>
          {/each}
        </div>
        {#if selectedWord?.description}
          <p id={`${dialogId}-word-note`} class="text-xs wrap-anywhere text-(--archive-text-muted)">
            {selectedWord.description}
          </p>
        {/if}
      </div>
    {/if}
    {#if options.outfit}
      <div class="flex min-w-0 flex-col gap-1">
        <span id={`${dialogId}-outfit`} class="text-sm font-medium text-(--archive-text-default)">
          {bondsViewLabels.outfit}
        </span>
        <!-- Unit names can be long, so the choices stack on phones. -->
        <div
          class="join join-vertical w-full sm:join-horizontal sm:w-auto"
          role="radiogroup"
          aria-labelledby={`${dialogId}-outfit`}
        >
          {#each [false, true] as unitVirtualSinger (unitVirtualSinger)}
            {@const checked = bondsView.unitVirtualSinger === unitVirtualSinger}
            <label
              class="join-item btn touch-target h-auto min-h-11 whitespace-normal has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary {checked
                ? 'btn-primary'
                : 'btn-outline border-primary text-primary'}"
            >
              <input
                type="radio"
                class="sr-only"
                name={`${dialogId}-outfit`}
                {checked}
                onchange={() => {
                  bondsView = { ...bondsView, unitVirtualSinger };
                }}
              />
              {unitVirtualSinger ? options.outfit.unitLabel : options.outfit.defaultLabel}
            </label>
          {/each}
        </div>
      </div>
    {/if}
    <label
      class="flex items-center gap-3 rounded-xl border border-(--archive-border-subtle) bg-(--archive-surface-raised) px-3 py-2 {options.outfit
        ? ''
        : 'sm:col-span-2 sm:justify-self-start'}"
    >
      <span class="text-sm font-medium text-(--archive-text-default)"
        >{bondsViewLabels.swapSides}</span
      >
      <input
        type="checkbox"
        class="toggle toggle-primary shrink-0"
        checked={bondsView.reverse}
        onchange={(event) => {
          bondsView = { ...bondsView, reverse: event.currentTarget.checked };
        }}
      />
    </label>
  </fieldset>
{/snippet}

{#snippet members(group: HonorCatalogueGroup)}
  <ul class="min-w-0 divide-y divide-(--archive-border-subtle)">
    {#each group.members as member (member.key)}
      {@const label = member.variantLabel ?? member.name}
      <li class="min-w-0 space-y-3 py-4 first:pt-0 last:pb-0">
        {#if group.members.length > 1 || label !== group.name}
          <h3 class="font-semibold wrap-anywhere text-(--archive-text-strong)">{label}</h3>
        {/if}
        {#if group.members.length > 1}
          <HonorArtwork
            degree={member.degreeFor?.(bondsView) ?? member.degree}
            {resolveAsset}
            label={member.name}
            {imageUnavailableLabel}
          />
        {/if}
        {#if member.levels.length}
          <dl aria-label={levelsLabel} class="space-y-3 text-sm">
            {#each member.levels as level, index (index)}
              <div class="grid min-w-0 gap-1 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-3">
                <dt class="font-semibold wrap-anywhere text-(--archive-text-default)">
                  {level.label}
                </dt>
                {#if level.description}
                  <dd class="whitespace-pre-line wrap-anywhere text-(--archive-text-muted)">
                    {level.description}
                  </dd>
                {/if}
              </div>
            {/each}
          </dl>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet controls()}
  {#if categoryLabel && getHonorTypeLabel && onHonorTypeChange}
    <div class="min-w-0" data-swipe-region-skip>
      <div class="flex min-w-0 flex-wrap gap-2" role="tablist" aria-label={categoryLabel}>
        <button
          type="button"
          class:btn-primary={selectedHonorType === null}
          class:btn-ghost={selectedHonorType !== null}
          class="btn touch-target max-w-full rounded-xl whitespace-normal wrap-break-word"
          role="tab"
          aria-selected={selectedHonorType === null}
          aria-controls={resultsId}
          onclick={() => onHonorTypeChange?.(null)}
        >
          {getHonorTypeLabel(null)}
        </button>
        {#each categoryTypes as honorType (honorType)}
          <button
            type="button"
            class:btn-primary={selectedHonorType === honorType}
            class:btn-ghost={selectedHonorType !== honorType}
            class="btn touch-target max-w-full rounded-xl whitespace-normal wrap-break-word"
            role="tab"
            aria-selected={selectedHonorType === honorType}
            aria-controls={resultsId}
            onclick={() => onHonorTypeChange?.(honorType)}
          >
            {getHonorTypeLabel(honorType)}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if onSortOrderChange && sortOrderLabel && sortAscendingLabel && sortDescendingLabel}
    <div
      class="border-t border-(--archive-border-subtle) pt-4 lg:shrink-0 lg:border-t-0 lg:pt-0"
      data-swipe-region-skip
    >
      <fieldset
        aria-label={sortOrderLabel}
        class="flex min-w-0 flex-row flex-wrap items-center gap-2 text-sm font-semibold"
      >
        <div class="join shrink-0" role="group" aria-label={sortOrderLabel}>
          <ListToolbarButton
            icon="mdi:numeric"
            label={sortOrderLabel}
            ariaLabel={`${sortOrderLabel}: ${sortOrder === "asc" ? sortDescendingLabel : sortAscendingLabel}`}
            title={`${sortOrderLabel}: ${sortOrder === "asc" ? sortDescendingLabel : sortAscendingLabel}`}
            sortIndicatorIcon={sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down"}
            class="join-item btn-primary"
            onclick={() => onSortOrderChange?.(sortOrder === "asc" ? "desc" : "asc")}
          />
        </div>
      </fieldset>
    </div>
  {/if}
{/snippet}

<div id={resultsId}>
  <CatalogueFrame
    {...frame}
    resetKey={catalogueKey}
    empty={false}
    {controls}
    {pageIdentity}
    resultsLabel={frame.resultsLabel ?? frame.labels.title}
  >
    {#snippet loadingPlaceholder()}
      <div class="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {#each Array.from({ length: 12 }) as _, index (index)}
          <div class="content-card-shell min-h-32 rounded-2xl p-4">
            <div class="h-14 w-full max-w-67 rounded-lg bg-(--archive-surface-sunken)"></div>
            <div class="mt-3 h-4 w-3/4 rounded bg-(--archive-surface-sunken)"></div>
          </div>
        {/each}
      </div>
    {/snippet}
    {#key catalogueKey}
      {#if items.length === 0}
        <p
          class="flex min-h-48 items-center justify-center p-4 text-center text-(--archive-text-muted)"
          role="status"
        >
          {frame.labels.empty}
        </p>
      {:else}
        <div class="grid min-w-0 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {#each items as group (group.key)}
            <button
              type="button"
              class="content-card-shell block min-w-0 cursor-pointer rounded-2xl p-4 text-left outline-none transition-[transform,border-color,background-color,box-shadow] duration-180 hover-lift hover:border-primary/35 hover:bg-(--archive-surface-raised) hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
              aria-haspopup="dialog"
              aria-controls={dialogId}
              aria-expanded={activeGroupKey === group.key}
              aria-label={`${group.name}, ${getDialogTriggerLabel(group)}`}
              onclick={(event) => void openDialog(event, group)}
            >
              {@render identity(group)}
              <div class="mt-4 border-t border-(--archive-border-subtle) pt-4">
                {@render levelSummary(group)}
              </div>
            </button>
          {/each}
        </div>

        {#if loadMoreError}
          <div
            class="mt-5 flex flex-col items-center justify-center gap-3 p-4 text-center"
            role="status"
          >
            <p class="text-sm text-error">{loadMoreError}</p>
            {#if onRetryLoadMore}
              <button type="button" class="btn touch-target" onclick={onRetryLoadMore}>
                {frame.labels.retry}
              </button>
            {/if}
          </div>
        {:else if hasNext}
          <div
            bind:this={sentinel}
            class="flex min-h-20 items-center justify-center gap-3 p-4 text-sm text-(--archive-text-muted)"
            role="status"
            aria-live="polite"
          >
            {#if isLoadingMore}
              <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
              <span>{loadingMoreLabel}</span>
            {:else}
              <span>{loadingMoreLabel}</span>
            {/if}
          </div>
        {/if}

        <dialog
          bind:this={dialog}
          id={dialogId}
          class="modal"
          aria-labelledby={dialogTitleId}
          onclose={handleDialogClose}
          onkeydown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeDialog();
            }
          }}
          onclick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            class="modal-box flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-xl flex-col overflow-hidden p-0 sm:w-[calc(100%-2rem)]"
          >
            {#if activeGroup}
              <header
                class="flex shrink-0 items-start justify-between gap-4 border-b border-(--archive-border-subtle) p-4 sm:p-5"
              >
                <div class="min-w-0">
                  <h2
                    id={dialogTitleId}
                    class="wrap-anywhere text-xl font-bold text-(--archive-text-strong)"
                  >
                    {activeGroup.name}
                  </h2>
                  <p class="mt-1 text-sm text-(--archive-text-muted)">{activeGroup.countLabel}</p>
                </div>
                <button
                  type="button"
                  class="btn btn-circle btn-ghost btn-sm touch-target shrink-0"
                  aria-label={closeLabel}
                  title={closeLabel}
                  onclick={closeDialog}
                >
                  <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
                </button>
              </header>
              <div class="min-h-0 overflow-y-auto p-4 sm:p-5">
                {#if activeGroup.bondsView}
                  {@render bondsViewControls(activeGroup.bondsView)}
                {/if}
                {@render members(activeGroup)}
              </div>
            {/if}
          </div>
          <form
            method="dialog"
            class="modal-backdrop"
            onsubmit={(event) => {
              event.preventDefault();
              closeDialog();
            }}
          >
            <button type="submit" aria-label={closeLabel}></button>
          </form>
        </dialog>
      {/if}
    {/key}
  </CatalogueFrame>
</div>
