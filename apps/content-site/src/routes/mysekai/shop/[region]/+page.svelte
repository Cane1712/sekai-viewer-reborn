<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import CatalogueFrame from "$lib/components/mission/CatalogueFrame.svelte";
  import { getMysekaiMaterialIconURL, getMysekaiToolIconURL } from "$lib/assets/index";
  import {
    mysekaiShopTypes,
    type MysekaiShopItem,
    type MysekaiShopType
  } from "$lib/domain/mysekai";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { getRewardItemIcon } from "$lib/domain/reward-item";
  import { createStreamedTranslator } from "$lib/i18n/streamed-translator.svelte";
  import { createPageTitle } from "$lib/page-title";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "mysekai"]);
  const t = $derived(i18n.t);

  let items = $state<MysekaiShopItem[] | null>(null);
  let status = $state<"loading" | "error" | "ready">("loading");
  $effect(() => {
    let active = true;
    items = null;
    status = "loading";
    void data.items.then((value) => {
      if (!active) return;
      items = value;
      status = value ? "ready" : "error";
    });
    return () => {
      active = false;
    };
  });

  const selectedType = $derived.by((): MysekaiShopType | null => {
    const value = page.url.searchParams.get("type");
    return mysekaiShopTypes.find((type) => type === value) ?? null;
  });
  const name = $derived(page.url.searchParams.get("name")?.trim() ?? "");
  const resourceNames = (item: MysekaiShopItem): string =>
    item.resources.map((resource) => resource.name ?? "").join(" ");
  const visibleItems = $derived(
    (items ?? []).filter(
      (item) =>
        (selectedType === null || item.mysekaiShopType === selectedType) &&
        (name === "" || resourceNames(item).toLowerCase().includes(name.toLowerCase()))
    )
  );

  const listHref = (region: string, type: MysekaiShopType | null, query: string): string => {
    const params = [
      ...(type ? [`type=${type}`] : []),
      ...(query ? [`name=${encodeURIComponent(query)}`] : [])
    ].join("&");
    return `${resolve("/mysekai/shop/[region]", { region })}${params ? `?${params}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listHref(region, selectedType, name)
    }))
  );
  const navigate = (type: MysekaiShopType | null, query: string): void => {
    void goto(listHref(data.region, type, query), { keepFocus: true, noScroll: true });
  };

  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(data.uiLocale).format(value);
  const resourceIcon = (
    resource: MysekaiShopItem["resources"][number] | undefined
  ): string | null => {
    if (resource?.resourceType === "mysekai_material") {
      return getMysekaiMaterialIconURL(resource.assetbundleName);
    }
    if (resource?.resourceType === "mysekai_tool") {
      return getMysekaiToolIconURL(resource.assetbundleName);
    }
    return null;
  };
  const resourceLabel = (resource: MysekaiShopItem["resources"][number]): string => {
    const label = resource.name ?? `#${resource.resourceId ?? "?"}`;
    return resource.resourceQuantity > 1
      ? `${label} ${t("mysekai.quantity").replace("{quantity}", formatNumber(resource.resourceQuantity))}`
      : label;
  };
  const costIcon = (cost: MysekaiShopItem["costs"][number]): string | null =>
    getRewardItemIcon(
      { resourceType: cost.resourceType, resourceId: cost.resourceId ?? null },
      data.region
    )?.src ?? null;
  // A single material links to its material page; tools have no page.
  const materialHref = (item: MysekaiShopItem): string | null => {
    const [resource] = item.resources;
    return item.resources.length === 1 &&
      resource?.resourceType === "mysekai_material" &&
      resource.resourceId
      ? resolve("/mysekai/material/[region]/[id]", {
          region: data.region,
          id: String(resource.resourceId)
        })
      : null;
  };
  const hideBrokenImage = (event: Event): void => {
    (event.currentTarget as HTMLImageElement).hidden = true;
  };

  const title = $derived(t("navigation.mysekaiShop"));
  const labels = $derived({
    title,
    home: t("home"),
    search: t("mysekai.shop.search"),
    searchAction: t("mysekai.searchAction"),
    loading: t("mysekai.loading"),
    empty: t("mysekai.empty"),
    error: t("mysekai.error"),
    retry: t("mysekai.retry"),
    previous: "",
    next: ""
  });
  const tabs = $derived([
    { key: null, label: t("mysekai.all") },
    ...mysekaiShopTypes.map((type) => ({ key: type, label: t(`mysekai.shopType.${type}`) }))
  ]);
  const cardClass = "content-card-shell flex h-full min-w-0 items-center gap-3 rounded-2xl p-3";
</script>

<svelte:head><title>{createPageTitle(`${title} ${regionLabels[data.region]}`)}</title></svelte:head>

{#snippet pageIdentity()}
  <h1 class="text-2xl font-bold text-(--archive-text-strong)">{title}</h1>
{/snippet}

{#snippet controls()}
  <div class="min-w-0" data-swipe-region-skip>
    <div class="flex min-w-0 flex-wrap gap-2" role="group" aria-label={t("mysekai.shopType")}>
      {#each tabs as tab (tab.key ?? "all")}
        {@const selected = selectedType === tab.key}
        <button
          type="button"
          class="btn touch-target max-w-full rounded-xl whitespace-normal wrap-break-word {selected
            ? 'btn-primary'
            : 'btn-ghost'}"
          aria-pressed={selected}
          onclick={() => navigate(tab.key, name)}
        >
          {tab.label}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet itemBody(item: MysekaiShopItem)}
  {@const iconSrc = resourceIcon(item.resources[0])}
  <span class="flex size-14 shrink-0 items-center justify-center">
    {#if iconSrc}
      <img
        src={iconSrc}
        alt=""
        class="size-12 object-contain"
        loading="lazy"
        decoding="async"
        onerror={hideBrokenImage}
      />
    {/if}
  </span>
  <span class="min-w-0">
    <span class="block font-semibold wrap-anywhere text-(--archive-text-strong)">
      {item.resources.map(resourceLabel).join(" · ") || `#${item.id}`}
    </span>
    <span
      class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--archive-text-muted)"
    >
      {#each item.costs as cost, costIndex (costIndex)}
        {@const src = costIcon(cost)}
        <span class="inline-flex items-center gap-1">
          <span class="sr-only">{t("mysekai.shop.price")}</span>
          {#if src}
            <img
              {src}
              alt=""
              class="size-4 object-contain"
              loading="lazy"
              decoding="async"
              onerror={hideBrokenImage}
            />
          {/if}
          <span class="font-semibold text-(--archive-text-strong)"
            >{formatNumber(cost.quantity)}</span
          >
        </span>
      {/each}
      {#if item.mysekaiShopExchangeLimitType === "limited_per_mysekai_colorful_pass" && item.mysekaiShopExchangeLimitValue}
        <span class="badge badge-sm badge-outline border-base-content/20">
          {t("mysekai.shop.limitPerPass").replace(
            "{count}",
            formatNumber(item.mysekaiShopExchangeLimitValue)
          )}
        </span>
      {/if}
    </span>
  </span>
{/snippet}

<CatalogueFrame
  {labels}
  homeHref={resolve("/")}
  {regions}
  {status}
  empty={status === "ready" && visibleItems.length === 0}
  query={name}
  resetKey={`${data.region}:${selectedType ?? "all"}`}
  {pageIdentity}
  {controls}
  resultsLabel={t("mysekai.results")}
  onSearch={(query) => navigate(selectedType, query)}
  onRetry={() => void invalidateAll()}
>
  <ul class="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
    {#each visibleItems as item (item.id)}
      {@const href = materialHref(item)}
      <li class="min-w-0">
        {#if href}
          <a
            {href}
            class="{cardClass} outline-none transition-[transform,border-color,background-color] duration-180 hover-lift hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            {@render itemBody(item)}
          </a>
        {:else}
          <div class={cardClass}>{@render itemBody(item)}</div>
        {/if}
      </li>
    {/each}
  </ul>
</CatalogueFrame>
