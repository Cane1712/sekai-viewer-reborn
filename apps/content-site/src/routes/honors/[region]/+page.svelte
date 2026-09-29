<script lang="ts">
  import { browser } from "$app/environment";
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import HonorCatalogue from "$lib/components/honor/HonorCatalogue.svelte";
  import type { BondsHonorGroup, HonorGroup } from "$lib/domain/honor";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import {
    createHonorDegreeAssetResolver,
    toCatalogueBondsHonorDegree,
    toCatalogueHonorDegree
  } from "$lib/honor-degree";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { createPageTitle } from "$lib/page-title";
  import sourceMessages from "@platform/i18n-source/content-site/honor.json";
  import type { PageProps } from "./$types";

  type HonorListQueryState = {
    honorType: string | null;
    name: string;
    sortBy: "id";
    sortOrder: "asc" | "desc";
  };
  type HonorListSortOrder = HonorListQueryState["sortOrder"];

  let { data }: PageProps = $props();
  let resolvedMessages = $state<Record<string, string> | null>(null);
  const messages = $derived({
    ...sourceMessages,
    ...resolveStreamingMessages(data.i18nMessages, ["common"]),
    ...resolvedMessages
  });
  const t = $derived(createI18nTranslator(data.uiLocale, messages));

  let items = $state<HonorGroup[]>([]);
  let bondsItems = $state<BondsHonorGroup[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isInitialLoading = $state(true);
  let isLoadingMore = $state(false);
  let initialError = $state(false);
  let loadMoreError = $state(false);
  let availableHonorTypes = $state<string[]>([]);
  let listRequestId = 0;
  let sortOrder = $state<HonorListSortOrder>("asc");

  const labels = $derived({
    title: t("navigation.honors"),
    home: t("home"),
    search: t("honor.search"),
    searchAction: t("honor.searchAction"),
    loading: t("honor.loading"),
    empty: t("honor.empty"),
    error: t("honor.error"),
    retry: t("honor.retry"),
    previous: "",
    next: ""
  });
  const honorTypeLabelKeys: Record<string, string> = {
    achievement: "honor.category.achievement",
    birthday: "honor.category.birthday",
    bonds: "honor.category.bonds",
    character: "honor.category.character",
    event: "honor.category.event",
    rank_match: "honor.category.rank_match"
  };
  const getHonorTypeLabel = (honorType: string | null): string =>
    t(
      honorType === null
        ? "honor.category.all"
        : (honorTypeLabelKeys[honorType] ?? "honor.category.unknown")
    );
  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(data.uiLocale).format(value);
  const rarityLabel = (rarity: string | null): string | undefined => {
    switch (rarity) {
      case "low":
        return t("honor.rarity.low");
      case "middle":
        return t("honor.rarity.middle");
      case "high":
        return t("honor.rarity.high");
      case "highest":
        return t("honor.rarity.highest");
      default:
        return undefined;
    }
  };
  const resolveAsset = $derived(createHonorDegreeAssetResolver(data.region));
  const toItem = (item: HonorGroup) => ({
    key: String(item.id),
    name: item.name ?? item.honors[0]?.name ?? t("honor.unnamed"),
    degree: item.honors[0] ? toCatalogueHonorDegree(item.honors[0], item) : undefined,
    countLabel: t("honor.memberCount").replace("{count}", formatNumber(item.honors.length)),
    members: item.honors.map((honor) => ({
      key: String(honor.id),
      name: honor.name ?? t("honor.unnamed"),
      variantLabel: rarityLabel(honor.honorRarity),
      degree: toCatalogueHonorDegree(honor, item),
      levels: honor.levels.map((level) => ({
        label:
          level.level === null
            ? t("honor.levels")
            : t("honor.level").replace("{level}", formatNumber(level.level)),
        description: level.description
      }))
    }))
  });

  // A Bonds group is one character pair; its members are the pair's rarities.
  const toBondsItem = (group: BondsHonorGroup) => ({
    key: `bonds-${group.id}`,
    name: group.name ?? group.honors[0]?.name ?? t("honor.unnamed"),
    degree: group.honors[0] ? toCatalogueBondsHonorDegree(group.honors[0]) : undefined,
    countLabel: t("honor.memberCount").replace("{count}", formatNumber(group.honors.length)),
    members: group.honors.map((honor) => ({
      key: String(honor.id),
      name: honor.name ?? t("honor.unnamed"),
      variantLabel: rarityLabel(honor.honorRarity),
      degree: toCatalogueBondsHonorDegree(honor),
      levels: honor.levels.map((level) => ({
        label:
          level.level === null
            ? t("honor.levels")
            : t("honor.level").replace("{level}", formatNumber(level.level)),
        description: level.description
      }))
    }))
  });
  // Pages split the Bonds list by honor, so a pair can straddle two pages.
  const appendBondsGroups = (
    current: BondsHonorGroup[],
    next: BondsHonorGroup[]
  ): BondsHonorGroup[] => {
    const last = current.at(-1);
    const [first, ...rest] = next;
    if (!last || !first || last.id !== first.id) return [...current, ...next];
    const seen = new Set(last.honors.map((honor) => honor.id));
    const merged = {
      ...last,
      honors: [...last.honors, ...first.honors.filter((honor) => !seen.has(honor.id))]
    };
    return [...current.slice(0, -1), merged, ...rest];
  };

  const queryParams = (query: HonorListQueryState, page?: number): SvelteURLSearchParams => {
    const params = new SvelteURLSearchParams();
    if (page !== undefined) params.set("page", String(page));
    if (query.honorType) params.set("honor_type", query.honorType);
    if (query.name) params.set("name", query.name);
    params.set("sort_by", query.sortBy);
    params.set("sort_order", query.sortOrder);
    return params;
  };
  const listHref = (region: string): string => {
    const params = queryParams(data.query);
    params.delete("page");
    const query = params.toString();
    return `${resolve("/honors/[region]", { region })}${query ? `?${query}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listHref(region)
    }))
  );
  const navigateQuery = (overrides: Partial<HonorListQueryState>): void => {
    const query: HonorListQueryState = { ...data.query, ...overrides };
    const params = queryParams(query);
    params.delete("page");
    const queryString = params.toString();
    void goto(`${resolve("/honors/[region]", { region: data.region })}?${queryString}`, {
      keepFocus: true,
      noScroll: true
    });
  };

  $effect(() => {
    const bundle = data.i18nMessages;
    let active = true;
    resolvedMessages = null;
    void Promise.resolve(bundle)
      .then((value) => {
        if (active) resolvedMessages = value;
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  });

  $effect(() => {
    const requestId = ++listRequestId;
    items = [];
    bondsItems = [];
    currentPage = 1;
    hasNext = false;
    isInitialLoading = true;
    isLoadingMore = false;
    initialError = false;
    loadMoreError = false;
    sortOrder = data.query.sortOrder;

    void Promise.resolve(data.catalogue)
      .then((catalogue) => {
        if (requestId !== listRequestId) return;
        items = catalogue.items;
        bondsItems = catalogue.bondsItems;
        currentPage = catalogue.pagination.page;
        hasNext = catalogue.pagination.hasNext;
        availableHonorTypes = catalogue.availableHonorTypes;
        initialError = catalogue.loadFailed;
        isInitialLoading = false;
      })
      .catch(() => {
        if (requestId !== listRequestId) return;
        initialError = true;
        isInitialLoading = false;
      });
  });

  const dataHref = (page: number): string => {
    const params = queryParams(data.query, page);
    return `${resolve("/honors/[region]/data", { region: data.region })}?${params.toString()}`;
  };
  const loadNextPage = async (): Promise<void> => {
    if (!browser || isLoadingMore || !hasNext) return;
    const requestId = listRequestId;
    isLoadingMore = true;
    loadMoreError = false;
    try {
      const response = await fetch(dataHref(currentPage + 1));
      if (!response.ok) throw new Error("Honor list request failed.");
      const next = (await response.json()) as {
        items: HonorGroup[];
        bondsItems?: BondsHonorGroup[];
        pagination: { page: number; hasNext: boolean };
      };
      if (requestId !== listRequestId) return;
      const existingIds = new Set(items.map((item) => item.id));
      items = [...items, ...next.items.filter((item) => !existingIds.has(item.id))];
      bondsItems = appendBondsGroups(bondsItems, next.bondsItems ?? []);
      currentPage = next.pagination.page;
      hasNext = next.pagination.hasNext;
    } catch {
      if (requestId === listRequestId) loadMoreError = true;
    } finally {
      if (requestId === listRequestId) isLoadingMore = false;
    }
  };
</script>

<svelte:head
  ><title>{createPageTitle(`${t("navigation.honors")} ${regionLabels[data.region]}`)}</title
  ></svelte:head
>

<HonorCatalogue
  {labels}
  homeHref={resolve("/")}
  {regions}
  items={isInitialLoading || initialError
    ? []
    : [...items.map(toItem), ...bondsItems.map(toBondsItem)]}
  catalogueKey={`${data.region}:${data.query.honorType ?? "all"}:${data.query.name}:${data.query.sortOrder}`}
  status={isInitialLoading ? "loading" : initialError ? "error" : "ready"}
  query={data.query.name}
  onSearch={(name) => navigateQuery({ name: name.trim() })}
  imageUnavailableLabel={t("imageUnavailable")}
  levelsLabel={t("honor.levels")}
  closeLabel={t("closeLabel")}
  honorTypes={availableHonorTypes}
  selectedHonorType={data.query.honorType}
  categoryLabel={t("honor.categoryLabel")}
  {getHonorTypeLabel}
  onHonorTypeChange={(honorType) => navigateQuery({ honorType })}
  {sortOrder}
  sortOrderLabel={t("honor.sortOrder")}
  sortAscendingLabel={t("honor.sortAscending")}
  sortDescendingLabel={t("honor.sortDescending")}
  onSortOrderChange={(next) => navigateQuery({ sortOrder: next })}
  hasNext={!initialError && hasNext}
  {isLoadingMore}
  loadingMoreLabel={isLoadingMore ? t("honor.loadingMore") : t("honor.loadMore")}
  resultsLabel={t("honor.results")}
  loadMoreError={loadMoreError ? t("honor.loadMoreError") : null}
  onLoadMore={() => void loadNextPage()}
  onRetryLoadMore={() => void loadNextPage()}
  onRetry={() => void invalidateAll()}
  {resolveAsset}
/>
