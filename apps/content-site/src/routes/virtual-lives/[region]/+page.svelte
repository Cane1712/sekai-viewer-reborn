<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import Icon from "@iconify/svelte";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import ListToolbarButton from "$lib/components/shared/ListToolbarButton.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import VirtualLiveListCard from "$lib/components/virtual-live/VirtualLiveListCard.svelte";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import type {
    VirtualLiveListItem,
    VirtualLiveListPage,
    VirtualLiveListSortBy,
    VirtualLiveListSortOrder
  } from "$lib/domain/virtual-live";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import { toTimestampMs } from "$lib/time/date-time";
  import { createPageTitle } from "$lib/page-title";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const fallbackMessages = $derived(
    resolveStreamingMessages(data.i18nMessages, ["common", "virtual-live", "error"])
  );
  const getInitialText = (key: string, fallback?: string): string =>
    createI18nTranslator(data.uiLocale, fallbackMessages)(key, fallback);
  let translateType = $state((key: string, fallback?: string): string =>
    getInitialText(key, fallback)
  );
  const contentDisplaySettings = getContentDisplaySettings();
  let items = $state<VirtualLiveListItem[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isInitialLoading = $state(true);
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);
  let translationRequestId = 0;
  let pageRequestId = 0;
  let listRequestId = 0;
  let sortBy = $state<VirtualLiveListSortBy>("startAt");
  let sortOrder = $state<VirtualLiveListSortOrder>("desc");
  let filterId = $state("");
  let appliedId = $state("");
  let filterTypes = $state<string[]>([]);
  let appliedTypes = $state<string[]>([]);
  let filterDialog: HTMLDialogElement | null = $state(null);

  let homeLabel = $state(getInitialText("home"));
  let title = $state(getInitialText("navigation.virtualLives"));
  let emptyLabel = $state(getInitialText("virtualLiveListEmpty"));
  let endLabel = $state(getInitialText("virtualLiveListEnd"));
  let loadingLabel = $state(getInitialText("virtualLiveListLoading"));
  let loadingMoreLabel = $state(getInitialText("virtualLiveListLoadingMore"));
  let failedLabel = $state(getInitialText("virtualLiveListLoadFailed"));
  let retryLabel = $state(getInitialText("listRetry"));
  let sortIdLabel = $state(getInitialText("listSortById"));
  let sortStartLabel = $state(getInitialText("virtualLiveListSortByStartAt"));
  let bannerAltSuffix = $state(getInitialText("virtualLiveBannerAltSuffix"));
  let spoilerLabel = $state(getInitialText("spoilerContent"));
  let nameLabel = $state(getInitialText("virtualLiveListFilterNameLabel"));
  let namePlaceholder = $state(getInitialText("virtualLiveListFilterNamePlaceholder"));
  let filterIdLabel = $state(getInitialText("virtualLiveListFilterIdLabel"));
  let filterIdPlaceholder = $state(getInitialText("virtualLiveListFilterIdPlaceholder"));
  let filterTypeLabel = $state(getInitialText("virtualLiveListFilterTypeLabel"));
  let filterApplyLabel = $state(getInitialText("listFilterApply"));
  let filterResetLabel = $state(getInitialText("listFilterReset"));
  let openFiltersLabel = $state(getInitialText("listOpenFilters"));
  let filtersTitle = $state(getInitialText("listFiltersTitle"));
  let closeLabel = $state(getInitialText("closeLabel"));
  let filterName = $state("");
  let appliedName = $state("");
  let ongoingLabel = $state(getInitialText("virtualLiveStatus.ongoing"));
  const typeValues = [
    "normal",
    "beginner",
    "cheerful_carnival",
    "streaming",
    "virtual_message",
    "solo_virtual_live"
  ];

  const typeLabel = (value: string | null): string =>
    value ? translateType(`virtualLiveType.${value}`, value.replaceAll("_", " ")) : "";
  const currentIdentity = (): string =>
    JSON.stringify({
      region: data.region,
      sortBy,
      sortOrder,
      name: appliedName,
      id: appliedId,
      types: appliedTypes
    });
  const isSpoiler = (item: VirtualLiveListItem): boolean => {
    const start = toTimestampMs(item.startAt);
    return start !== null && start > Date.now();
  };
  const visibleItems = $derived.by(() => {
    const base = contentDisplaySettings.showSpoilerContent
      ? items
      : items.filter((item) => !isSpoiler(item));
    if (!contentDisplaySettings.ongoingFirst) return base;
    return [
      ...base.filter((item) => item.status === "ongoing"),
      ...base.filter((item) => item.status !== "ongoing")
    ];
  });

  const applyTranslations = (translate: (key: string, fallback?: string) => string): void => {
    translateType = translate;
    homeLabel = translate("home");
    title = translate("navigation.virtualLives");
    emptyLabel = translate("virtualLiveListEmpty");
    endLabel = translate("virtualLiveListEnd");
    loadingLabel = translate("virtualLiveListLoading");
    loadingMoreLabel = translate("virtualLiveListLoadingMore");
    failedLabel = translate("virtualLiveListLoadFailed");
    retryLabel = translate("listRetry");
    sortIdLabel = translate("listSortById");
    sortStartLabel = translate("virtualLiveListSortByStartAt");
    bannerAltSuffix = translate("virtualLiveBannerAltSuffix");
    spoilerLabel = translate("spoilerContent");
    nameLabel = translate("virtualLiveListFilterNameLabel");
    namePlaceholder = translate("virtualLiveListFilterNamePlaceholder");
    filterIdLabel = translate("virtualLiveListFilterIdLabel");
    filterIdPlaceholder = translate("virtualLiveListFilterIdPlaceholder");
    filterTypeLabel = translate("virtualLiveListFilterTypeLabel");
    filterApplyLabel = translate("listFilterApply");
    filterResetLabel = translate("listFilterReset");
    openFiltersLabel = translate("listOpenFilters");
    filtersTitle = translate("listFiltersTitle");
    closeLabel = translate("closeLabel");
    ongoingLabel = translate("virtualLiveStatus.ongoing");
  };

  $effect(() => {
    const requestId = ++translationRequestId;
    void Promise.resolve(data.i18nMessages)
      .then((messages) => {
        if (requestId === translationRequestId)
          applyTranslations(createI18nTranslator(data.uiLocale, messages));
      })
      .catch(() => {});
  });

  $effect(() => {
    const requestId = ++pageRequestId;
    const activeListRequest = ++listRequestId;
    items = [];
    currentPage = 1;
    hasNext = false;
    isInitialLoading = true;
    errorMessage = null;
    const streaming = data.initialPage as unknown as Promise<{
      page: VirtualLiveListPage;
      loadFailed: boolean;
    }>;
    streaming.then((result) => {
      if (requestId !== pageRequestId || activeListRequest !== listRequestId) return;
      items = result.page.items;
      currentPage = result.page.pagination.page;
      hasNext = result.page.pagination.hasNext;
      sortBy = data.initialQuery.sortBy;
      sortOrder = data.initialQuery.sortOrder;
      filterName = data.initialQuery.name;
      appliedName = data.initialQuery.name;
      filterId = data.initialQuery.id;
      appliedId = data.initialQuery.id;
      filterTypes = [...data.initialQuery.virtualLiveType];
      appliedTypes = [...data.initialQuery.virtualLiveType];
      errorMessage = result.loadFailed ? failedLabel : null;
      isInitialLoading = false;
    });
  });

  $effect(() => {
    if (!browser || !sentinel || !hasNext) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNextPage();
      },
      { rootMargin: "240px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  const createSearchParams = (page: number): SvelteURLSearchParams => {
    const params = new SvelteURLSearchParams();
    params.set("page", String(page));
    params.set("sort_by", sortBy);
    params.set("sort_order", sortOrder);
    params.set("spoiler", String(contentDisplaySettings.showSpoilerContent));
    if (appliedName) params.set("name", appliedName);
    if (appliedId) params.set("id", appliedId);
    for (const value of appliedTypes) params.append("virtual_live_type", value);
    return params;
  };
  const listHref = (region: string): string => {
    const params = createSearchParams(1);
    params.delete("page");
    return `${resolve("/virtual-lives/[region]", { region })}?${params.toString()}`;
  };
  const dataHref = (page: number): string =>
    `${resolve("/virtual-lives/[region]/data", { region: data.region })}?${createSearchParams(page).toString()}`;
  const regionOptions = (): RegionBadgeOption[] =>
    supportedRegions.map((region) =>
      region === data.region
        ? { key: region, label: regionLabels[region], active: true }
        : { key: region, label: regionLabels[region], href: listHref(region), active: false }
    );
  const syncUrl = (): void => {
    if (!browser) return;
    const params = createSearchParams(1);
    params.delete("page");
    replaceState(
      `${resolve("/virtual-lives/[region]", { region: data.region })}?${params.toString()}`,
      {}
    );
  };

  const fetchPage = async (page: number, replace: boolean): Promise<void> => {
    if (isLoading) return;
    const requestId = ++listRequestId;
    const identity = currentIdentity();
    isLoading = true;
    errorMessage = null;
    try {
      const response = await fetch(dataHref(page));
      if (!response.ok) throw new Error("Virtual Live list request failed.");
      const next = (await response.json()) as VirtualLiveListPage;
      if (requestId !== listRequestId || identity !== currentIdentity()) return;
      items = replace
        ? next.items
        : [
            ...items,
            ...next.items.filter((item) => !items.some((current) => current.id === item.id))
          ];
      currentPage = next.pagination.page;
      hasNext = next.pagination.hasNext;
      if (replace) syncUrl();
    } catch {
      if (requestId === listRequestId) errorMessage = failedLabel;
    } finally {
      if (requestId === listRequestId) {
        isLoading = false;
        isInitialLoading = false;
      }
    }
  };
  const loadNextPage = (): Promise<void> =>
    hasNext ? fetchPage(currentPage + 1, false) : Promise.resolve();
  const reload = (): Promise<void> => fetchPage(1, true);
  const toggleSort = (next: VirtualLiveListSortBy): void => {
    sortOrder = sortBy === next ? (sortOrder === "desc" ? "asc" : "desc") : "desc";
    sortBy = next;
    void reload();
  };
  const applyFilters = (): void => {
    appliedName = filterName.trim();
    appliedId = filterId.trim();
    appliedTypes = [...filterTypes];
    filterDialog?.close();
    void reload();
  };
  const syncDraftFiltersFromApplied = (): void => {
    filterName = appliedName;
    filterId = appliedId;
    filterTypes = [...appliedTypes];
  };
  const openFilterDialog = (): void => {
    syncDraftFiltersFromApplied();
    filterDialog?.showModal();
  };
  const resetFilterDrafts = (): void => {
    filterName = "";
    filterId = "";
    filterTypes = [];
  };
  const hasAppliedFilters = (): boolean =>
    appliedName.length > 0 || appliedId.length > 0 || appliedTypes.length > 0;
  const toggleType = (value: string): void => {
    filterTypes = filterTypes.includes(value)
      ? filterTypes.filter((current) => current !== value)
      : [...filterTypes, value];
  };
  const sortIcon = (target: VirtualLiveListSortBy): string =>
    sortBy === target && sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down";
</script>

<svelte:head><title>{createPageTitle(`${title} ${regionLabels[data.region]}`)}</title></svelte:head>

<section use:swipeRegion class="content-page-shell gap-5 px-2">
  <PageHeader
    breadcrumbs={[{ label: homeLabel, href: resolve("/") }, { label: title }]}
    breadcrumbClass="md:max-w-[60%]"
  >
    {#snippet actions()}<RegionBadgeSwitch options={regionOptions()} />{/snippet}
  </PageHeader>

  <div
    class="archive-card-controls archive-list-toolbar flex gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5"
    data-swipe-region-skip
  >
    <div class="archive-control-group flex items-center gap-2">
      <div class="join">
        <ListToolbarButton
          icon="mdi:clock-start"
          label={sortStartLabel}
          ariaLabel={`${sortStartLabel} (${sortOrder})`}
          sortIndicatorIcon={sortBy === "startAt" ? sortIcon("startAt") : undefined}
          class={`join-item ${sortBy === "startAt" ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          onclick={() => toggleSort("startAt")}
        />
        <ListToolbarButton
          icon="mdi:numeric"
          label={sortIdLabel}
          ariaLabel={`${sortIdLabel} (${sortOrder})`}
          sortIndicatorIcon={sortBy === "id" ? sortIcon("id") : undefined}
          class={`join-item ${sortBy === "id" ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          onclick={() => toggleSort("id")}
        />
      </div>
    </div>
    <div class="archive-control-group flex items-center justify-between gap-2 sm:justify-end">
      <ListToolbarButton
        icon="mdi:funnel"
        label={openFiltersLabel}
        class={hasAppliedFilters() ? "btn-primary" : "btn-outline border-primary text-primary"}
        onclick={openFilterDialog}
      />
    </div>
  </div>

  {#if isInitialLoading}
    <div
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      class="archive-results-field grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    >
      {#each Array.from({ length: 12 }, (_, index) => index) as index (index)}
        <div
          class="archive-card-skeleton flex flex-col gap-3 rounded-2xl border p-4"
          aria-hidden="true"
        >
          <div class="skeleton h-32 rounded-xl"></div>
          <div class="skeleton h-4 w-3/4 rounded"></div>
          <div class="skeleton h-4 w-1/2 rounded"></div>
        </div>
      {/each}
    </div>
  {:else if items.length === 0 && errorMessage}
    <div class="archive-list-error rounded-2xl border p-3">
      <div class="alert alert-error">
        {errorMessage}<button class="btn btn-sm" onclick={() => void reload()}>{retryLabel}</button>
      </div>
    </div>
  {:else}
    <div
      class="archive-results-field grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    >
      {#each visibleItems as item (item.id)}
        <VirtualLiveListCard
          region={data.region}
          {item}
          uiLocale={data.uiLocale}
          {bannerAltSuffix}
          spoilerContentLabel={spoilerLabel}
          {ongoingLabel}
          typeLabel={typeLabel(item.virtualLiveType)}
        />
      {/each}
    </div>
    {#if visibleItems.length === 0 && !errorMessage}<div
        class="archive-list-empty rounded-2xl border py-12 text-center text-sm"
      >
        {emptyLabel}
      </div>{/if}
    {#if errorMessage}<div class="archive-list-error mx-auto max-w-xl rounded-2xl border p-3">
        <div class="alert alert-error">
          {errorMessage}<button class="btn btn-sm" onclick={() => void loadNextPage()}
            >{retryLabel}</button
          >
        </div>
      </div>{/if}
    {#if hasNext}
      <div
        bind:this={sentinel}
        class="archive-list-sentinel flex min-h-24 items-center justify-center rounded-2xl py-5"
      >
        {#if isLoading}<span class="loading loading-spinner loading-md"></span><span
            class="ml-3 text-sm opacity-70">{loadingMoreLabel}</span
          >{:else}<span class="text-sm opacity-60">{loadingLabel}</span>{/if}
      </div>
    {:else if visibleItems.length > 0}<div class="archive-list-end py-3 text-center text-sm">
        {endLabel}
      </div>{/if}
  {/if}
</section>

<dialog bind:this={filterDialog} class="modal" aria-labelledby="list-filters-title">
  <div class="modal-box archive-filter-dialog max-w-xl border">
    <div class="flex items-center justify-between gap-3">
      <h3 id="list-filters-title" class="text-lg font-semibold">{filtersTitle}</h3>
      <form method="dialog">
        <button
          type="submit"
          class="btn btn-circle btn-ghost btn-sm min-h-12! w-12!"
          aria-label={closeLabel}
          title={closeLabel}
        >
          <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
        </button>
      </form>
    </div>

    <form
      class="mt-4 grid grid-cols-1 gap-3"
      onsubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
    >
      <label class="flex w-full flex-col">
        <span class="mb-1 text-sm font-medium">{nameLabel}</span>
        <input
          class="input w-full"
          type="search"
          bind:value={filterName}
          placeholder={namePlaceholder}
        />
      </label>
      <label class="flex w-full flex-col">
        <span class="mb-1 text-sm font-medium">{filterIdLabel}</span>
        <input
          class="input w-full"
          inputmode="numeric"
          bind:value={filterId}
          placeholder={filterIdPlaceholder}
        />
      </label>
      <fieldset class="fieldset w-full gap-2">
        <legend class="fieldset-legend text-sm font-medium">{filterTypeLabel}</legend>
        <div class="join flex w-full flex-wrap">
          {#each typeValues as value (value)}
            <label
              class={`btn btn-sm join-item min-h-12! ${filterTypes.includes(value) ? "btn-primary" : "btn-outline border-base-content/20 text-primary"}`}
              title={typeLabel(value)}
            >
              <input
                type="checkbox"
                class="sr-only"
                checked={filterTypes.includes(value)}
                onchange={() => toggleType(value)}
                aria-label={typeLabel(value)}
              />
              <span>{typeLabel(value)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <div class="modal-action flex-wrap gap-2">
        <button type="button" class="btn btn-outline min-h-12!" onclick={resetFilterDrafts}
          >{filterResetLabel}</button
        >
        <button type="submit" class="btn btn-primary min-h-12!">{filterApplyLabel}</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit" aria-label={closeLabel}></button>
  </form>
</dialog>
