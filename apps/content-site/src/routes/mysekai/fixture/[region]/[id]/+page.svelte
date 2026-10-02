<script lang="ts">
  import { resolve } from "$app/paths";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import MysekaiDetailSection from "$lib/components/mysekai/MysekaiDetailSection.svelte";
  import MysekaiDetailStatus from "$lib/components/mysekai/MysekaiDetailStatus.svelte";
  import MysekaiInfoRow from "$lib/components/mysekai/MysekaiInfoRow.svelte";
  import MysekaiMaterialChip from "$lib/components/mysekai/MysekaiMaterialChip.svelte";
  import { getMysekaiFixtureThumbnailURL, getMysekaiMaterialIconURL } from "$lib/assets/index";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import type { MysekaiDetailPayload, MysekaiFixtureDetail } from "$lib/domain/mysekai";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createStreamedTranslator } from "$lib/i18n/streamed-translator.svelte";
  import { createPageTitle } from "$lib/page-title";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "mysekai"]);
  const t = $derived(i18n.t);

  let payload = $state<MysekaiDetailPayload<MysekaiFixtureDetail> | null>(null);
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
  const fixture = $derived(payload?.status === "ready" ? payload.item : null);

  const listTitle = $derived(t("navigation.mysekaiFixtures"));
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: resolve("/mysekai/fixture/[region]/[id]", { region, id: data.id })
    }))
  );
  const pageTitle = $derived(
    fixture ? createPageTitle(fixture.name, listTitle) : createPageTitle(`${listTitle} ${data.id}`)
  );
  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(data.uiLocale).format(value);
  const quantityLabel = (quantity: number): string =>
    t("mysekai.quantity").replace("{quantity}", formatNumber(quantity));
  const yesNo = (value: boolean | undefined): string =>
    value ? t("mysekai.yes") : t("mysekai.no");
  const materialHref = (id: number): string =>
    resolve("/mysekai/material/[region]/[id]", { region: data.region, id: String(id) });
  const knownLayouts = new Set([
    "floor",
    "floor_appearance",
    "road",
    "rug",
    "wall",
    "wall_appearance"
  ]);
  const knownSites = new Set(["any", "home", "room"]);
  // Character tags carry the character's name in the region's language.
  const characterName = (characterId: number): string =>
    fixture?.tags.find(
      (tag) => tag.mysekaiFixtureTagType === "game_character" && tag.externalId === characterId
    )?.name ?? t("mysekai.characterLabel");
  const colors = $derived(
    fixture
      ? [
          ...(fixture.colorCode ? [fixture.colorCode] : []),
          ...(fixture.anotherColors ?? []).flatMap((color) =>
            color.colorCode ? [color.colorCode] : []
          )
        ]
      : []
  );
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<section use:swipeRegion class="content-page-shell gap-4 pb-6">
  <PageHeader
    breadcrumbs={[
      { label: t("home"), href: resolve("/") },
      {
        label: listTitle,
        href: resolve("/mysekai/fixtures/[region]", { region: data.region })
      },
      { label: fixture?.name ?? data.id }
    ]}
  >
    {#snippet actions()}<RegionBadgeSwitch options={regions} />{/snippet}
  </PageHeader>

  {#if !fixture}
    <MysekaiDetailStatus
      status={payload?.status ?? "loading"}
      loadingLabel={t("detailLoading")}
      notFoundLabel={t("mysekai.fixture.notFound")}
      errorLabel={t("mysekai.fixture.error")}
    />
  {:else}
    <div
      class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)]"
    >
      <article class="card content-card-shell shadow-sm">
        <div class="card-body gap-4 p-3 sm:p-5">
          <div class="mx-auto aspect-square w-1/2 overflow-hidden rounded-xl">
            <AssetImage
              buttonClass="block size-full overflow-hidden"
              src={getMysekaiFixtureThumbnailURL(fixture) ?? ""}
              alt={fixture.name}
              fallbackLabel={t("imageUnavailable")}
              imageClass="size-full object-contain p-3"
            />
          </div>
          <h1 class="text-2xl font-bold wrap-anywhere text-(--archive-text-strong)">
            {fixture.name}
          </h1>
          {#if fixture.flavorText && fixture.flavorText !== fixture.name}
            <p class="whitespace-pre-line text-sm text-(--archive-text-muted)">
              {fixture.flavorText}
            </p>
          {/if}
          {#if colors.length > 1}
            <div>
              <p class="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                {t("mysekai.colorVariants")}
              </p>
              <ul class="mt-2 flex flex-wrap gap-2">
                {#each colors as color, index (index)}
                  <li
                    class="size-7 rounded-full border border-(--archive-border-default)"
                    style:background-color={color}
                    title={color}
                  ></li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      </article>

      <div class="flex min-w-0 flex-col gap-4">
        <MysekaiDetailSection
          title={t("mysekai.fixtureInfo")}
          icon="mdi:information-outline"
          aside={`${t("idLabel")}${fixture.id}`}
        >
          <dl class="grid gap-2 sm:grid-cols-2">
            {#if fixture.mainGenre}
              <MysekaiInfoRow label={t("mysekai.genre")}>
                {#if fixture.subGenre && fixture.subGenre.name !== fixture.mainGenre.name}
                  {`${fixture.mainGenre.name} / ${fixture.subGenre.name}`}
                {:else}
                  {fixture.mainGenre.name}
                {/if}
              </MysekaiInfoRow>
            {/if}
            {#if fixture.gridSize}
              <MysekaiInfoRow label={t("mysekai.gridSize")}>
                {t("mysekai.gridSizeValue")
                  .replace("{width}", formatNumber(fixture.gridSize.width))
                  .replace("{depth}", formatNumber(fixture.gridSize.depth))
                  .replace("{height}", formatNumber(fixture.gridSize.height))}
              </MysekaiInfoRow>
            {/if}
            {#if fixture.mysekaiSettableLayoutType && knownLayouts.has(fixture.mysekaiSettableLayoutType)}
              <MysekaiInfoRow label={t("mysekai.layoutType")}>
                {t(`mysekai.layout.${fixture.mysekaiSettableLayoutType}`)}
              </MysekaiInfoRow>
            {/if}
            {#if fixture.mysekaiSettableSiteType && knownSites.has(fixture.mysekaiSettableSiteType)}
              <MysekaiInfoRow label={t("mysekai.settableSite")}>
                {t(`mysekai.site.${fixture.mysekaiSettableSiteType}`)}
              </MysekaiInfoRow>
            {/if}
            {#if fixture.tags.length > 0}
              <div class="sm:col-span-2">
                <MysekaiInfoRow label={t("mysekai.tags")}>
                  <span class="flex flex-wrap gap-1.5">
                    {#each fixture.tags as tag (tag.id)}
                      <span class="badge badge-outline border-(--archive-border-default)"
                        >{tag.name}</span
                      >
                    {/each}
                  </span>
                </MysekaiInfoRow>
              </div>
            {/if}
            {#if fixture.assetbundleName}
              <div class="sm:col-span-2">
                <MysekaiInfoRow label={t("internalResourceCodeLabel")}>
                  {fixture.assetbundleName}
                </MysekaiInfoRow>
              </div>
            {/if}
          </dl>
        </MysekaiDetailSection>

        {#if fixture.blueprint}
          <MysekaiDetailSection title={t("mysekai.crafting")} icon="mdi:hammer-wrench">
            <dl class="grid gap-2 sm:grid-cols-3">
              <MysekaiInfoRow label={t("mysekai.sketchable")}>
                {yesNo(fixture.blueprint.isEnableSketch)}
              </MysekaiInfoRow>
              <MysekaiInfoRow label={t("mysekai.obtainedByConvert")}>
                {yesNo(fixture.blueprint.isObtainedByConvert)}
              </MysekaiInfoRow>
              {#if fixture.blueprint.craftCountLimit}
                <MysekaiInfoRow label={t("mysekai.craftCountLimit")}>
                  {formatNumber(fixture.blueprint.craftCountLimit)}
                </MysekaiInfoRow>
              {/if}
            </dl>
            {#if fixture.blueprint.materialCosts.length > 0}
              <div>
                <h3 class="text-sm font-semibold text-(--archive-text-default)">
                  {t("mysekai.materialCosts")}
                </h3>
                <div class="mt-2 flex flex-wrap gap-2">
                  {#each fixture.blueprint.materialCosts as cost, index (index)}
                    <MysekaiMaterialChip
                      name={cost.material.name}
                      iconSrc={getMysekaiMaterialIconURL(cost.material.iconAssetbundleName)}
                      quantityLabel={quantityLabel(cost.quantity)}
                      href={materialHref(cost.material.id)}
                    />
                  {/each}
                </div>
              </div>
            {/if}
          </MysekaiDetailSection>
        {/if}

        {#if fixture.disassembleMaterials.length > 0}
          <MysekaiDetailSection
            title={t("mysekai.disassembleMaterials")}
            icon="mdi:package-variant-closed"
          >
            <div class="flex flex-wrap gap-2">
              {#each fixture.disassembleMaterials as entry, index (index)}
                <MysekaiMaterialChip
                  name={entry.material.name}
                  iconSrc={getMysekaiMaterialIconURL(entry.material.iconAssetbundleName)}
                  quantityLabel={quantityLabel(entry.quantity)}
                  href={materialHref(entry.material.id)}
                />
              {/each}
            </div>
          </MysekaiDetailSection>
        {/if}

        {#if fixture.characterBonus && fixture.characterBonus.gameCharacterIds.length > 0}
          <MysekaiDetailSection title={t("mysekai.characterBonus")} icon="mdi:account-group">
            <div class="flex flex-wrap items-center gap-3">
              {#each fixture.characterBonus.gameCharacterIds as characterId (characterId)}
                <CharacterAvatar
                  src={getLocalCharacterThumbnailAssetURL(characterId)}
                  label={characterName(characterId)}
                  {characterId}
                  variant="sm"
                />
              {/each}
              {#if fixture.characterBonus.bonusRate !== undefined}
                <span class="text-sm text-(--archive-text-muted)">
                  {t("mysekai.bonusRate")}:
                  <span class="font-semibold tabular-nums text-(--archive-text-strong)"
                    >{formatNumber(fixture.characterBonus.bonusRate)}</span
                  >
                </span>
              {/if}
            </div>
          </MysekaiDetailSection>
        {/if}
      </div>
    </div>
  {/if}
</section>
