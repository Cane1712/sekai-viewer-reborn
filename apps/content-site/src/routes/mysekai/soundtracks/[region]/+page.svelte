<script lang="ts">
  import Icon from "@iconify/svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import CatalogueFrame from "$lib/components/mission/CatalogueFrame.svelte";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import MysekaiLoadMore from "$lib/components/mysekai/MysekaiLoadMore.svelte";
  import { getMysekaiSoundTrackAudioURL, getMysekaiSoundTrackJacketURL } from "$lib/assets/index";
  import {
    toMysekaiSoundtrackSearchParams,
    type MusicSoundTrackCategory,
    type MysekaiMusicRecord,
    type MysekaiSoundtrackListQuery
  } from "$lib/domain/mysekai";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createStreamedTranslator } from "$lib/i18n/streamed-translator.svelte";
  import { fetchPagedResult, PagedList } from "$lib/paged-list.svelte";
  import { createPageTitle } from "$lib/page-title";
  import {
    downloadFile,
    formatPlaybackTime,
    SoundtrackPlayer,
    toDownloadFileName
  } from "$lib/soundtrack-player.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "mysekai"]);
  const t = $derived(i18n.t);

  const list = new PagedList<MysekaiMusicRecord>((record) => record.id);
  let categories = $state<MusicSoundTrackCategory[]>([]);
  const player = new SoundtrackPlayer();
  let downloadingId = $state<number | null>(null);
  // The server tags the MP3 with its title, category, and jacket before sending it.
  const download = async (record: MysekaiMusicRecord, title: string): Promise<void> => {
    if (downloadingId !== null) return;
    downloadingId = record.id;
    try {
      await downloadFile(
        resolve("/mysekai/soundtracks/[region]/[id]/download", {
          region: data.region,
          id: String(record.id)
        }),
        toDownloadFileName(title, "mp3")
      );
    } finally {
      downloadingId = null;
    }
  };

  $effect(() => {
    list.reset(Promise.resolve(data.catalogue));
    player.stop();
  });
  // Leaving the page stops the music.
  $effect(() => () => player.stop());
  $effect(() => {
    let active = true;
    void Promise.resolve(data.filters).then((value) => {
      if (active && value) categories = value.soundTrackCategories;
    });
    return () => {
      active = false;
    };
  });

  const title = $derived(t("navigation.mysekaiSoundtracks"));
  const labels = $derived({
    title,
    home: t("home"),
    search: t("mysekai.soundtrack.search"),
    searchAction: t("mysekai.searchAction"),
    loading: t("mysekai.loading"),
    empty: t("mysekai.empty"),
    error: t("mysekai.error"),
    retry: t("mysekai.retry"),
    previous: "",
    next: ""
  });

  const listPath = (region: string, query: MysekaiSoundtrackListQuery): string => {
    const search = toMysekaiSoundtrackSearchParams(query).toString();
    return `${resolve("/mysekai/soundtracks/[region]", { region })}${search ? `?${search}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listPath(region, data.query)
    }))
  );
  const navigateQuery = (overrides: Partial<MysekaiSoundtrackListQuery>): void => {
    void goto(listPath(data.region, { ...data.query, ...overrides }), {
      keepFocus: true,
      noScroll: true
    });
  };
  const loadMore = (): void => {
    void list.loadMore((page) =>
      fetchPagedResult<MysekaiMusicRecord>(
        `${resolve("/mysekai/soundtracks/[region]/data", { region: data.region })}?${toMysekaiSoundtrackSearchParams(data.query, page).toString()}`
      )
    );
  };

  const categoryById = $derived(new Map(categories.map((category) => [category.id, category])));
  const audioUrl = (record: MysekaiMusicRecord): string | null =>
    record.soundTrack
      ? getMysekaiSoundTrackAudioURL(
          record.soundTrack.assetbundleName,
          record.soundTrack.assetbundleFileName
        )
      : null;
  const catalogueKey = $derived(`${data.region}:${toMysekaiSoundtrackSearchParams(data.query)}`);
</script>

<svelte:head><title>{createPageTitle(`${title} ${regionLabels[data.region]}`)}</title></svelte:head>

{#snippet pageIdentity()}
  <h1 class="text-2xl font-bold text-(--archive-text-strong)">{title}</h1>
{/snippet}

{#snippet controls()}
  <label class="flex min-w-0 flex-col gap-1 text-sm font-semibold sm:w-64" data-swipe-region-skip>
    <span>{t("mysekai.soundtrack.category")}</span>
    <select
      class="select min-h-11 w-full bg-(--archive-surface-default)"
      value={data.query.categoryId === null ? "" : String(data.query.categoryId)}
      onchange={(event) =>
        navigateQuery({
          categoryId: event.currentTarget.value ? Number(event.currentTarget.value) : null
        })}
    >
      <option value="">{t("mysekai.all")}</option>
      {#each categories as category (category.id)}
        <option value={String(category.id)}>{category.name}</option>
      {/each}
    </select>
  </label>
{/snippet}

<CatalogueFrame
  inlineSearch
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
  <ul class="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {#each list.items as record (record.id)}
      {#if record.soundTrack}
        {@const track = record.soundTrack}
        {@const category =
          track.musicSoundTrackCategoryId === undefined
            ? null
            : (categoryById.get(track.musicSoundTrackCategoryId) ?? null)}
        {@const jacket = getMysekaiSoundTrackJacketURL(category?.assetbundleName)}
        {@const current = player.currentId === record.id}
        {@const playing = current && player.playing}
        {@const src = audioUrl(record)}
        <li class="content-card-shell min-w-0 rounded-2xl p-2 {current ? 'border-primary/50' : ''}">
          <div class="flex items-center gap-1">
            <div class="flex min-w-0 flex-1 items-center gap-3 p-1">
              <span class="relative size-14 shrink-0 overflow-hidden rounded-lg">
                {#if jacket}
                  <AssetImage
                    buttonClass="block size-full overflow-hidden"
                    src={jacket}
                    alt=""
                    fallbackLabel=""
                    loadMode="visible"
                    imageClass="size-full object-cover"
                  />
                {/if}
              </span>
              <span class="min-w-0 flex-1">
                <span class="line-clamp-2 font-semibold wrap-anywhere text-(--archive-text-strong)"
                  >{track.title}</span
                >
                {#if category}
                  <span class="mt-0.5 block truncate text-xs text-(--archive-text-muted)"
                    >{category.name}</span
                  >
                {/if}
              </span>
            </div>
            <button
              type="button"
              class="btn btn-circle btn-primary touch-target shrink-0"
              aria-pressed={playing}
              aria-label={t(
                playing ? "mysekai.soundtrack.pause" : "mysekai.soundtrack.play"
              ).replace("{title}", track.title)}
              onclick={() => player.toggle(record.id, src)}
            >
              <Icon icon={playing ? "mdi:pause" : "mdi:play"} class="size-6" aria-hidden="true" />
            </button>
            {#if src}
              <button
                type="button"
                class="btn btn-square btn-ghost touch-target shrink-0"
                aria-label={t("mysekai.soundtrack.download").replace("{title}", track.title)}
                title={t("mysekai.soundtrack.download").replace("{title}", track.title)}
                disabled={downloadingId !== null}
                aria-busy={downloadingId === record.id}
                onclick={() => void download(record, track.title)}
              >
                {#if downloadingId === record.id}
                  <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
                {:else}
                  <Icon icon="mdi:download" class="size-5" aria-hidden="true" />
                {/if}
              </button>
            {/if}
          </div>
          {#if current}
            {#if player.failed}
              <p class="px-1 pt-2 text-sm text-error" role="status">
                {t("mysekai.audioUnavailable")}
              </p>
            {:else}
              <div
                class="flex items-center gap-2 px-1 pt-2 text-xs tabular-nums text-(--archive-text-muted)"
              >
                <span>{formatPlaybackTime(player.currentTime)}</span>
                <input
                  type="range"
                  class="range range-primary range-xs min-w-0 flex-1"
                  min="0"
                  max={player.duration || 0}
                  step="0.1"
                  value={player.currentTime}
                  disabled={!player.duration}
                  aria-label={`${t("audioSeekLabel")}: ${track.title}`}
                  oninput={(event) => player.seek(Number(event.currentTarget.value))}
                />
                <span>{formatPlaybackTime(player.duration)}</span>
              </div>
            {/if}
          {/if}
        </li>
      {/if}
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
