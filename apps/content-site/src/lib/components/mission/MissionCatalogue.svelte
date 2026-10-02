<script lang="ts">
  import { type ComponentProps, type Snippet } from "svelte";
  import type { MissionFamily, MissionResourceBoxDetail } from "$lib/domain/mission";
  import type { SupportedRegion } from "$lib/domain/regions";
  import RewardItem from "$lib/components/shared/RewardItem.svelte";
  import ViewAllLink from "$lib/components/shared/ViewAllLink.svelte";
  import { missionFamilies } from "$lib/domain/mission";
  import CatalogueFrame from "./CatalogueFrame.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import Icon from "@iconify/svelte";

  export type MissionCatalogueItem = {
    key: string;
    sentence: string;
    requirementLabel?: string | null;
    targetUnavailableLabel?: string | null;
    character?: { id: number; name: string; imageSrc: string | null } | null;
    rewards?: {
      detail: Pick<
        MissionResourceBoxDetail,
        "resourceType" | "resourceId" | "resourceAssetbundleName"
      >;
      label: string;
      quantityLabel: string | null;
    }[];
  };
  export type MissionCatalogueGroup = {
    family: MissionFamily;
    label: string;
    countLabel: string;
    /** Overview only: the header's "View all" control, and its accessible name. */
    browseLabel?: string;
    browseAriaLabel?: string;
    /** Overview groups load independently; omitted means ready. */
    status?: "loading" | "ready" | "error";
    statusLabel?: string;
    items: MissionCatalogueItem[];
  };
  let {
    groups,
    catalogueKey,
    loadingGroupCount = 3,
    overview = false,
    rewardsLabel,
    region,
    familyLabel,
    selectedFamily = null,
    getFamilyLabel,
    onFamilyChange,
    hasNext = false,
    isLoadingMore = false,
    loadMoreLabel,
    loadingMoreLabel,
    loadMoreError = null,
    onLoadMore,
    onRetryLoadMore,
    filters,
    groupBody,
    content,
    ...frame
  }: Omit<
    ComponentProps<typeof CatalogueFrame>,
    "children" | "empty" | "loadingPlaceholder" | "controls"
  > & {
    groups: MissionCatalogueGroup[];
    catalogueKey: string;
    loadingGroupCount?: number;
    overview?: boolean;
    rewardsLabel: string;
    region: SupportedRegion;
    familyLabel: string;
    selectedFamily?: MissionFamily | null;
    getFamilyLabel: (family: MissionFamily | null) => string;
    onFamilyChange: (family: MissionFamily | null) => void;
    hasNext?: boolean;
    isLoadingMore?: boolean;
    loadMoreLabel: string;
    loadingMoreLabel: string;
    loadMoreError?: string | null;
    onLoadMore?: () => void;
    onRetryLoadMore?: () => void;
    /** Extra controls under the family tabs, such as the Character Missions picker. */
    filters?: Snippet;
    /** Replaces the default item list inside a family's section. */
    groupBody?: Snippet<[MissionCatalogueGroup]>;
    /** Replaces the group list, for families rendered as a single custom view. */
    content?: Snippet;
  } = $props();

  let sentinel: HTMLDivElement | null = $state(null);
  const familyOptions: (MissionFamily | null)[] = [null, ...missionFamilies];
  const resultsId = $derived(`mission-results-${catalogueKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`);

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

{#snippet heading(group: MissionCatalogueGroup)}
  <div class="flex min-w-0 items-center justify-between gap-3">
    <h2
      class="flex min-w-0 items-center gap-3 text-base font-semibold text-(--archive-text-strong)"
    >
      <Icon icon="mdi:playlist-check" class="size-5 shrink-0 text-primary" aria-hidden="true" />
      <span class="wrap-anywhere">{group.label}</span>
    </h2>
    {#if overview && group.browseLabel}
      <!-- Stays usable while the family loads; the count appears once it is known. -->
      <ViewAllLink
        label={group.browseLabel}
        ariaLabel={group.browseAriaLabel ?? null}
        onclick={() => onFamilyChange(group.family)}
      />
    {:else if group.status === "loading"}
      <span class="h-4 w-20 shrink-0 rounded bg-(--archive-surface-sunken)" aria-hidden="true"
      ></span>
    {:else}
      <span class="shrink-0 text-sm wrap-anywhere text-(--archive-text-muted) tabular-nums">
        {group.countLabel}
      </span>
    {/if}
  </div>
{/snippet}

{#snippet members(group: MissionCatalogueGroup)}
  <ul
    class="divide-y divide-(--archive-border-subtle) border-t border-(--archive-border-subtle) lg:grid lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0"
  >
    {#each group.items as item (item.key)}
      <li
        class="grid min-w-0 gap-3 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(12rem,1fr)] lg:border-b lg:border-(--archive-border-subtle) lg:py-4"
      >
        <div class="min-w-0 space-y-2">
          <h3 class="text-base font-medium wrap-anywhere text-(--archive-text-strong)">
            {item.sentence}
          </h3>
          {#if item.character}
            <div class="flex min-w-0 items-center gap-2 text-sm">
              <CharacterAvatar
                src={item.character.imageSrc}
                characterId={item.character.id}
                label={item.character.name}
                variant="xs"
                decorative
              />
              <span class="min-w-0 wrap-anywhere">{item.character.name}</span>
            </div>
          {/if}
          {#if item.requirementLabel}<p
              class="text-sm wrap-anywhere text-(--archive-text-muted) tabular-nums"
            >
              {item.requirementLabel}
            </p>{/if}
          {#if item.targetUnavailableLabel}<p class="text-sm wrap-anywhere text-warning">
              {item.targetUnavailableLabel}
            </p>{/if}
        </div>
        {#if item.rewards?.length}
          <ul
            aria-label={rewardsLabel}
            class="min-w-0 space-y-1 text-sm wrap-anywhere text-(--archive-text-muted) tabular-nums"
          >
            {#each item.rewards as reward, index (index)}<li>
                <RewardItem
                  detail={reward.detail}
                  {region}
                  label={reward.label}
                  quantityLabel={reward.quantityLabel}
                />
              </li>{/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet controls()}
  <div class="min-w-0 flex-1" data-swipe-region-skip>
    <!-- Phones fit the four tabs on one row by trimming their padding and gap. -->
    <div class="flex min-w-0 flex-wrap gap-1 sm:gap-2" role="tablist" aria-label={familyLabel}>
      {#each familyOptions as family (family ?? "all")}
        <button
          type="button"
          class:btn-primary={selectedFamily === family}
          class:btn-ghost={selectedFamily !== family}
          class="btn touch-target max-w-full flex-auto rounded-xl px-3 whitespace-normal wrap-break-word sm:flex-none sm:px-4"
          role="tab"
          aria-selected={selectedFamily === family}
          aria-controls={resultsId}
          onclick={() => onFamilyChange(family)}
        >
          {getFamilyLabel(family)}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

<div id={resultsId}>
  <CatalogueFrame {...frame} empty={!content && groups.length === 0} {controls} {filters}>
    {#snippet loadingPlaceholder()}
      <div class="flex flex-col gap-4">
        {#each Array.from({ length: loadingGroupCount }) as _, index (index)}
          <div
            class="content-card-shell flex min-h-16 items-center justify-between gap-4 rounded-2xl p-4"
          >
            <div class="h-5 w-40 max-w-1/2 rounded bg-(--archive-surface-sunken)"></div>
            <div class="h-4 w-28 max-w-1/3 rounded bg-(--archive-surface-sunken)"></div>
          </div>
        {/each}
      </div>
    {/snippet}
    {#key catalogueKey}
      {#if content}
        {@render content()}
      {:else}
        <div class={overview ? "grid min-w-0 gap-4 lg:grid-cols-3" : "flex min-w-0 flex-col gap-4"}>
          {#each groups as group (group.family)}
            <!-- A group with its own body (the character missions tiles) sits straight in the
                 results area; every other group keeps its card. -->
            <section
              class={!overview && groupBody
                ? "min-w-0"
                : "content-card-shell min-w-0 rounded-2xl p-4"}
              aria-busy={group.status === "loading" ? "true" : undefined}
            >
              <div class="pb-4">{@render heading(group)}</div>
              {#if overview}
                {#if group.status === "loading"}
                  <p role="status" class="sr-only">{group.statusLabel}</p>
                  <div
                    class="space-y-3 border-t border-(--archive-border-subtle) py-3"
                    aria-hidden="true"
                  >
                    {#each ["w-4/5", "w-3/5", "w-2/3"] as width (width)}
                      <div class="h-4 rounded bg-(--archive-surface-sunken) {width}"></div>
                    {/each}
                  </div>
                {:else if group.status === "error"}
                  <div
                    class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-(--archive-border-subtle) py-3"
                  >
                    <p role="alert" class="text-sm text-error">{group.statusLabel}</p>
                    {#if frame.onRetry}
                      <button
                        type="button"
                        class="btn btn-link touch-target px-0"
                        onclick={frame.onRetry}
                      >
                        {frame.labels.retry}
                      </button>
                    {/if}
                  </div>
                {:else if group.items.length}
                  <ul class="space-y-2 border-t border-(--archive-border-subtle) py-3 text-sm">
                    {#each group.items as item (item.key)}
                      <li class="wrap-anywhere text-(--archive-text-muted)">{item.sentence}</li>
                    {/each}
                  </ul>
                {/if}
              {:else if groupBody}
                {@render groupBody(group)}
              {:else}
                {@render members(group)}
              {/if}
            </section>
          {/each}

          {#if !overview}
            {#if loadMoreError}
              <div
                class="flex flex-col items-center justify-center gap-3 p-4 text-center"
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
                {:else if onLoadMore}
                  <button type="button" class="btn touch-target" onclick={onLoadMore}>
                    {loadMoreLabel}
                  </button>
                {:else}
                  <span>{loadMoreLabel}</span>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    {/key}
  </CatalogueFrame>
</div>
