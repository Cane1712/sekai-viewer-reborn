<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import type { SupportedRegion } from "$lib/domain/regions";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import DetailPageSkeleton from "$lib/components/shared/DetailPageSkeleton.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import MusicDetailInfoCard from "$lib/components/music/MusicDetailInfoCard.svelte";
  import MusicDifficultyCard from "$lib/components/music/MusicDifficultyCard.svelte";
  import MusicPreviewCard from "$lib/components/music/MusicPreviewCard.svelte";
  import MusicJacketHero from "$lib/components/music/MusicJacketHero.svelte";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { formatUnitFallbackLabel, unitCodeByMusicTag } from "$lib/domain/unit-profile";
  import { getMusicAssetServer, getMusicJacketAssetURL } from "$lib/assets/index";
  import { createPageTitle } from "$lib/page-title";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const getInitialMessages = (): Record<string, string> =>
    resolveStreamingMessages(data.i18nMessages, ["common", "music", "error"]);
  let currentMessages = $state<Record<string, string>>(getInitialMessages());
  let translationRequestId = 0;

  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, getInitialMessages())(key);

  let displayLocale = $state<string>("");

  let homeLabel = $state(getInitialI18nText("home"));
  let musicListTitle = $state(getInitialI18nText("navigation.songs"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let nameLabel = $state(getInitialI18nText("nameLabel"));
  let musicTitlePrefix = $state(getInitialI18nText("pageTitle.musicPrefix"));
  let musicDetailInfoTitle = $state(getInitialI18nText("musicDetailInfoTitle"));
  let internalResourceCodeLabel = $state(getInitialI18nText("internalResourceCodeLabel"));
  let composerLabel = $state(getInitialI18nText("musicDetailComposerLabel"));
  let arrangerLabel = $state(getInitialI18nText("musicDetailArrangerLabel"));
  let lyricistLabel = $state(getInitialI18nText("musicDetailLyricistLabel"));
  let difficultyLabel = $state(getInitialI18nText("musicDetailDifficultyLabel"));
  let levelLabel = $state(getInitialI18nText("levelLabel"));
  let noteCountLabel = $state(getInitialI18nText("musicDetailNoteCountLabel"));
  let categoryLabel = $state(getInitialI18nText("musicDetailCategoryLabel"));
  let tagLabel = $state(getInitialI18nText("musicDetailTagLabel"));
  let publishedAtLabel = $state(getInitialI18nText("musicDetailPublishedAtLabel"));
  let vocalLabel = $state(getInitialI18nText("musicDetailVocalLabel"));
  let vocalTypeLabel = $state(getInitialI18nText("typeLabel"));
  let vocalCharacterLabel = $state(getInitialI18nText("musicDetailVocalCharacterLabel"));
  let noVocals = $state(getInitialI18nText("musicDetailNoVocals"));
  let noDifficulties = $state(getInitialI18nText("musicDetailNoDifficulties"));
  let chartPreviewLabel = $state(getInitialI18nText("musicDetailChartPreviewLabel"));
  let jacketAltSuffix = $state(getInitialI18nText("musicJacketAltSuffix"));
  let imageUnavailableLabel = $state(getInitialI18nText("imageUnavailable"));
  let closeLabel = $state(getInitialI18nText("closeLabel"));
  let noMusicLabel = $state(getInitialI18nText("failedToLoadMusicData"));
  let musicPreviewShortLabel = $state(getInitialI18nText("musicPreviewShortLabel"));
  let musicPreviewLongLabel = $state(getInitialI18nText("musicPreviewLongLabel"));
  let musicPreviewNoPreviewAvailable = $state(getInitialI18nText("musicPreviewNoPreviewAvailable"));
  let musicPreviewPlayLabel = $state(getInitialI18nText("musicPreviewPlayLabel"));
  let musicPreviewPauseLabel = $state(getInitialI18nText("musicPreviewPauseLabel"));
  let audioDownloadLabel = $state(getInitialI18nText("audioDownloadLabel"));
  let audioDownloadCloseLabel = $state(getInitialI18nText("audioDownloadCloseLabel"));
  let audioVolumeLabel = $state(getInitialI18nText("audioVolumeLabel"));
  let audioSeekLabel = $state(getInitialI18nText("audioSeekLabel"));
  let audioUnavailableLabel = $state(getInitialI18nText("audioUnavailableLabel"));
  let audioDownloadProgressMessages = $state({
    preparing: getInitialI18nText("audioDownloadStages.preparing"),
    fetchingAudio: getInitialI18nText("audioDownloadStages.fetchingAudio"),
    fetchingCover: getInitialI18nText("audioDownloadStages.fetchingCover"),
    writingMetadata: getInitialI18nText("audioDownloadStages.writingMetadata"),
    finalizing: getInitialI18nText("audioDownloadStages.finalizing"),
    ready: getInitialI18nText("audioDownloadStages.ready"),
    failed: getInitialI18nText("audioDownloadStages.failed"),
    cancelled: getInitialI18nText("audioDownloadStages.cancelled")
  });

  $effect(() => {
    displayLocale = data.uiLocale;
    const translate = createI18nTranslator(data.uiLocale, currentMessages);
    applyTranslations(translate);
  });

  $effect(() => {
    const requestId = ++translationRequestId;
    const messagesOrPromise = data.i18nMessages;
    if (!browser) {
      return;
    }

    void refreshTranslations(data.uiLocale, messagesOrPromise, requestId);
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    musicListTitle = translate("navigation.songs");
    idLabel = translate("idLabel");
    nameLabel = translate("nameLabel");
    musicTitlePrefix = translate("pageTitle.musicPrefix");
    musicDetailInfoTitle = translate("musicDetailInfoTitle");
    internalResourceCodeLabel = translate("internalResourceCodeLabel");
    composerLabel = translate("musicDetailComposerLabel");
    arrangerLabel = translate("musicDetailArrangerLabel");
    lyricistLabel = translate("musicDetailLyricistLabel");
    difficultyLabel = translate("musicDetailDifficultyLabel");
    levelLabel = translate("levelLabel");
    noteCountLabel = translate("musicDetailNoteCountLabel");
    categoryLabel = translate("musicDetailCategoryLabel");
    tagLabel = translate("musicDetailTagLabel");
    publishedAtLabel = translate("musicDetailPublishedAtLabel");
    vocalLabel = translate("musicDetailVocalLabel");
    vocalTypeLabel = translate("typeLabel");
    vocalCharacterLabel = translate("musicDetailVocalCharacterLabel");
    noVocals = translate("musicDetailNoVocals");
    noDifficulties = translate("musicDetailNoDifficulties");
    chartPreviewLabel = translate("musicDetailChartPreviewLabel");
    jacketAltSuffix = translate("musicJacketAltSuffix");
    imageUnavailableLabel = translate("imageUnavailable");
    closeLabel = translate("closeLabel");
    noMusicLabel = translate("failedToLoadMusicData");
    musicPreviewShortLabel = translate("musicPreviewShortLabel");
    musicPreviewLongLabel = translate("musicPreviewLongLabel");
    musicPreviewNoPreviewAvailable = translate("musicPreviewNoPreviewAvailable");
    musicPreviewPlayLabel = translate("musicPreviewPlayLabel");
    musicPreviewPauseLabel = translate("musicPreviewPauseLabel");
    audioDownloadLabel = translate("audioDownloadLabel");
    audioDownloadCloseLabel = translate("audioDownloadCloseLabel");
    audioVolumeLabel = translate("audioVolumeLabel");
    audioSeekLabel = translate("audioSeekLabel");
    audioUnavailableLabel = translate("audioUnavailableLabel");
    audioDownloadProgressMessages = {
      preparing: translate("audioDownloadStages.preparing"),
      fetchingAudio: translate("audioDownloadStages.fetchingAudio"),
      fetchingCover: translate("audioDownloadStages.fetchingCover"),
      writingMetadata: translate("audioDownloadStages.writingMetadata"),
      finalizing: translate("audioDownloadStages.finalizing"),
      ready: translate("audioDownloadStages.ready"),
      failed: translate("audioDownloadStages.failed"),
      cancelled: translate("audioDownloadStages.cancelled")
    };
  };

  const refreshTranslations = async (
    localeValue: string,
    messagesOrPromise: typeof data.i18nMessages,
    requestId: number
  ): Promise<void> => {
    let messages: Record<string, string>;
    try {
      messages = await messagesOrPromise;
    } catch {
      return;
    }
    if (requestId !== translationRequestId) return;
    const locale = localeValue;
    currentMessages = messages;
    applyTranslations(createI18nTranslator(locale, messages));
  };

  const getCategoryLabel = (category: string): string =>
    createI18nTranslator(data.uiLocale, currentMessages)(`musicListCategory.${category}`, category);

  const getTagLabel = (value: string): string =>
    unitCodeByMusicTag[value]
      ? (data.unitProfiles[unitCodeByMusicTag[value]] ??
        formatUnitFallbackLabel(unitCodeByMusicTag[value]))
      : createI18nTranslator(data.uiLocale, currentMessages)(`musicListTag.${value}`, value);

  const getDifficultyLabel = (difficulty: string): string =>
    createI18nTranslator(data.uiLocale, currentMessages)(
      `musicDifficulty.${difficulty}`,
      difficulty
    );

  const regionDisplayOrder: SupportedRegion[] = ["jp", "en", "tw", "kr", "cn"];

  const getRegionOptions = (availableRegions: SupportedRegion[]): SupportedRegion[] =>
    regionDisplayOrder.filter(
      (regionOption) => availableRegions.includes(regionOption) || regionOption === data.region
    );

  const getMusicListHref = (): string => resolve("/musics/[region]", { region: data.region });

  const getMusicBreadcrumbItems = (currentLabel: string) => [
    { label: homeLabel, href: resolve("/") },
    { label: musicListTitle, href: getMusicListHref() },
    { label: currentLabel }
  ];

  const getRegionBadgeOptions = (regionOptions: SupportedRegion[]): RegionBadgeOption[] =>
    regionOptions.map((regionOption) =>
      regionOption === data.region
        ? { key: regionOption, label: regionOption.toUpperCase(), active: true }
        : {
            key: regionOption,
            label: regionOption.toUpperCase(),
            href: resolve("/music/[region]/[id]", { region: regionOption, id: data.musicId }),
            active: false
          }
    );

  const getCurrentRegionBadgeOption = (): RegionBadgeOption[] => [
    { key: data.region, label: data.region.toUpperCase(), active: true }
  ];

  const hasAlternativeRegion = (availableRegions: SupportedRegion[]): boolean =>
    availableRegions.some((regionOption) => regionOption !== data.region);

  const getUnavailableError = (availableRegions: SupportedRegion[]): string =>
    hasAlternativeRegion(availableRegions)
      ? (data.musicUnavailableInCurrentRegionMessage ?? noMusicLabel)
      : (data.failedToLoadMusicDataMessage ?? noMusicLabel);
</script>

<svelte:head>
  {#if data.seo}
    <title>{data.seo.pageTitle}</title>
    <meta property="og:site_name" content="Sekai Viewer" />
    <meta property="og:title" content={data.seo.title} />
    {#if data.seo.description}
      <meta property="og:description" content={data.seo.description} />
    {/if}
    {#if data.seo.imageUrl}
      <meta property="og:image" content={data.seo.imageUrl} />
    {/if}
    <meta property="og:url" content={data.seo.canonicalUrl} />
    <meta property="og:type" content="article" />
    <meta name="twitter:card" content="summary_large_image" />
    <!-- Trusted server-built JSON (angle brackets escaped); renders Discord's component embed. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- input is server-built JSON, not user HTML -->
    {@html data.seo.inlineScriptHtml}
  {:else}
    {#await data.musicPayload}
      <title>{createPageTitle(`${musicTitlePrefix} ${data.musicId}`)}</title>
    {:then payload}
      <title>
        {payload.music
          ? createPageTitle(payload.music.title, musicListTitle)
          : createPageTitle(`${musicTitlePrefix} ${data.musicId}`)}
      </title>
    {:catch}
      <title>{createPageTitle(`${musicTitlePrefix} ${data.musicId}`)}</title>
    {/await}
  {/if}
</svelte:head>

<section use:swipeRegion class="content-page-shell gap-4 px-2">
  {#await data.musicPayload}
    <PageHeader
      breadcrumbs={getMusicBreadcrumbItems(`${musicTitlePrefix} ${data.musicId}`)}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        <RegionBadgeSwitch options={getCurrentRegionBadgeOption()} />
      {/snippet}
    </PageHeader>

    <DetailPageSkeleton kind="music" />
  {:then payload}
    <PageHeader
      breadcrumbs={getMusicBreadcrumbItems(
        payload.music?.title ?? `${musicTitlePrefix} ${data.musicId}`
      )}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        {#await data.availableRegions then availableRegions}
          <RegionBadgeSwitch options={getRegionBadgeOptions(getRegionOptions(availableRegions))} />
        {/await}
      {/snippet}
    </PageHeader>

    {#if payload.error}
      <div class="alert alert-error">{payload.error}</div>
    {/if}

    {#if payload.music}
      {#await data.availableRegions then availableRegions}
        <div
          class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)] lg:items-start"
        >
          <div class="flex flex-col gap-4">
            <MusicJacketHero
              music={payload.music}
              region={data.region}
              {availableRegions}
              {jacketAltSuffix}
              {imageUnavailableLabel}
              {closeLabel}
            />
            <MusicDetailInfoCard
              music={payload.music}
              {displayLocale}
              region={data.region}
              title={musicDetailInfoTitle}
              {idLabel}
              {internalResourceCodeLabel}
              {nameLabel}
              {composerLabel}
              {arrangerLabel}
              {lyricistLabel}
              {categoryLabel}
              {tagLabel}
              {publishedAtLabel}
              {getCategoryLabel}
              {getTagLabel}
            />
          </div>
          <div class="flex flex-col gap-4">
            <MusicPreviewCard
              vocals={payload.music.vocals}
              region={data.region}
              {availableRegions}
              musicId={data.musicId}
              title={payload.music.title}
              jacketUrl={payload.music.assetBundleName
                ? getMusicJacketAssetURL(
                    payload.music.assetBundleName,
                    getMusicAssetServer(data.region, availableRegions)
                  )
                : undefined}
              artist={payload.music.composer ?? undefined}
              fillerSec={payload.music.fillerSec}
              {vocalLabel}
              {vocalTypeLabel}
              {vocalCharacterLabel}
              noVocalsLabel={noVocals}
              shortPreviewLabel={musicPreviewShortLabel}
              longPreviewLabel={musicPreviewLongLabel}
              noPreviewAvailableLabel={musicPreviewNoPreviewAvailable}
              downloadProgressMessages={audioDownloadProgressMessages}
              playLabel={musicPreviewPlayLabel}
              pauseLabel={musicPreviewPauseLabel}
              downloadLabel={audioDownloadLabel}
              downloadCloseLabel={audioDownloadCloseLabel}
              volumeLabel={audioVolumeLabel}
              seekLabel={audioSeekLabel}
              unavailableLabel={audioUnavailableLabel}
            />
            <MusicDifficultyCard
              music={payload.music}
              region={data.region}
              {difficultyLabel}
              {levelLabel}
              {noteCountLabel}
              {chartPreviewLabel}
              {noDifficulties}
              {getDifficultyLabel}
            />
          </div>
        </div>
      {/await}
    {:else if !payload.error}
      {#await data.availableRegions}
        <div class="alert">
          <span class="loading loading-spinner loading-sm"></span>
          {noMusicLabel}
        </div>
      {:then availableRegions}
        <div class="alert alert-error">{getUnavailableError(availableRegions)}</div>
      {/await}
    {/if}
  {/await}
</section>
