<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import type { SupportedRegion } from "$lib/domain/regions";
  import EventDebugDialog from "$lib/components/shared/EventDebugDialog.svelte";
  import EventDetailAssetCard from "$lib/components/event/EventDetailAssetCard.svelte";
  import EventDetailBgmCard from "$lib/components/event/EventDetailBgmCard.svelte";
  import EventDetailCountdownCard from "$lib/components/event/EventDetailCountdownCard.svelte";
  import EventDetailDataCard from "$lib/components/event/EventDetailDataCard.svelte";
  import EventDetailInfoCard from "$lib/components/event/EventDetailInfoCard.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import DetailPageSkeleton from "$lib/components/shared/DetailPageSkeleton.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { formatUnitFallbackLabel } from "$lib/domain/unit-profile";
  import { getEventTrackerHref } from "$lib/tools-site";
  import { createPageTitle } from "$lib/page-title";
  import DiscordEmbedHead from "$lib/components/shared/DiscordEmbedHead.svelte";
  import type { PageProps } from "./$types";

  type EventAssetTab = "banner" | "title" | "background" | "characters";

  let { data }: PageProps = $props();
  const getInitialMessages = (): Record<string, string> =>
    resolveStreamingMessages(data.i18nMessages, ["common", "event", "error"]);
  let translationRequestId = 0;
  let currentMessages = $state<Record<string, string>>(getInitialMessages());
  let currentTranslate = $derived(createI18nTranslator(data.uiLocale, currentMessages));
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, getInitialMessages())(key);
  let debugDialog: HTMLDialogElement | null = $state(null);
  let displayLocale = $state<string>("");
  let activeAssetTab = $state<EventAssetTab>("banner");
  let homeLabel = $state(getInitialI18nText("home"));
  let eventListTitle = $state(getInitialI18nText("navigation.events"));
  let startAtLabel = $state(getInitialI18nText("startAt"));
  let endAtLabel = $state(getInitialI18nText("endAt"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let nameLabel = $state(getInitialI18nText("nameLabel"));
  let unitLabel = $state(getInitialI18nText("unitLabel"));
  let mixedUnitLabel = $state(getInitialI18nText("mixedUnitLabel"));
  let eventTypeLabel = $state(getInitialI18nText("eventTypeLabel"));
  let eventBgmTitle = $state(getInitialI18nText("eventBgmTitle"));
  let audioPlayLabel = $state(getInitialI18nText("audioPlayLabel"));
  let audioPauseLabel = $state(getInitialI18nText("audioPauseLabel"));
  let audioDownloadLabel = $state(getInitialI18nText("audioDownloadLabel"));
  let audioVolumeLabel = $state(getInitialI18nText("audioVolumeLabel"));
  let audioSeekLabel = $state(getInitialI18nText("audioSeekLabel"));
  let audioUnavailableLabel = $state(getInitialI18nText("audioUnavailableLabel"));
  let audioDownloadStagePreparingLabel = $state(
    getInitialI18nText("audioDownloadStages.preparing")
  );
  let audioDownloadStageFetchingAudioLabel = $state(
    getInitialI18nText("audioDownloadStages.fetchingAudio")
  );
  let audioDownloadStageFetchingCoverLabel = $state(
    getInitialI18nText("audioDownloadStages.fetchingCover")
  );
  let audioDownloadStageWritingMetadataLabel = $state(
    getInitialI18nText("audioDownloadStages.writingMetadata")
  );
  let audioDownloadStageFinalizingLabel = $state(
    getInitialI18nText("audioDownloadStages.finalizing")
  );
  let audioDownloadStageReadyLabel = $state(getInitialI18nText("audioDownloadStages.ready"));
  let audioDownloadStageFailedLabel = $state(getInitialI18nText("audioDownloadStages.failed"));
  let audioDownloadStageCancelledLabel = $state(
    getInitialI18nText("audioDownloadStages.cancelled")
  );
  let audioDownloadCloseLabel = $state(getInitialI18nText("audioDownloadCloseLabel"));
  let bannerAltSuffix = $state(getInitialI18nText("bannerAltSuffix"));
  let imageUnavailableLabel = $state(getInitialI18nText("imageUnavailable"));
  let noEventLabel = $state(getInitialI18nText("noCurrentEventData"));
  let eventTrackerLabel = $state(getInitialI18nText("eventTrackerLink"));
  let eventTitlePrefix = $state(getInitialI18nText("pageTitle.eventPrefix"));
  let bannerTabLabel = $state(getInitialI18nText("assetTab.banner"));
  let titleTabLabel = $state(getInitialI18nText("eventAssetTabs.title"));
  let backgroundTabLabel = $state(getInitialI18nText("assetTab.background"));
  let charactersTabLabel = $state(getInitialI18nText("eventAssetTabs.characters"));
  let eventInfoTitle = $state(getInitialI18nText("eventInfoTitle"));
  let eventCountdownTitle = $state(getInitialI18nText("eventCountdownTitle"));
  let debugEventJsonButtonLabel = $state(getInitialI18nText("debugJsonButton"));
  let debugEventJsonTitle = $state(getInitialI18nText("debugEventJsonTitle"));
  let closeLabel = $state(getInitialI18nText("closeLabel"));
  let detailLoadingLabel = $state(getInitialI18nText("detailLoading"));
  let bannerCharacterLabel = $state(getInitialI18nText("bannerCharacterLabel"));
  let internalResourceCodeLabel = $state(getInitialI18nText("internalResourceCodeLabel"));
  let eventBonusCharacterLabel = $state(getInitialI18nText("eventBonusCharacterLabel"));
  let eventAnyCharacterLabel = $state(getInitialI18nText("eventAnyCharacterLabel"));
  let eventRarityBonusLabel = $state(getInitialI18nText("eventRarityBonusLabel"));
  let eventRarityLabel = $state(getInitialI18nText("rarityLabel"));
  let eventFeaturedCardsTitle = $state(getInitialI18nText("eventFeaturedCardsTitle"));
  let eventFeaturedCardBonusLabel = $state(getInitialI18nText("eventFeaturedCardBonusLabel"));
  let eventFeaturedCardBonusShortLabel = $state(
    getInitialI18nText("eventFeaturedCardBonusShortLabel")
  );
  let eventLeaderBonusLabel = $state(getInitialI18nText("eventLeaderBonusLabel"));
  let eventLeaderBonusShortLabel = $state(getInitialI18nText("eventLeaderBonusShortLabel"));
  let eventCardIdLabel = $state(getInitialI18nText("eventCardIdLabel"));
  let eventCardImageAltSuffix = $state(getInitialI18nText("eventCardImageAltSuffix"));
  let eventMusicJacketAltSuffix = $state(getInitialI18nText("eventMusicJacketAltSuffix"));
  let eventMasterRankLabel = $state(getInitialI18nText("eventMasterRankLabel"));
  let eventCardAttrAnyLabel = $state(getInitialI18nText("eventCardAttrAnyLabel"));
  let eventBonusRateLabel = $state(getInitialI18nText("eventBonusRateLabel"));
  let eventMusicsLabel = $state(getInitialI18nText("eventMusicsLabel"));
  let eventRankingRewardsTitle = $state(getInitialI18nText("eventRankingRewardsTitle"));
  let eventRankingRewardTopLabel = $state(getInitialI18nText("eventRankingRewardTopLabel"));
  let eventRankingRewardBorderLabel = $state(getInitialI18nText("eventRankingRewardBorderLabel"));
  let eventRankingRewardsShowMoreLabel = $state(
    getInitialI18nText("eventRankingRewardsShowMoreLabel")
  );
  let eventRankingRewardsShowLessLabel = $state(
    getInitialI18nText("eventRankingRewardsShowLessLabel")
  );
  let rankingRewardsLoadingLabel = $state(getInitialI18nText("rankingRewardsLoadingLabel"));
  let rankingRewardsLoadErrorLabel = $state(getInitialI18nText("rankingRewardsLoadErrorLabel"));
  let eventVirtualLiveTitle = $state(getInitialI18nText("eventVirtualLiveTitle"));
  let eventNoDataLabel = $state(getInitialI18nText("eventNoDataLabel"));

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
    eventListTitle = translate("navigation.events");
    startAtLabel = translate("startAt");
    endAtLabel = translate("endAt");
    idLabel = translate("idLabel");
    nameLabel = translate("nameLabel");
    unitLabel = translate("unitLabel");
    mixedUnitLabel = translate("mixedUnitLabel");
    eventTypeLabel = translate("eventTypeLabel");
    eventBgmTitle = translate("eventBgmTitle");
    audioPlayLabel = translate("audioPlayLabel");
    audioPauseLabel = translate("audioPauseLabel");
    audioDownloadLabel = translate("audioDownloadLabel");
    audioVolumeLabel = translate("audioVolumeLabel");
    audioSeekLabel = translate("audioSeekLabel");
    audioUnavailableLabel = translate("audioUnavailableLabel");
    audioDownloadStagePreparingLabel = translate("audioDownloadStages.preparing");
    audioDownloadStageFetchingAudioLabel = translate("audioDownloadStages.fetchingAudio");
    audioDownloadStageFetchingCoverLabel = translate("audioDownloadStages.fetchingCover");
    audioDownloadStageWritingMetadataLabel = translate("audioDownloadStages.writingMetadata");
    audioDownloadStageFinalizingLabel = translate("audioDownloadStages.finalizing");
    audioDownloadStageReadyLabel = translate("audioDownloadStages.ready");
    audioDownloadStageFailedLabel = translate("audioDownloadStages.failed");
    audioDownloadStageCancelledLabel = translate("audioDownloadStages.cancelled");
    audioDownloadCloseLabel = translate("audioDownloadCloseLabel");
    bannerAltSuffix = translate("bannerAltSuffix");
    imageUnavailableLabel = translate("imageUnavailable");
    noEventLabel = translate("noCurrentEventData");
    eventTrackerLabel = translate("eventTrackerLink");
    eventTitlePrefix = translate("pageTitle.eventPrefix");
    bannerTabLabel = translate("assetTab.banner");
    titleTabLabel = translate("eventAssetTabs.title");
    backgroundTabLabel = translate("assetTab.background");
    charactersTabLabel = translate("eventAssetTabs.characters");
    eventInfoTitle = translate("eventInfoTitle");
    eventCountdownTitle = translate("eventCountdownTitle");
    debugEventJsonButtonLabel = translate("debugJsonButton");
    debugEventJsonTitle = translate("debugEventJsonTitle");
    closeLabel = translate("closeLabel");
    detailLoadingLabel = translate("detailLoading");
    bannerCharacterLabel = translate("bannerCharacterLabel");
    internalResourceCodeLabel = translate("internalResourceCodeLabel");
    eventBonusCharacterLabel = translate("eventBonusCharacterLabel");
    eventAnyCharacterLabel = translate("eventAnyCharacterLabel");
    eventRarityBonusLabel = translate("eventRarityBonusLabel");
    eventRarityLabel = translate("rarityLabel");
    eventFeaturedCardsTitle = translate("eventFeaturedCardsTitle");
    eventFeaturedCardBonusLabel = translate("eventFeaturedCardBonusLabel");
    eventFeaturedCardBonusShortLabel = translate("eventFeaturedCardBonusShortLabel");
    eventLeaderBonusLabel = translate("eventLeaderBonusLabel");
    eventLeaderBonusShortLabel = translate("eventLeaderBonusShortLabel");
    eventCardIdLabel = translate("eventCardIdLabel");
    eventCardImageAltSuffix = translate("eventCardImageAltSuffix");
    eventMusicJacketAltSuffix = translate("eventMusicJacketAltSuffix");
    eventMasterRankLabel = translate("eventMasterRankLabel");
    eventCardAttrAnyLabel = translate("eventCardAttrAnyLabel");
    eventBonusRateLabel = translate("eventBonusRateLabel");
    eventMusicsLabel = translate("eventMusicsLabel");
    eventRankingRewardsTitle = translate("eventRankingRewardsTitle");
    eventRankingRewardTopLabel = translate("eventRankingRewardTopLabel");
    eventRankingRewardBorderLabel = translate("eventRankingRewardBorderLabel");
    eventRankingRewardsShowMoreLabel = translate("eventRankingRewardsShowMoreLabel");
    eventRankingRewardsShowLessLabel = translate("eventRankingRewardsShowLessLabel");
    rankingRewardsLoadingLabel = translate("rankingRewardsLoadingLabel");
    rankingRewardsLoadErrorLabel = translate("rankingRewardsLoadErrorLabel");
    eventVirtualLiveTitle = translate("eventVirtualLiveTitle");
    eventNoDataLabel = translate("eventNoDataLabel");
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
    applyTranslations(createI18nTranslator(locale, messages));
    currentMessages = messages;
  };

  const openDebugDialog = (): void => {
    debugDialog?.showModal();
  };

  const regionDisplayOrder: SupportedRegion[] = ["jp", "en", "tw", "kr", "cn"];
  const getRegionOptions = (availableRegions: SupportedRegion[]): SupportedRegion[] =>
    regionDisplayOrder.filter(
      (regionOption) => availableRegions.includes(regionOption) || regionOption === data.region
    );
  const hasAlternativeRegion = (availableRegions: SupportedRegion[]): boolean =>
    availableRegions.some((regionOption) => regionOption !== data.region);
  const getUnavailableError = (availableRegions: SupportedRegion[]): string =>
    hasAlternativeRegion(availableRegions)
      ? data.eventUnavailableInCurrentRegionMessage
      : data.failedToLoadEventDataMessage;
  const getEventBgmDownloadHref = (format: "mp3" | "wav"): string =>
    `${resolve("/event/[region]/[id]/bgm", { region: data.region, id: data.eventId })}?format=${encodeURIComponent(format)}`;
  const getEventBgmProgressHref = (): string =>
    resolve("/event/[region]/[id]/bgm/progress", { region: data.region, id: data.eventId });
  const getEventListHref = (): string => resolve("/events/[region]", { region: data.region });
  const eventTrackerHref = $derived(getEventTrackerHref(data.region, data.eventId));
  const getEventBreadcrumbItems = (currentLabel: string) => [
    {
      label: homeLabel,
      href: resolve("/")
    },
    {
      label: eventListTitle,
      href: getEventListHref()
    },
    {
      label: currentLabel
    }
  ];
  const getRegionBadgeOptions = (regionOptions: SupportedRegion[]): RegionBadgeOption[] =>
    regionOptions.map((regionOption) =>
      regionOption === data.region
        ? {
            key: regionOption,
            label: regionOption.toUpperCase(),
            active: true
          }
        : {
            key: regionOption,
            label: regionOption.toUpperCase(),
            href: resolve("/event/[region]/[id]", { region: regionOption, id: data.eventId }),
            active: false
          }
    );
  const getCurrentRegionBadgeOption = (): RegionBadgeOption[] => [
    {
      key: data.region,
      label: data.region.toUpperCase(),
      active: true
    }
  ];
  const getDisplayUnitName = (
    unitProfiles: Record<string, string>,
    unit: string | null | undefined
  ): string | null => {
    if (!unit) {
      return null;
    }

    const normalizedUnit = unit.trim().toLowerCase();
    return normalizedUnit === "none" || normalizedUnit === "-"
      ? mixedUnitLabel
      : (unitProfiles[normalizedUnit] ?? formatUnitFallbackLabel(normalizedUnit));
  };
</script>

<svelte:head>
  {#if data.seo}
    <DiscordEmbedHead seo={data.seo} />
  {:else}
    {#await data.eventPayload}
      <title>{createPageTitle(`${eventTitlePrefix} ${data.eventId}`)}</title>
    {:then payload}
      <title
        >{payload.event
          ? createPageTitle(payload.event.title, currentTranslate("navigation.events"))
          : createPageTitle(`${eventTitlePrefix} ${data.eventId}`)}</title
      >
    {/await}
  {/if}
</svelte:head>

<section use:swipeRegion class="content-page-shell gap-5 px-2 pb-6 sm:px-4">
  {#await data.eventPayload}
    <PageHeader
      breadcrumbs={getEventBreadcrumbItems(`${eventTitlePrefix} ${data.eventId}`)}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        <RegionBadgeSwitch options={getCurrentRegionBadgeOption()} />
      {/snippet}
    </PageHeader>

    <DetailPageSkeleton kind="event" />
  {:then payload}
    <PageHeader
      breadcrumbs={getEventBreadcrumbItems(
        payload.event?.title ?? `${eventTitlePrefix} ${data.eventId}`
      )}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        {#if dev && payload.debugEventJson}
          <button type="button" class="btn btn-outline btn-sm" onclick={openDebugDialog}>
            {debugEventJsonButtonLabel}
          </button>
        {/if}
        {#await data.availableRegions then availableRegions}
          <RegionBadgeSwitch options={getRegionBadgeOptions(getRegionOptions(availableRegions))} />
        {/await}
      {/snippet}
    </PageHeader>

    {#if payload.error}
      <div class="alert alert-error">{payload.error}</div>
    {/if}

    {#if payload.event}
      <div
        class="grid grid-cols-1 gap-5 md:grid-cols-[minmax(17rem,30%)_minmax(0,1fr)] md:items-start xl:grid-cols-[minmax(19rem,28%)_minmax(0,1fr)]"
      >
        <aside class="flex flex-col gap-4">
          <EventDetailAssetCard
            event={payload.event}
            region={data.region}
            bind:activeTab={activeAssetTab}
            bannerLabel={bannerTabLabel}
            titleLabel={titleTabLabel}
            backgroundLabel={backgroundTabLabel}
            charactersLabel={charactersTabLabel}
            {bannerAltSuffix}
            {imageUnavailableLabel}
            {closeLabel}
          />

          {#await data.unitProfiles}
            <div
              class="card content-card-shell animate-pulse shadow-sm motion-reduce:animate-none"
              role="status"
              aria-busy="true"
              aria-label={detailLoadingLabel}
            >
              <div class="card-body gap-4 p-3 sm:p-5">
                <div class="h-4 w-2/5 rounded bg-base-300"></div>
                <div class="space-y-2">
                  <div class="h-12 rounded-xl bg-base-300"></div>
                  <div class="h-12 rounded-xl bg-base-300"></div>
                  <div class="h-12 rounded-xl bg-base-300"></div>
                  <div class="h-12 rounded-xl bg-base-300"></div>
                </div>
              </div>
            </div>
          {:then unitProfiles}
            <EventDetailInfoCard
              translate={currentTranslate}
              event={payload.event}
              region={data.region}
              {displayLocale}
              title={eventInfoTitle}
              {idLabel}
              {internalResourceCodeLabel}
              {nameLabel}
              {unitLabel}
              {mixedUnitLabel}
              {unitProfiles}
              {eventTypeLabel}
              {startAtLabel}
              {endAtLabel}
              {bannerCharacterLabel}
              {eventTrackerHref}
              {eventTrackerLabel}
            />
          {/await}

          {#await data.isCurrentEvent}
            <div
              class="card content-card-shell animate-pulse shadow-sm motion-reduce:animate-none"
              role="status"
              aria-busy="true"
              aria-label={detailLoadingLabel}
            >
              <div class="card-body gap-4 p-3 sm:p-5">
                <div class="h-4 w-2/5 rounded bg-base-300"></div>
                <div class="h-20 rounded-xl bg-base-300"></div>
              </div>
            </div>
          {:then isCurrentEvent}
            <EventDetailCountdownCard
              messages={currentMessages}
              event={payload.event}
              {isCurrentEvent}
              uiLocale={data.uiLocale}
              title={eventCountdownTitle}
            />
          {/await}
        </aside>

        <div class="flex min-w-0 flex-col gap-5">
          {#await data.unitProfiles}
            <div
              class="card content-card-shell animate-pulse shadow-sm motion-reduce:animate-none"
              role="status"
              aria-busy="true"
              aria-label={detailLoadingLabel}
            >
              <div class="card-body gap-4 p-3 sm:p-5">
                <div class="h-4 w-2/5 rounded bg-base-300"></div>
                <div class="h-24 rounded-[1.75rem] bg-base-300 sm:h-28"></div>
              </div>
            </div>
          {:then unitProfiles}
            <EventDetailBgmCard
              event={payload.event}
              region={data.region}
              title={eventBgmTitle}
              unitName={getDisplayUnitName(unitProfiles, payload.event.unit) ?? ""}
              bgmDownloadHref={getEventBgmDownloadHref}
              bgmProgressHref={getEventBgmProgressHref()}
              downloadProgressMessages={{
                preparing: audioDownloadStagePreparingLabel,
                fetchingAudio: audioDownloadStageFetchingAudioLabel,
                fetchingCover: audioDownloadStageFetchingCoverLabel,
                writingMetadata: audioDownloadStageWritingMetadataLabel,
                finalizing: audioDownloadStageFinalizingLabel,
                ready: audioDownloadStageReadyLabel,
                failed: audioDownloadStageFailedLabel,
                cancelled: audioDownloadStageCancelledLabel
              }}
              playLabel={audioPlayLabel}
              pauseLabel={audioPauseLabel}
              downloadLabel={audioDownloadLabel}
              downloadCloseLabel={audioDownloadCloseLabel}
              volumeLabel={audioVolumeLabel}
              seekLabel={audioSeekLabel}
              unavailableLabel={audioUnavailableLabel}
            />
          {/await}

          <EventDetailDataCard
            event={payload.event}
            region={data.region}
            relatedData={payload.relatedData}
            {displayLocale}
            bonusCharacterLabel={eventBonusCharacterLabel}
            anyCharacterLabel={eventAnyCharacterLabel}
            rarityBonusLabel={eventRarityBonusLabel}
            rarityLabel={eventRarityLabel}
            featuredCardsTitle={eventFeaturedCardsTitle}
            featuredCardBonusLabel={eventFeaturedCardBonusLabel}
            featuredCardBonusShortLabel={eventFeaturedCardBonusShortLabel}
            leaderBonusLabel={eventLeaderBonusLabel}
            leaderBonusShortLabel={eventLeaderBonusShortLabel}
            cardIdLabel={eventCardIdLabel}
            {imageUnavailableLabel}
            cardImageAltSuffix={eventCardImageAltSuffix}
            musicJacketAltSuffix={eventMusicJacketAltSuffix}
            masterRankLabel={eventMasterRankLabel}
            cardAttrAnyLabel={eventCardAttrAnyLabel}
            bonusRateLabel={eventBonusRateLabel}
            {eventMusicsLabel}
            rankingRewardsTitle={eventRankingRewardsTitle}
            honorBonusesTitle={currentTranslate("eventHonorBonusesTitle")}
            honorBonusesLoadFailed={payload.relatedData?.honorBonusesLoadFailed ?? false}
            honorBonusesUnavailableLabel={currentTranslate("eventHonorBonusesUnavailable")}
            honorBonusHonorLabel={currentTranslate("eventHonorBonusHonorLabel")}
            honorRewardLabel={currentTranslate("eventHonorRewardLabel")}
            bondsHonorRewardLabel={currentTranslate("eventBondsHonorRewardLabel")}
            rankingRewardTopLabel={eventRankingRewardTopLabel}
            rankingRewardBorderLabel={eventRankingRewardBorderLabel}
            rankingRewardsShowMoreLabel={eventRankingRewardsShowMoreLabel}
            rankingRewardsShowLessLabel={eventRankingRewardsShowLessLabel}
            virtualLiveTitle={eventVirtualLiveTitle}
            noDataLabel={eventNoDataLabel}
            {rankingRewardsLoadingLabel}
            {rankingRewardsLoadErrorLabel}
          />
        </div>
      </div>
    {:else if !payload.error}
      {#await data.availableRegions}
        <div class="alert">
          <span class="loading loading-spinner loading-sm"></span>
          {noEventLabel}
        </div>
      {:then availableRegions}
        <div class="alert alert-error">{getUnavailableError(availableRegions)}</div>
      {/await}
    {/if}

    {#if dev && payload.debugEventJson}
      <EventDebugDialog
        bind:dialog={debugDialog}
        title={debugEventJsonTitle}
        {closeLabel}
        json={payload.debugEventJson}
      />
    {/if}
  {/await}
</section>
