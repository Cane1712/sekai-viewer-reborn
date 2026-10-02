<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import CatalogueFrame from "$lib/components/mission/CatalogueFrame.svelte";
  import { getMysekaiMaterialIconURL } from "$lib/assets/index";
  import {
    getMysekaiMaterialRarity,
    getMysekaiMaterialTab,
    mysekaiMaterialTabs,
    type MysekaiMaterial,
    type MysekaiMaterialTab
  } from "$lib/domain/mysekai";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createStreamedTranslator } from "$lib/i18n/streamed-translator.svelte";
  import { createPageTitle } from "$lib/page-title";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "mysekai"]);
  const t = $derived(i18n.t);

  let materials = $state<MysekaiMaterial[] | null>(null);
  let status = $state<"loading" | "error" | "ready">("loading");
  $effect(() => {
    let active = true;
    materials = null;
    status = "loading";
    void data.materials.then((value) => {
      if (!active) return;
      materials = value;
      status = value ? "ready" : "error";
    });
    return () => {
      active = false;
    };
  });

  const selectedTab = $derived.by((): MysekaiMaterialTab | null => {
    const value = page.url.searchParams.get("type");
    return mysekaiMaterialTabs.find((tab) => tab === value) ?? null;
  });
  const name = $derived(page.url.searchParams.get("name")?.trim() ?? "");
  const visibleMaterials = $derived(
    (materials ?? []).filter(
      (material) =>
        (selectedTab === null ||
          getMysekaiMaterialTab(material.mysekaiMaterialType) === selectedTab) &&
        (name === "" ||
          `${material.name} ${material.pronunciation ?? ""}`
            .toLowerCase()
            .includes(name.toLowerCase()))
    )
  );

  const listHref = (region: string, tab: MysekaiMaterialTab | null, query: string): string => {
    const params = [
      ...(tab ? [`type=${tab}`] : []),
      ...(query ? [`name=${encodeURIComponent(query)}`] : [])
    ].join("&");
    return `${resolve("/mysekai/materials/[region]", { region })}${params ? `?${params}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listHref(region, selectedTab, name)
    }))
  );
  const navigate = (tab: MysekaiMaterialTab | null, query: string): void => {
    void goto(listHref(data.region, tab, query), { keepFocus: true, noScroll: true });
  };

  const title = $derived(t("navigation.mysekaiMaterials"));
  const labels = $derived({
    title,
    home: t("home"),
    search: t("mysekai.material.search"),
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
    ...mysekaiMaterialTabs.map((tab) => ({ key: tab, label: t(`mysekai.materialType.${tab}`) }))
  ]);
</script>

<svelte:head><title>{createPageTitle(`${title} ${regionLabels[data.region]}`)}</title></svelte:head>

{#snippet pageIdentity()}
  <h1 class="text-2xl font-bold text-(--archive-text-strong)">{title}</h1>
{/snippet}

{#snippet controls()}
  <div class="min-w-0" data-swipe-region-skip>
    <div class="flex min-w-0 flex-wrap gap-2" role="group" aria-label={t("mysekai.materialType")}>
      {#each tabs as tab (tab.key ?? "all")}
        {@const selected = selectedTab === tab.key}
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

<CatalogueFrame
  {labels}
  homeHref={resolve("/")}
  {regions}
  {status}
  empty={status === "ready" && visibleMaterials.length === 0}
  query={name}
  resetKey={`${data.region}:${selectedTab ?? "all"}`}
  {pageIdentity}
  {controls}
  resultsLabel={t("mysekai.results")}
  onSearch={(query) => navigate(selectedTab, query)}
  onRetry={() => void invalidateAll()}
>
  <ul class="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
    {#each visibleMaterials as material (material.id)}
      {@const iconSrc = getMysekaiMaterialIconURL(material.iconAssetbundleName)}
      {@const rarity = getMysekaiMaterialRarity(material.mysekaiMaterialRarityType)}
      <li class="min-w-0">
        <a
          href={resolve("/mysekai/material/[region]/[id]", {
            region: data.region,
            id: String(material.id)
          })}
          class="content-card-shell flex h-full min-w-0 items-center gap-3 rounded-2xl p-3 outline-none transition-[transform,border-color,background-color] duration-180 hover-lift hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          <span class="flex size-14 shrink-0 items-center justify-center">
            {#if iconSrc}
              <img
                src={iconSrc}
                alt=""
                class="size-12 object-contain"
                loading="lazy"
                decoding="async"
                onerror={(event) => ((event.currentTarget as HTMLImageElement).hidden = true)}
              />
            {/if}
          </span>
          <span class="min-w-0">
            <span class="block font-semibold wrap-anywhere text-(--archive-text-strong)"
              >{material.name}</span
            >
            <span class="mt-0.5 block text-xs text-(--archive-text-muted)">
              {[
                rarity === null ? null : `${t("rarityLabel")} ${rarity}`,
                material.sites.map((site) => site.name).join(" / ") || null
              ]
                .filter((part) => part !== null)
                .join(" · ")}
            </span>
          </span>
        </a>
      </li>
    {/each}
  </ul>
</CatalogueFrame>
