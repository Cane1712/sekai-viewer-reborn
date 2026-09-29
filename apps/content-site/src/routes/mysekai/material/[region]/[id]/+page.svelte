<script lang="ts">
  import { resolve } from "$app/paths";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import MysekaiDetailSection from "$lib/components/mysekai/MysekaiDetailSection.svelte";
  import MysekaiDetailStatus from "$lib/components/mysekai/MysekaiDetailStatus.svelte";
  import MysekaiFixtureTile from "$lib/components/mysekai/MysekaiFixtureTile.svelte";
  import MysekaiInfoRow from "$lib/components/mysekai/MysekaiInfoRow.svelte";
  import { getMysekaiFixtureThumbnailURL, getMysekaiMaterialIconURL } from "$lib/assets/index";
  import {
    getMysekaiMaterialRarity,
    getMysekaiMaterialTab,
    type MysekaiDetailPayload,
    type MysekaiMaterialDetail
  } from "$lib/domain/mysekai";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createStreamedTranslator } from "$lib/i18n/streamed-translator.svelte";
  import { createPageTitle } from "$lib/page-title";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "mysekai"]);
  const t = $derived(i18n.t);

  let payload = $state<MysekaiDetailPayload<MysekaiMaterialDetail> | null>(null);
  $effect(() => {
    let active = true;
    payload = null;
    void data.payload.then((value) => {
      if (active) payload = value;
    });
    return () => {
      active = false;
    };
  });
  const material = $derived(payload?.status === "ready" ? payload.item : null);
  let iconFailed = $state(false);
  $effect(() => {
    void material?.iconAssetbundleName;
    iconFailed = false;
  });
  const iconSrc = $derived(
    material && !iconFailed ? getMysekaiMaterialIconURL(material.iconAssetbundleName) : null
  );
  const rarity = $derived(getMysekaiMaterialRarity(material?.mysekaiMaterialRarityType));

  const listTitle = $derived(t("navigation.mysekaiMaterials"));
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: resolve("/mysekai/material/[region]/[id]", { region, id: data.id })
    }))
  );
  const pageTitle = $derived(
    material
      ? createPageTitle(material.name, listTitle)
      : createPageTitle(`${listTitle} ${data.id}`)
  );
  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(data.uiLocale).format(value);
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<section use:swipeRegion class="content-page-shell gap-4 pb-6">
  <PageHeader
    breadcrumbs={[
      { label: t("home"), href: resolve("/") },
      {
        label: listTitle,
        href: resolve("/mysekai/materials/[region]", { region: data.region })
      },
      { label: material?.name ?? data.id }
    ]}
  >
    {#snippet actions()}<RegionBadgeSwitch options={regions} />{/snippet}
  </PageHeader>

  {#if !material}
    <MysekaiDetailStatus
      status={payload?.status ?? "loading"}
      loadingLabel={t("detailLoading")}
      notFoundLabel={t("mysekai.material.notFound")}
      errorLabel={t("mysekai.material.error")}
    />
  {:else}
    <div
      class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)]"
    >
      <div class="flex min-w-0 flex-col gap-4">
        <article class="card content-card-shell shadow-sm">
          <div class="card-body items-start gap-4 p-3 sm:p-5">
            <div class="flex items-center gap-4">
              <span class="flex size-20 shrink-0 items-center justify-center">
                {#if iconSrc}
                  <img
                    src={iconSrc}
                    alt=""
                    class="size-16 object-contain"
                    onerror={() => (iconFailed = true)}
                  />
                {/if}
              </span>
              <h1 class="text-2xl font-bold wrap-anywhere text-(--archive-text-strong)">
                {material.name}
              </h1>
            </div>
            {#if material.description}
              <p class="whitespace-pre-line text-sm text-(--archive-text-muted)">
                {material.description}
              </p>
            {/if}
          </div>
        </article>

        <MysekaiDetailSection
          title={t("mysekai.materialInfo")}
          icon="mdi:information-outline"
          aside={`${t("idLabel")}${material.id}`}
        >
          <dl class="grid gap-2">
            <MysekaiInfoRow label={t("mysekai.materialType")}>
              {t(`mysekai.materialType.${getMysekaiMaterialTab(material.mysekaiMaterialType)}`)}
            </MysekaiInfoRow>
            {#if rarity !== null}
              <MysekaiInfoRow label={t("rarityLabel")}>{formatNumber(rarity)}</MysekaiInfoRow>
            {/if}
            {#if material.sites.length > 0}
              <MysekaiInfoRow label={t("mysekai.gatheredAt")}>
                {material.sites.map((site) => site.name).join(" / ")}
              </MysekaiInfoRow>
            {/if}
            {#if material.iconAssetbundleName}
              <MysekaiInfoRow label={t("internalResourceCodeLabel")}>
                {material.iconAssetbundleName}
              </MysekaiInfoRow>
            {/if}
          </dl>
        </MysekaiDetailSection>
      </div>

      <MysekaiDetailSection title={t("mysekai.usedBy")} icon="mdi:hammer-wrench">
        {#if material.usedBy.length === 0}
          <p class="text-sm text-(--archive-text-muted)">{t("mysekai.usedByEmpty")}</p>
        {:else}
          <ul
            class="grid grid-cols-4 items-stretch gap-2 sm:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10"
          >
            {#each material.usedBy as use (use.fixture.id)}
              <li class="min-w-0">
                <MysekaiFixtureTile
                  href={resolve("/mysekai/fixture/[region]/[id]", {
                    region: data.region,
                    id: String(use.fixture.id)
                  })}
                  name={use.fixture.name}
                  imageSrc={getMysekaiFixtureThumbnailURL(use.fixture)}
                  imageUnavailableLabel={t("imageUnavailable")}
                  badge={t("mysekai.quantity").replace("{quantity}", formatNumber(use.quantity))}
                />
              </li>
            {/each}
          </ul>
        {/if}
      </MysekaiDetailSection>
    </div>
  {/if}
</section>
