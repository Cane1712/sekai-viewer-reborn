<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import CatalogueFrame from "$lib/components/mission/CatalogueFrame.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import ListToolbarButton from "$lib/components/shared/ListToolbarButton.svelte";
  import MysekaiFixtureTile from "$lib/components/mysekai/MysekaiFixtureTile.svelte";
  import MysekaiLoadMore from "$lib/components/mysekai/MysekaiLoadMore.svelte";
  import { getMysekaiFixtureThumbnailURL } from "$lib/assets/index";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import {
    getMysekaiFixtureTagsOfType,
    toMysekaiFixtureSearchParams,
    type MysekaiFixture,
    type MysekaiFixtureFilters,
    type MysekaiFixtureListQuery
  } from "$lib/domain/mysekai";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createStreamedTranslator } from "$lib/i18n/streamed-translator.svelte";
  import { fetchPagedResult, PagedList } from "$lib/paged-list.svelte";
  import { createPageTitle } from "$lib/page-title";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "mysekai"]);
  const t = $derived(i18n.t);

  const list = new PagedList<MysekaiFixture>((fixture) => fixture.id);
  let filters = $state<MysekaiFixtureFilters | null>(null);
  let filtersRegion: string | null = null;

  $effect(() => {
    list.reset(Promise.resolve(data.catalogue));
  });
  // A new query reloads the filters too; keep the current ones until then unless the
  // region changed, so the selects do not flicker.
  $effect(() => {
    const region = data.region;
    let active = true;
    if (filtersRegion !== region) filters = null;
    void Promise.resolve(data.filters).then((value) => {
      if (!active) return;
      filters = value;
      filtersRegion = region;
    });
    return () => {
      active = false;
    };
  });

  const title = $derived(t("navigation.mysekaiFixtures"));
  const labels = $derived({
    title,
    home: t("home"),
    search: t("mysekai.fixture.search"),
    searchAction: t("mysekai.searchAction"),
    loading: t("mysekai.loading"),
    empty: t("mysekai.empty"),
    error: t("mysekai.error"),
    retry: t("mysekai.retry"),
    previous: "",
    next: ""
  });

  const listPath = (region: string, query: MysekaiFixtureListQuery): string => {
    const search = toMysekaiFixtureSearchParams(query).toString();
    return `${resolve("/mysekai/fixtures/[region]", { region })}${search ? `?${search}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listPath(region, data.query)
    }))
  );
  const navigateQuery = (overrides: Partial<MysekaiFixtureListQuery>): void => {
    void goto(listPath(data.region, { ...data.query, ...overrides }), {
      keepFocus: true,
      noScroll: true
    });
  };
  const loadMore = (): void => {
    void list.loadMore((page) =>
      fetchPagedResult<MysekaiFixture>(
        `${resolve("/mysekai/fixtures/[region]/data", { region: data.region })}?${toMysekaiFixtureSearchParams(data.query, page).toString()}`
      )
    );
  };

  const selectedMainGenre = $derived(
    filters?.mainGenres.find((genre) => genre.id === data.query.mainGenreId) ?? null
  );
  const seriesTags = $derived(filters ? getMysekaiFixtureTagsOfType(filters.tags, "series") : []);
  const unitTags = $derived(filters ? getMysekaiFixtureTagsOfType(filters.tags, "unit") : []);
  const characterTags = $derived(
    filters ? getMysekaiFixtureTagsOfType(filters.tags, "game_character") : []
  );
  const genreNames = $derived(
    new Map(
      (filters?.mainGenres ?? []).flatMap((genre) => [
        [`main:${genre.id}`, genre.name],
        ...genre.subGenres.map((sub) => [`sub:${sub.id}`, sub.name] as const)
      ])
    )
  );
  const genreLabel = (fixture: MysekaiFixture): string | null =>
    (fixture.mysekaiFixtureSubGenreId === undefined
      ? undefined
      : genreNames.get(`sub:${fixture.mysekaiFixtureSubGenreId}`)) ??
    (fixture.mysekaiFixtureMainGenreId === undefined
      ? undefined
      : genreNames.get(`main:${fixture.mysekaiFixtureMainGenreId}`)) ??
    null;
  const parseSelectedId = (value: string): number | null => (value ? Number(value) : null);
  const sortLabel = $derived(
    `${t("mysekai.sortOrder")}: ${data.query.sortOrder === "asc" ? t("mysekai.sortDescending") : t("mysekai.sortAscending")}`
  );
  const catalogueKey = $derived(`${data.region}:${toMysekaiFixtureSearchParams(data.query)}`);
</script>

<svelte:head><title>{createPageTitle(`${title} ${regionLabels[data.region]}`)}</title></svelte:head>

{#snippet pageIdentity()}
  <h1 class="text-2xl font-bold text-(--archive-text-strong)">{title}</h1>
{/snippet}

{#snippet filterSelect(
  label: string,
  value: number | null,
  options: { id: number; name: string }[],
  onChange: (id: number | null) => void
)}
  <label class="flex min-w-0 flex-col gap-1 text-sm font-semibold">
    <span>{label}</span>
    <select
      class="select min-h-11 w-full bg-(--archive-surface-default)"
      value={value === null ? "" : String(value)}
      disabled={options.length === 0}
      onchange={(event) => onChange(parseSelectedId(event.currentTarget.value))}
    >
      <option value="">{t("mysekai.all")}</option>
      {#each options as option (option.id)}
        <option value={String(option.id)}>{option.name}</option>
      {/each}
    </select>
  </label>
{/snippet}

{#snippet controls()}
  <div class="flex min-w-0 flex-1 flex-col gap-4" data-swipe-region-skip>
    <div class="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
      {@render filterSelect(
        t("mysekai.genre"),
        data.query.mainGenreId,
        filters?.mainGenres ?? [],
        (mainGenreId) => navigateQuery({ mainGenreId, subGenreId: null })
      )}
      {@render filterSelect(
        t("mysekai.subGenre"),
        data.query.subGenreId,
        selectedMainGenre?.subGenres ?? [],
        (subGenreId) => navigateQuery({ subGenreId })
      )}
      {@render filterSelect(
        t("mysekai.series"),
        data.query.seriesTagId,
        seriesTags,
        (seriesTagId) => navigateQuery({ seriesTagId })
      )}
      {@render filterSelect(t("mysekai.unit"), data.query.unitTagId, unitTags, (unitTagId) =>
        navigateQuery({ unitTagId })
      )}
    </div>
    {#if characterTags.length > 0}
      <div
        class="flex min-w-0 flex-wrap gap-1"
        role="group"
        aria-label={t("mysekai.characterLabel")}
      >
        {#each characterTags as tag (tag.id)}
          {@const selected = data.query.characterTagId === tag.id}
          <button
            type="button"
            class="btn btn-square touch-target btn-sm {selected
              ? 'btn-primary'
              : 'btn-ghost'} tooltip"
            data-tip={tag.name}
            aria-label={tag.name}
            aria-pressed={selected}
            onclick={() => navigateQuery({ characterTagId: selected ? null : tag.id })}
          >
            <CharacterAvatar
              src={getLocalCharacterThumbnailAssetURL(tag.externalId ?? null)}
              label={tag.name}
              characterId={tag.externalId ?? null}
              variant="xs"
              decorative
            />
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div
    class="border-t border-(--archive-border-subtle) pt-4 lg:shrink-0 lg:border-t-0 lg:pt-0"
    data-swipe-region-skip
  >
    <div class="join shrink-0" role="group" aria-label={t("mysekai.sortOrder")}>
      <ListToolbarButton
        icon="mdi:numeric"
        label={t("mysekai.sortOrder")}
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
  resultsLabel={t("mysekai.results")}
  onSearch={(name) => navigateQuery({ name })}
  onRetry={() => void invalidateAll()}
>
  {#snippet loadingPlaceholder()}
    <div class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 2xl:grid-cols-12">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="content-card-shell rounded-xl p-1.5 sm:p-2">
          <div class="aspect-square w-full rounded-lg bg-(--archive-surface-sunken)"></div>
          <div class="mt-1.5 h-3 w-3/4 rounded bg-(--archive-surface-sunken)"></div>
        </div>
      {/each}
    </div>
  {/snippet}
  <ul class="grid grid-cols-4 items-stretch gap-2 sm:grid-cols-6 lg:grid-cols-8 2xl:grid-cols-12">
    {#each list.items as fixture (fixture.id)}
      <li class="min-w-0">
        <MysekaiFixtureTile
          href={resolve("/mysekai/fixture/[region]/[id]", {
            region: data.region,
            id: String(fixture.id)
          })}
          name={fixture.name}
          imageSrc={getMysekaiFixtureThumbnailURL(fixture)}
          imageUnavailableLabel={t("imageUnavailable")}
          meta={genreLabel(fixture)}
        />
      </li>
    {/each}
  </ul>
  <MysekaiLoadMore
    hasNext={list.hasNext}
    isLoading={list.isLoadingMore}
    error={list.loadMoreError}
    loadingLabel={t("mysekai.loadingMore")}
    idleLabel={t("mysekai.loadMore")}
    errorLabel={t("mysekai.loadMoreError")}
    retryLabel={t("mysekai.retry")}
    onLoadMore={loadMore}
  />
</CatalogueFrame>
