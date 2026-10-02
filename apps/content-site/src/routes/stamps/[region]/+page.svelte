<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import { getStampImageURL } from "$lib/assets/index";
  import ListToolbarButton from "$lib/components/shared/ListToolbarButton.svelte";
  import CatalogueFrame from "$lib/components/mission/CatalogueFrame.svelte";
  import MissionCharacterPicker from "$lib/components/mission/MissionCharacterPicker.svelte";
  import MysekaiLoadMore from "$lib/components/mysekai/MysekaiLoadMore.svelte";
  import StampTile from "$lib/components/stamp/StampTile.svelte";
  import type { MissionCharacterOption } from "$lib/domain/mission";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import {
    getStampCharacters,
    getStampDisplayName,
    stampCategories,
    stampSources,
    toStampSearchParams,
    type StampItem,
    type StampListQuery
  } from "$lib/domain/stamp";
  import { createStreamedTranslator } from "$lib/i18n/streamed-translator.svelte";
  import { fetchPagedResult, PagedList } from "$lib/paged-list.svelte";
  import { createPageTitle } from "$lib/page-title";
  import { STAMP_PREVIEW_BOX_CLASS } from "$lib/styles/stamp-preview";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import type { Snippet } from "svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "stamp"]);
  const t = $derived(i18n.t);

  const list = new PagedList<StampItem>((stamp) => stamp.id);
  $effect(() => {
    list.reset(Promise.resolve(data.catalogue));
  });

  type CharacterOptionsState = {
    status: "loading" | "ready" | "error";
    items: MissionCharacterOption[];
  };
  let characterOptions = $state<CharacterOptionsState>({ status: "loading", items: [] });
  $effect(() => {
    let active = true;
    characterOptions = { status: "loading", items: [] };
    void Promise.resolve(data.characters).then((items) => {
      if (!active) return;
      characterOptions = items ? { status: "ready", items } : { status: "error", items: [] };
    });
    return () => {
      active = false;
    };
  });

  // The second character picker opens with the switch. A second character in the URL opens
  // it too, so a shared link shows its filter; turning it off drops that character.
  let secondEnabled = $state(false);
  $effect(() => {
    if (data.query.secondCharacterId !== null) secondEnabled = true;
  });

  const title = $derived(t("navigation.stamps"));
  const labels = $derived({
    title,
    home: t("home"),
    search: t("stamp.search"),
    searchAction: t("stamp.searchAction"),
    loading: t("stamp.loading"),
    empty: t("stamp.empty"),
    error: t("stamp.error"),
    retry: t("stamp.retry"),
    previous: "",
    next: ""
  });

  const listPath = (region: string, query: StampListQuery): string => {
    const search = toStampSearchParams(query).toString();
    return `${resolve("/stamps/[region]", { region })}${search ? `?${search}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listPath(region, data.query)
    }))
  );
  const navigateQuery = (overrides: Partial<StampListQuery>): void => {
    void goto(listPath(data.region, { ...data.query, ...overrides }), {
      keepFocus: true,
      noScroll: true
    });
  };
  const loadMore = (): void => {
    void list.loadMore((page) =>
      fetchPagedResult<StampItem>(
        `${resolve("/stamps/[region]/data", { region: data.region })}?${toStampSearchParams(data.query, page).toString()}`
      )
    );
  };

  const tabs = $derived([
    { key: null, label: t("stamp.all") },
    ...stampCategories.map((category) => ({
      key: category,
      label: t(`stamp.category.${category}`)
    }))
  ]);
  const sourceTabs = $derived([
    { key: null, label: t("stamp.all") },
    ...stampSources.map((source) => ({ key: source, label: t(`stamp.source.${source}`) }))
  ]);
  const pickerLabels = $derived({
    loading: t("stamp.loading"),
    error: t("stamp.error"),
    retry: t("stamp.retry"),
    otherGroup: t("stamp.otherUnit"),
    change: t("stamp.characterChange")
  });
  const secondCharacters = $derived(
    characterOptions.items.filter((character) => character.id !== data.query.characterId)
  );
  const sortLabel = $derived(
    `${t("stamp.sortOrder")}: ${data.query.sortOrder === "asc" ? t("stamp.sortDescending") : t("stamp.sortAscending")}`
  );
  const catalogueKey = $derived(`${data.region}:${toStampSearchParams(data.query)}`);

  const setSecondEnabled = (enabled: boolean): void => {
    secondEnabled = enabled;
    if (!enabled && data.query.secondCharacterId !== null) {
      navigateQuery({ secondCharacterId: null });
    }
  };

  let previewStamp = $state<StampItem | null>(null);
  let previewOpen = $state(false);
  const openPreview = (stamp: StampItem): void => {
    previewStamp = stamp;
    previewOpen = true;
  };
</script>

<svelte:head><title>{createPageTitle(`${title} ${regionLabels[data.region]}`)}</title></svelte:head>

{#snippet pageIdentity()}
  <h1 class="text-2xl font-bold text-(--archive-text-strong)">{title}</h1>
{/snippet}

{#snippet tabGroup(
  label: string,
  items: { key: string | null; label: string }[],
  selected: string | null,
  onSelect: (key: string | null) => void
)}
  <div class="grid min-w-0 gap-2">
    <h2 class="text-sm font-semibold text-(--archive-text-strong)">{label}</h2>
    <div class="flex min-w-0 flex-wrap gap-2" role="group" aria-label={label}>
      {#each items as item (item.key ?? "all")}
        {@const active = selected === item.key}
        <button
          type="button"
          class="btn touch-target max-w-full rounded-xl whitespace-normal wrap-break-word {active
            ? 'btn-primary'
            : 'btn-ghost'}"
          aria-pressed={active}
          onclick={() => onSelect(item.key)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet controls()}
  <div class="flex min-w-0 flex-1 flex-col gap-4" data-swipe-region-skip>
    {@render tabGroup(t("stamp.category"), tabs, data.query.category, (key) =>
      navigateQuery({ category: stampCategories.find((value) => value === key) ?? null })
    )}
    {@render tabGroup(t("stamp.source"), sourceTabs, data.query.source, (key) =>
      navigateQuery({ source: stampSources.find((value) => value === key) ?? null })
    )}
    <div class="grid min-w-0 gap-3">
      <MissionCharacterPicker
        characters={characterOptions.items}
        status={characterOptions.status}
        selectedId={data.query.characterId}
        getImageSrc={getLocalCharacterThumbnailAssetURL}
        labels={{ ...pickerLabels, title: t("stamp.characterTitle") }}
        onSelect={(characterId) =>
          navigateQuery({
            characterId,
            secondCharacterId:
              data.query.secondCharacterId === characterId ? null : data.query.secondCharacterId
          })}
        onRetry={() => void invalidateAll()}
      />
      <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        {#if data.query.characterId !== null}
          <button
            type="button"
            class="btn btn-ghost btn-sm touch-target"
            onclick={() => navigateQuery({ characterId: null, secondCharacterId: null })}
          >
            {t("stamp.characterAll")}
          </button>
        {/if}
        <label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            class="toggle toggle-primary"
            checked={secondEnabled}
            disabled={data.query.characterId === null}
            onchange={(event) => setSecondEnabled(event.currentTarget.checked)}
          />
          <span>{t("stamp.secondCharacter")}</span>
        </label>
      </div>
      {#if secondEnabled && data.query.characterId !== null}
        <MissionCharacterPicker
          characters={secondCharacters}
          status={characterOptions.status}
          selectedId={data.query.secondCharacterId}
          getImageSrc={getLocalCharacterThumbnailAssetURL}
          labels={{ ...pickerLabels, title: t("stamp.secondCharacterTitle") }}
          onSelect={(secondCharacterId) => navigateQuery({ secondCharacterId })}
          onRetry={() => void invalidateAll()}
        />
      {/if}
    </div>
  </div>
  <div
    class="border-t border-(--archive-border-subtle) pt-4 lg:shrink-0 lg:border-t-0 lg:pt-0"
    data-swipe-region-skip
  >
    <div class="join shrink-0" role="group" aria-label={t("stamp.sortOrder")}>
      <ListToolbarButton
        icon="mdi:numeric"
        label={t("stamp.sortOrder")}
        ariaLabel={sortLabel}
        title={sortLabel}
        sortIndicatorIcon={data.query.sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down"}
        class="join-item btn-primary"
        onclick={() =>
          navigateQuery({ sortOrder: data.query.sortOrder === "asc" ? "desc" : "asc" })}
      />
    </div>
  </div>
{/snippet}

<CatalogueFrame
  {labels}
  homeHref={resolve("/")}
  {regions}
  status={list.status}
  empty={list.status === "ready" && list.items.length === 0}
  query={data.query.name}
  resetKey={catalogueKey}
  {pageIdentity}
  {controls}
  resultsLabel={t("stamp.results")}
  onSearch={(name) => navigateQuery({ name })}
  onRetry={() => void invalidateAll()}
>
  {#snippet loadingPlaceholder()}
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 2xl:grid-cols-8">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="content-card-shell rounded-2xl p-2 sm:p-3">
          <div class="aspect-square w-full rounded-xl bg-(--archive-surface-sunken)"></div>
          <div class="mt-2 h-4 w-3/4 rounded bg-(--archive-surface-sunken)"></div>
        </div>
      {/each}
    </div>
  {/snippet}
  <ul
    class="grid grid-cols-3 items-stretch gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 2xl:grid-cols-8"
  >
    {#each list.items as stamp (stamp.id)}
      <li class="min-w-0">
        <StampTile
          {stamp}
          imageSrc={getStampImageURL(stamp.assetbundleName, data.region)}
          imageUnavailableLabel={t("imageUnavailable")}
          onOpen={() => openPreview(stamp)}
        />
      </li>
    {/each}
  </ul>
  <MysekaiLoadMore
    hasNext={list.hasNext}
    isLoading={list.isLoadingMore}
    error={list.loadMoreError}
    loadingLabel={t("stamp.loadingMore")}
    idleLabel={t("stamp.loadMore")}
    errorLabel={t("stamp.loadMoreError")}
    retryLabel={t("stamp.retry")}
    onLoadMore={loadMore}
  />
</CatalogueFrame>

{#snippet previewField(label: string, value: Snippet)}
  <div class="grid gap-0.5">
    <dt class="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">{label}</dt>
    <dd class="text-sm wrap-anywhere whitespace-pre-line">{@render value()}</dd>
  </div>
{/snippet}

{#if previewStamp}
  {@const stamp = previewStamp}
  {@const characters = getStampCharacters(stamp.characterIds, characterOptions.items)}
  <ImagePreviewDialog
    bind:open={previewOpen}
    src={getStampImageURL(stamp.assetbundleName, data.region) ?? ""}
    alt={getStampDisplayName(stamp.name)}
    closeLabel={t("closeLabel")}
    formatOptions={["webp", "png"]}
    dialogBoxClass={STAMP_PREVIEW_BOX_CLASS}
  >
    <dl class="grid gap-3 border-t border-(--archive-border-subtle) pt-3 text-left">
      {#snippet name()}
        <span class="font-semibold">{getStampDisplayName(stamp.name)}</span>
      {/snippet}
      {@render previewField(t("stamp.previewName"), name)}
      {#if characters.length > 0}
        {#snippet characterList()}
          <ul class="flex flex-wrap gap-x-3 gap-y-1.5">
            {#each characters as character (character.id)}
              <li class="flex items-center gap-1.5">
                <CharacterAvatar
                  src={getLocalCharacterThumbnailAssetURL(character.id)}
                  label=""
                  characterId={character.id}
                  variant="xs"
                  decorative
                />
                <span>{character.name}</span>
              </li>
            {/each}
          </ul>
        {/snippet}
        {@render previewField(t("stamp.previewCharacters"), characterList)}
      {/if}
      {#if stamp.description}
        {#snippet obtain()}{stamp.description}{/snippet}
        {@render previewField(t("stamp.previewObtain"), obtain)}
      {/if}
    </dl>
  </ImagePreviewDialog>
{/if}
