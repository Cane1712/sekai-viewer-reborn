<script lang="ts">
  import { env } from "$env/dynamic/public";
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import { onMount, tick } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import {
    createI18nTranslator,
    getLocalI18nMessages,
    resolveStreamingMessages
  } from "$lib/i18n/runtime";
  import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";
  import {
    DEFAULT_REGION,
    normalizeRegion,
    PREFERRED_REGION_CHANGE_EVENT,
    PREFERRED_REGION_STORAGE_KEY,
    persistPreferredRegion,
    resolvePreferredRegion
  } from "$lib/i18n/region";
  import {
    getMusicJacketAssetURL,
    getGachaBannerAssetURL,
    getGachaLogoAssetURL
  } from "$lib/assets";
  import { trackPromise } from "$lib/promise-cache";
  import { getCardThumbnailPresentation } from "$lib/components/card/card-presentation";
  import { openGameNewsTarget } from "$lib/game-news-navigation";
  import CurrentEventCard from "$lib/components/event/CurrentEventCard.svelte";
  import RegionBadgeSwitch from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import ViewAllLink from "$lib/components/shared/ViewAllLink.svelte";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import { CardThumbnail } from "@platform/ui-shell";
  import { toTimestampMs } from "$lib/time/date-time";
  import type { GameNewsItem, GameNewsLoadResult } from "$lib/server/game-news";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import type { HomeRegionData } from "$lib/server/home-page-data";
  import {
    EVENT_CARD_BANNER_BODY_CLASS,
    EVENT_CARD_EMPTY_BODY_CLASS,
    EVENT_CARD_MEDIA_CLASS,
    EVENT_CARD_SURFACE_CLASS
  } from "$lib/styles/event-card";
  import type { PageData } from "./$types";

  const HOME_I18N_NAMESPACES = ["common", "home", "event", "error"] as const;

  let { data }: { data: PageData } = $props();
  const supportPageUrl = env.PUBLIC_SUPPORT_PAGE_URL?.trim() || resolve("/support");
  const mergeHomeMessages = (messages: Record<string, string>): Record<string, string> => ({
    ...getLocalI18nMessages(HOME_I18N_NAMESPACES),
    ...messages
  });
  const getInitialMessages = (): Record<string, string> =>
    mergeHomeMessages(resolveStreamingMessages(data.i18nMessages, HOME_I18N_NAMESPACES));
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, getInitialMessages())(key);
  let idLabel = $state(getInitialI18nText("idLabel"));
  let bannerAltSuffix = $state(getInitialI18nText("bannerAltSuffix"));
  let latestDataLoadingEvents = $state(getInitialI18nText("latestData.loadingEvents"));
  let latestDataLoading = $state(getInitialI18nText("latestData.loading"));
  let noEventLabel = $state(getInitialI18nText("noCurrentEventData"));
  let eventTrackerLabel = $state(getInitialI18nText("eventTrackerLink"));
  let disclaimerText = $state(getInitialI18nText("disclaimer"));
  let mixedUnitLabel = $state(getInitialI18nText("mixedUnitLabel"));
  let footerBrandLabel = $state(getInitialI18nText("footer.brand"));
  let footerDescription = $state(getInitialI18nText("footer.description"));
  let versionInfoTitle = $state(getInitialI18nText("versionInfo.title"));
  let versionAppLabel = $state(getInitialI18nText("versionInfo.appLabel"));
  let versionDataLabel = $state(getInitialI18nText("versionInfo.dataLabel"));
  let versionAssetLabel = $state(getInitialI18nText("versionInfo.assetLabel"));
  let latestDataTitle = $state(getInitialI18nText("latestData.title"));
  let latestDataCardsLabel = $state(getInitialI18nText("navigation.cards"));
  let latestDataMusicsLabel = $state(getInitialI18nText("navigation.songs"));
  let latestDataGachasLabel = $state(getInitialI18nText("navigation.gachas"));
  let latestDataEventsLabel = $state(getInitialI18nText("navigation.events"));
  let latestDataNoData = $state(getInitialI18nText("latestData.noData"));
  let latestDataViewAll = $state(getInitialI18nText("latestData.viewAll"));
  let latestDataLoadFailed = $state(getInitialI18nText("latestData.loadFailed"));
  let homeNewsTitle = $state(getInitialI18nText("homeNews.title"));
  let latestDataViewAllSection = $state(getInitialI18nText("latestData.viewAllSection"));
  let homeNewsLoading = $state(getInitialI18nText("homeNews.loading"));
  let homeNewsEmpty = $state(getInitialI18nText("homeNews.empty"));
  let homeNewsUnavailable = $state(getInitialI18nText("homeNews.unavailable"));
  let homeNewsError = $state(getInitialI18nText("homeNews.error"));
  let homeNewsDateUnavailable = $state(getInitialI18nText("homeNews.dateUnavailable"));
  let directoryTitle = $state(getInitialI18nText("directory.title"));
  let directoryDescription = $state(getInitialI18nText("directory.description"));
  let gameContentRegionLabel = $state(getInitialI18nText("settings.gameContentRegion"));
  let gameContentRegionDescription = $state(
    getInitialI18nText("settings.gameContentRegionDescription")
  );
  let translationRequestId = 0;
  let currentMessages = $state<Record<string, string>>(getInitialMessages());
  let currentTranslate = $derived(createI18nTranslator(data.uiLocale, currentMessages));
  let iframeDialog = $state<HTMLDialogElement | null>(null);
  let iframeUrl = $state<string | null>(null);

  // ── Region state ───────────────────────────────────────────────────
  // Every section header shares the visible "View all"; the name says which.
  const viewAllSectionLabel = (section: string): string =>
    latestDataViewAllSection.replace("{section}", section);
  const getInitialSelectedRegion = (): SupportedRegion => data.initialRegion;
  let selectedRegion = $state<SupportedRegion>(getInitialSelectedRegion());
  const loadedRegionData = $state<Partial<Record<SupportedRegion, HomeRegionData>>>({});
  const regionDataPromises = $state<Partial<Record<SupportedRegion, Promise<HomeRegionData>>>>({});
  const regionDataAbortControllers = new SvelteMap<SupportedRegion, AbortController>();
  const regionDataErrors = new SvelteMap<SupportedRegion, unknown>();
  const pendingRegionData = new Promise<HomeRegionData>(() => {});
  function getInitialRegionData(): Promise<HomeRegionData> {
    return Promise.all([data.initialCard, data.initialLatestData, data.initialNews]).then(
      ([card, latestData, news]) =>
        ({
          region: data.initialRegion,
          card,
          latestData,
          news
        }) satisfies HomeRegionData
    );
  }

  const initialRegionData = getInitialRegionData();

  const selectRegion = (r: SupportedRegion): void => {
    persistPreferredRegion(r);
  };

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  const isHomeRegionData = (value: unknown, region: SupportedRegion): value is HomeRegionData => {
    if (!isRecord(value) || value.region !== region) {
      return false;
    }

    const card = value.card;
    const latestData = value.latestData;
    return (
      isRecord(card) &&
      isRecord(latestData) &&
      Array.isArray(latestData.cards) &&
      Array.isArray(latestData.musics) &&
      Array.isArray(latestData.gachas) &&
      isRecord(value.news)
    );
  };

  async function fetchHomeRegionData(
    region: SupportedRegion,
    signal: AbortSignal
  ): Promise<HomeRegionData> {
    const response = await globalThis.fetch(`/api/home/${encodeURIComponent(region)}`, { signal });
    if (!response.ok) {
      throw new Error(`Failed to load homepage data for ${region}.`);
    }

    const payload: unknown = await response.json();
    if (!isHomeRegionData(payload, region)) {
      throw new Error(`Homepage data for ${region} was malformed.`);
    }

    return payload;
  }

  function ensureRegionData(region: SupportedRegion): Promise<HomeRegionData> {
    if (region === data.initialRegion) {
      return initialRegionData;
    }

    const loaded = loadedRegionData[region];
    if (loaded) {
      return Promise.resolve(loaded);
    }

    const pending = regionDataPromises[region];
    if (pending) {
      return pending;
    }

    regionDataErrors.delete(region);
    const controller = new AbortController();
    regionDataAbortControllers.set(region, controller);
    const request = fetchHomeRegionData(region, controller.signal)
      .then((regionData) => {
        loadedRegionData[region] = regionData;
        return regionData;
      })
      .catch((error: unknown) => {
        regionDataErrors.set(region, error);
        throw error;
      })
      .finally(() => {
        if (regionDataAbortControllers.get(region) === controller) {
          regionDataAbortControllers.delete(region);
        }
      });
    return trackPromise(regionDataPromises, region, request);
  }

  const updateSelectedRegion = (region: SupportedRegion): void => {
    if (region === selectedRegion) {
      return;
    }

    void ensureRegionData(region).catch(() => {});
    selectedRegion = region;
  };

  onMount(() => {
    updateSelectedRegion(resolvePreferredRegion());

    const handlePreferredRegionChange = (event: Event): void => {
      updateSelectedRegion(
        normalizeRegion((event as CustomEvent<SupportedRegion>).detail, DEFAULT_REGION)
      );
    };
    const handlePreferredRegionStorageChange = (event: StorageEvent): void => {
      if (event.key === PREFERRED_REGION_STORAGE_KEY) {
        updateSelectedRegion(normalizeRegion(event.newValue, DEFAULT_REGION));
      }
    };
    window.addEventListener(PREFERRED_REGION_CHANGE_EVENT, handlePreferredRegionChange);
    window.addEventListener("storage", handlePreferredRegionStorageChange);

    return () => {
      window.removeEventListener(PREFERRED_REGION_CHANGE_EVENT, handlePreferredRegionChange);
      window.removeEventListener("storage", handlePreferredRegionStorageChange);
      for (const controller of regionDataAbortControllers.values()) {
        controller.abort();
      }
      regionDataAbortControllers.clear();
    };
  });

  // ── i18n ───────────────────────────────────────────────────────────
  $effect(() => {
    const requestId = ++translationRequestId;
    const messagesOrPromise = data.i18nMessages;
    void refreshPageTranslations(data.uiLocale, messagesOrPromise, requestId);
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    idLabel = translate("idLabel");
    bannerAltSuffix = translate("bannerAltSuffix");
    latestDataLoadingEvents = translate("latestData.loadingEvents");
    latestDataLoading = translate("latestData.loading");
    noEventLabel = translate("noCurrentEventData");
    eventTrackerLabel = translate("eventTrackerLink");
    disclaimerText = translate("disclaimer");
    mixedUnitLabel = translate("mixedUnitLabel");
    footerBrandLabel = translate("footer.brand");
    footerDescription = translate("footer.description");
    versionInfoTitle = translate("versionInfo.title");
    versionAppLabel = translate("versionInfo.appLabel");
    versionDataLabel = translate("versionInfo.dataLabel");
    versionAssetLabel = translate("versionInfo.assetLabel");
    latestDataTitle = translate("latestData.title");
    latestDataCardsLabel = translate("navigation.cards");
    latestDataMusicsLabel = translate("navigation.songs");
    latestDataGachasLabel = translate("navigation.gachas");
    latestDataEventsLabel = translate("navigation.events");
    latestDataNoData = translate("latestData.noData");
    latestDataViewAll = translate("latestData.viewAll");
    latestDataLoadFailed = translate("latestData.loadFailed");
    homeNewsTitle = translate("homeNews.title");
    latestDataViewAllSection = translate("latestData.viewAllSection");
    homeNewsLoading = translate("homeNews.loading");
    homeNewsEmpty = translate("homeNews.empty");
    homeNewsUnavailable = translate("homeNews.unavailable");
    homeNewsError = translate("homeNews.error");
    homeNewsDateUnavailable = translate("homeNews.dateUnavailable");
    directoryTitle = translate("directory.title");
    directoryDescription = translate("directory.description");
    gameContentRegionLabel = translate("settings.gameContentRegion");
    gameContentRegionDescription = translate("settings.gameContentRegionDescription");
  };

  const refreshPageTranslations = async (
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

    const resolvedMessages = mergeHomeMessages(messages);
    applyTranslations(createI18nTranslator(localeValue, resolvedMessages));
    currentMessages = resolvedMessages;
  };

  // ── Helpers ────────────────────────────────────────────────────────
  const isNuverseRegion = (region: SupportedRegion): boolean =>
    region === "tw" || region === "kr" || region === "cn";

  const getDisplayAssetVersion = (
    region: SupportedRegion,
    versions: { assetVersion: string | null; cdnVersion?: string | null } | null | undefined
  ): string | null => {
    if (!versions?.assetVersion) {
      return null;
    }

    if (isNuverseRegion(region) && versions.cdnVersion) {
      return `${versions.assetVersion} - ${versions.cdnVersion}`;
    }

    return versions.assetVersion;
  };

  const getDisplayDataVersion = (
    versions: { dataVersion: string | null } | null | undefined
  ): string | null => {
    return versions?.dataVersion ?? null;
  };

  const openInternal = (url: string): void => {
    iframeUrl = url;
    void tick().then(() => {
      if (iframeUrl === url && iframeDialog && !iframeDialog.open) iframeDialog.showModal();
    });
  };

  const openNewsTarget = (target: GameNewsItem["target"]): void => {
    openGameNewsTarget(target, openInternal);
  };

  // ── Derived data for selected region ───────────────────────────────
  const selectedRegionDataPromise = $derived.by(() => {
    if (selectedRegion === data.initialRegion) {
      return initialRegionData;
    }

    const loaded = loadedRegionData[selectedRegion];
    if (loaded) {
      return Promise.resolve(loaded);
    }

    if (regionDataErrors.has(selectedRegion)) {
      return Promise.reject(regionDataErrors.get(selectedRegion));
    }

    return regionDataPromises[selectedRegion] ?? pendingRegionData;
  });
  const latestDataPromise = $derived.by(() =>
    selectedRegion === data.initialRegion
      ? data.initialLatestData
      : selectedRegionDataPromise.then((regionData) => regionData.latestData)
  );
  const newsPromise = $derived.by(() =>
    selectedRegion === data.initialRegion
      ? data.initialNews
      : selectedRegionDataPromise.then((regionData) => regionData.news)
  );
  const currentEventPromise = $derived.by(() =>
    selectedRegion === data.initialRegion
      ? data.initialCard
      : selectedRegionDataPromise.then((regionData) => regionData.card)
  );
  const directoryItems = $derived([
    {
      key: "characters",
      navigationKey: "navigation.characters",
      href: `/characters/${selectedRegion}`,
      icon: "mdi:account-group"
    },
    {
      key: "cards",
      navigationKey: "navigation.cards",
      href: `/cards/${selectedRegion}`,
      icon: "mdi:cards-outline"
    },
    {
      key: "musics",
      navigationKey: "navigation.songs",
      href: `/musics/${selectedRegion}`,
      icon: "mdi:music-note-outline"
    },
    {
      key: "events",
      navigationKey: "navigation.events",
      href: `/events/${selectedRegion}`,
      icon: "mdi:calendar-star"
    },
    {
      key: "gachas",
      navigationKey: "navigation.gachas",
      href: `/gachas/${selectedRegion}`,
      icon: "mdi:gift-outline"
    },
    {
      key: "virtualLives",
      navigationKey: "navigation.virtualLives",
      href: `/virtual-lives/${selectedRegion}`,
      icon: "mdi:account-voice"
    }
  ]);
  const formatNewsDate = (value: number | null): string => {
    const timestamp = toTimestampMs(value);
    return timestamp === null
      ? homeNewsDateUnavailable
      : new Intl.DateTimeFormat(data.uiLocale, { dateStyle: "medium" }).format(timestamp);
  };
  const visibleNews = (result: GameNewsLoadResult): GameNewsItem[] =>
    result.status === "ready"
      ? result.items
          .filter(
            (item) => getContentDisplaySettings().showSpoilerContent || item.startAt <= Date.now()
          )
          .sort((a, b) => b.startAt - a.startAt)
          .slice(0, 3)
      : [];
</script>

<!-- ──── Region-switchable data area ────────────────────────────────── -->
<section role="group" use:swipeRegion>
  <section
    class="mx-auto mb-6 rounded-2xl border border-(--archive-border-subtle) bg-(--archive-surface-default) px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-5"
    aria-labelledby="content-region-title"
  >
    <div class="min-w-0">
      <h2
        id="content-region-title"
        class="flex items-center gap-2 text-sm font-semibold text-(--archive-text-strong)"
      >
        <Icon icon="mdi:earth" class="size-4 text-primary" aria-hidden="true" />
        {gameContentRegionLabel}
      </h2>
      <p class="mt-1 text-xs/snug text-(--archive-text-muted)">{gameContentRegionDescription}</p>
    </div>
    <div class="mt-3 shrink-0 sm:mt-0">
      <RegionBadgeSwitch
        options={supportedRegions.map((r) =>
          r === selectedRegion
            ? { key: r, label: r.toUpperCase(), active: true }
            : { key: r, label: r.toUpperCase(), active: false, onclick: () => selectRegion(r) }
        )}
      />
    </div>
  </section>

  <section
    class="mx-auto mb-12 [&_.archive-event-banner-details]:border-t-0 [&_.archive-event-banner-details]:pt-2!"
    aria-labelledby="current-event-title"
  >
    <div
      class="mb-4 flex items-center justify-between gap-3 border-b border-(--archive-border-subtle) pb-4 sm:items-end sm:gap-4"
    >
      <div class="flex min-w-0 items-center gap-2">
        <Icon icon="mdi:calendar-star" class="size-4 text-primary" aria-hidden="true" />
        <h2
          id="current-event-title"
          class="text-sm font-semibold tracking-wide text-(--archive-text-muted)"
        >
          {latestDataEventsLabel}
        </h2>
      </div>
      <div class="flex shrink-0 items-center justify-end">
        <ViewAllLink
          href="/events/{selectedRegion}"
          label={latestDataViewAll}
          ariaLabel={viewAllSectionLabel(latestDataEventsLabel)}
        />
      </div>
    </div>
    {#await currentEventPromise}
      <article class={`${EVENT_CARD_SURFACE_CLASS} archive-event-banner w-full`} aria-busy="true">
        <span class="sr-only" role="status" aria-live="polite">{latestDataLoadingEvents}</span>
        <div class={EVENT_CARD_BANNER_BODY_CLASS}>
          <div
            class={`${EVENT_CARD_MEDIA_CLASS} archive-event-banner-media mb-0 animate-pulse bg-base-300/70 p-[5%] lg:mb-0 lg:p-4`}
          ></div>
          <div class="archive-event-banner-details space-y-4 pt-2">
            <div class="h-5 w-28 animate-pulse rounded bg-base-300"></div>
            <div class="h-7 w-4/5 animate-pulse rounded bg-base-300"></div>
            <div class="h-22 animate-pulse rounded-xl bg-base-300"></div>
          </div>
        </div>
      </article>
    {:then card}
      {#if card.event}
        <CurrentEventCard
          {eventTrackerLabel}
          messages={currentMessages}
          translate={currentTranslate}
          region={card.region}
          regionLabel={card.label}
          event={card.event}
          uiLocale={data.uiLocale}
          {idLabel}
          {mixedUnitLabel}
          unitProfiles={card.unitProfiles}
          {bannerAltSuffix}
        />
      {:else}
        <article class={`${EVENT_CARD_SURFACE_CLASS} w-full`}>
          <div class={EVENT_CARD_EMPTY_BODY_CLASS}>
            <div class="flex items-center justify-center text-center">
              {#if card.error}
                <p class="text-sm text-error">{card.error}</p>
              {:else}
                <p class="text-sm opacity-70">{noEventLabel}</p>
              {/if}
            </div>
          </div>
        </article>
      {/if}
    {:catch _}
      <article class={`${EVENT_CARD_SURFACE_CLASS} w-full`}>
        <div class={EVENT_CARD_EMPTY_BODY_CLASS}>
          <div class="flex items-center justify-center text-center">
            <p class="text-sm text-error">{data.currentEventLoadFailedMessage}</p>
          </div>
        </div>
      </article>
    {/await}
  </section>

  <section class="mx-auto mb-12" aria-labelledby="latest-data-title">
    <div class="mb-4 border-b border-(--archive-border-subtle) pb-4">
      <div class="flex items-center gap-2">
        <Icon icon="mdi:clock-outline" class="size-4 text-primary" aria-hidden="true" />
        <h2
          id="latest-data-title"
          class="text-sm font-semibold tracking-wide text-(--archive-text-muted)"
        >
          {latestDataTitle}
        </h2>
      </div>
    </div>
    {#if latestDataPromise}
      {#await latestDataPromise}
        <div
          class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-busy="true"
          aria-label={latestDataLoading}
        >
          <div class="space-y-3">
            <div class="h-5 w-24 animate-pulse rounded bg-base-300"></div>
            <div class="grid grid-cols-3 gap-2 sm:gap-3">
              {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as skeleton (skeleton)}
                <div
                  class="mx-auto aspect-square w-full animate-pulse rounded-xl bg-base-300 sm:w-[94%]"
                ></div>
              {/each}
            </div>
          </div>
          <div class="space-y-3">
            <div class="h-5 w-24 animate-pulse rounded bg-base-300"></div>
            <div class="space-y-3">
              {#each [1, 2, 3] as skeleton (skeleton)}
                <div class="h-20 animate-pulse rounded-xl bg-base-300"></div>
              {/each}
            </div>
          </div>
          <div class="content-card-inset p-3 sm:p-4" aria-hidden="true">
            <div class="mb-3 flex h-6 items-center">
              <div
                class="h-5 w-24 animate-pulse rounded bg-base-300 motion-reduce:animate-none"
              ></div>
            </div>
            <div class="space-y-3">
              {#each [1, 2] as skeleton (skeleton)}
                <div
                  class="overflow-hidden rounded-lg border border-(--archive-border-subtle) bg-(--archive-surface-default) shadow-sm"
                >
                  <div
                    class="aspect-3/1 w-full animate-pulse bg-base-300 pt-2 motion-reduce:animate-none"
                  ></div>
                  <div class="px-3 py-2">
                    <div
                      class="h-5 w-3/4 animate-pulse rounded bg-base-300 motion-reduce:animate-none"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:then regionData}
        {#if regionData.cards.length === 0 && regionData.musics.length === 0 && regionData.gachas.length === 0}
          <p class="text-center text-sm text-base-content/60">{latestDataNoData}</p>
        {:else}
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <!-- Compact visual release records. -->
            <div class="space-y-4 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              <div class="content-card-inset p-3 sm:p-4">
                <h3
                  class="mb-3 flex items-center justify-between text-sm font-semibold text-base-content/70"
                >
                  <span class="flex items-center gap-2">
                    <Icon icon="mdi:cards-outline" class="size-4" aria-hidden="true" />
                    {latestDataCardsLabel}
                  </span>
                  <ViewAllLink
                    href="/cards/{regionData.region}"
                    label={latestDataViewAll}
                    ariaLabel={viewAllSectionLabel(latestDataCardsLabel)}
                  />
                </h3>
                {#if regionData.cards.length > 0}
                  <div class="grid grid-cols-3 gap-2 sm:gap-3">
                    {#each regionData.cards as card (card.id)}
                      <a
                        href="/card/{regionData.region}/{card.id}"
                        class="group block"
                        data-home-card-thumbnail
                      >
                        <CardThumbnail
                          {...getCardThumbnailPresentation(card, regionData.region)}
                          alt={card.prefix ?? card.id}
                          fallbackLabel={card.id}
                          attr={card.attr}
                          rarityType={card.rarityType}
                          rarityCount={card.rarityCount}
                          showFrame={true}
                          showIcons={true}
                          maxSize={null}
                          containerClass="card-hover-lift relative mx-auto aspect-square w-full overflow-hidden rounded-xl bg-(--archive-surface-default) sm:w-[94%]"
                          imageClass="size-full object-cover"
                        />
                      </a>
                    {/each}
                  </div>
                {:else}
                  <p class="text-xs text-base-content/50">{latestDataNoData}</p>
                {/if}
              </div>

              <div class="content-card-inset p-3 sm:p-4">
                <h3
                  class="mb-3 flex items-center justify-between text-sm font-semibold text-base-content/70"
                >
                  <span class="flex items-center gap-2">
                    <Icon icon="mdi:music-note-eighth" class="size-4" aria-hidden="true" />
                    {latestDataMusicsLabel}
                  </span>
                  <ViewAllLink
                    href="/musics/{regionData.region}"
                    label={latestDataViewAll}
                    ariaLabel={viewAllSectionLabel(latestDataMusicsLabel)}
                  />
                </h3>
                {#if regionData.musics.length > 0}
                  <div class="grid gap-2">
                    {#each regionData.musics as music (music.id)}
                      <a
                        href="/music/{regionData.region}/{music.id}"
                        class="group card-hover-lift flex min-w-0 items-center gap-3 rounded-xl border border-(--archive-border-subtle) bg-(--archive-surface-default) p-2 shadow-sm"
                        data-home-music-row
                      >
                        <div
                          class="relative size-20 shrink-0 overflow-hidden rounded-lg bg-base-200/60 sm:size-24"
                        >
                          {#if music.assetBundleName}
                            <AssetImage
                              src={getMusicJacketAssetURL(music.assetBundleName, regionData.region)}
                              alt={music.title ?? music.id}
                              loadMode="visible"
                              imageClass="size-full object-cover"
                              buttonClass="block size-full"
                            />
                          {:else}
                            <div
                              class="flex size-full items-center justify-center bg-base-300/40 text-xs text-base-content/50"
                            >
                              {music.id}
                            </div>
                          {/if}
                        </div>
                        <div class="min-w-0">
                          <p class="line-clamp-2 text-sm/snug font-medium">
                            {music.title ?? music.id}
                          </p>
                          <p class="mt-1 truncate text-[10px] text-base-content/50">
                            {music.composer ?? music.id}
                          </p>
                        </div>
                      </a>
                    {/each}
                  </div>
                {:else}
                  <p class="text-xs text-base-content/50">{latestDataNoData}</p>
                {/if}
              </div>
            </div>

            <div class="content-card-inset p-3 sm:p-4">
              <h3
                class="mb-3 flex items-center justify-between text-sm font-semibold text-base-content/70"
              >
                <span class="flex items-center gap-2">
                  <Icon icon="mdi:gift-outline" class="size-4" aria-hidden="true" />
                  {latestDataGachasLabel}
                </span>
                <ViewAllLink
                  href="/gachas/{regionData.region}"
                  label={latestDataViewAll}
                  ariaLabel={viewAllSectionLabel(latestDataGachasLabel)}
                />
              </h3>
              {#if regionData.gachas.length > 0}
                <ul class="space-y-3">
                  {#each regionData.gachas as gacha (gacha.id)}
                    <li>
                      <a
                        href="/gacha/{regionData.region}/{gacha.id}"
                        class="card-hover-lift block overflow-hidden rounded-lg border border-(--archive-border-subtle) bg-(--archive-surface-default) shadow-sm"
                      >
                        <div class="aspect-3/1 w-full bg-base-100 pt-2">
                          <AssetImage
                            src={getGachaBannerAssetURL(gacha.id, regionData.region)}
                            fallbackSrc={gacha.assetBundleName
                              ? getGachaLogoAssetURL(gacha.assetBundleName, regionData.region)
                              : undefined}
                            alt={gacha.name ?? gacha.id}
                            loadMode="visible"
                            imageClass="size-full object-contain"
                            buttonClass="block size-full"
                          />
                        </div>
                        <div class="px-3 py-2">
                          <p class="truncate text-sm font-medium">{gacha.name ?? gacha.id}</p>
                        </div>
                      </a>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="text-xs text-base-content/50">{latestDataNoData}</p>
              {/if}
            </div>
          </div>
        {/if}
      {:catch _}
        <p class="text-center text-sm text-error">{latestDataLoadFailed}</p>
      {/await}
    {/if}
  </section>

  {#snippet newsCardContent(item: GameNewsItem)}
    <div class="flex items-center justify-between gap-2 text-xs text-(--archive-text-muted)">
      <span class="badge badge-primary badge-outline"
        >{currentTranslate(`gameNews.tags.${item.informationTag}`)}</span
      >
      <time datetime={new Date(item.startAt).toISOString()}>{formatNewsDate(item.startAt)}</time>
    </div>
    <h3 class="mt-3 line-clamp-2 text-base font-semibold text-(--archive-text-strong)">
      {item.title}
    </h3>
  {/snippet}

  <section class="mx-auto mb-12 w-full" aria-labelledby="home-news-title">
    <div
      class="mb-4 flex items-center justify-between gap-3 border-b border-(--archive-border-subtle) pb-4"
    >
      <div class="flex items-center gap-2">
        <Icon icon="mdi:information-outline" class="size-4 text-primary" aria-hidden="true" />
        <h2
          id="home-news-title"
          class="text-sm font-semibold tracking-wide text-(--archive-text-muted)"
        >
          {homeNewsTitle}
        </h2>
      </div>
      <ViewAllLink
        href="/news/{selectedRegion}"
        label={latestDataViewAll}
        ariaLabel={viewAllSectionLabel(homeNewsTitle)}
      />
    </div>
    {#if newsPromise}
      {#await newsPromise}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3" aria-busy="true">
          {#each [1, 2, 3] as skeleton (skeleton)}
            <div class="h-36 animate-pulse rounded-xl bg-base-300" aria-hidden="true"></div>
          {/each}
        </div>
        <span class="sr-only" role="status" aria-live="polite">{homeNewsLoading}</span>
      {:then result}
        {#if result.status === "unavailable"}
          <p
            class="content-card-shell rounded-xl border p-6 text-center text-sm text-base-content/60"
          >
            {homeNewsUnavailable}
          </p>
        {:else if result.status === "error"}
          <p class="content-card-shell rounded-xl border p-6 text-center text-sm text-error">
            {homeNewsError}
          </p>
        {:else if visibleNews(result).length === 0}
          <p
            class="content-card-shell rounded-xl border p-6 text-center text-sm text-base-content/60"
          >
            {homeNewsEmpty}
          </p>
        {:else}
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            {#each visibleNews(result) as item (item.id)}
              {#if item.target.kind === "none"}
                <article
                  class="content-card-shell card-hover-lift flex min-h-36 flex-col rounded-xl border p-4"
                >
                  {@render newsCardContent(item)}
                </article>
              {:else}
                <article
                  class="content-card-shell card-hover-lift flex min-h-36 flex-col rounded-xl border p-4"
                >
                  <div class="flex min-h-0 flex-1 items-start gap-2">
                    <button
                      type="button"
                      class="group flex min-w-0 flex-1 flex-col text-left"
                      aria-label={`${currentTranslate(
                        item.target.kind === "internal"
                          ? "gameNews.openInternal"
                          : "gameNews.openExternal"
                      )}: ${item.title}`}
                      title={currentTranslate(
                        item.target.kind === "internal"
                          ? "gameNews.openInternal"
                          : "gameNews.openExternal"
                      )}
                      onclick={() => openNewsTarget(item.target)}
                    >
                      {@render newsCardContent(item)}
                    </button>
                    <a
                      class="btn btn-square btn-sm btn-ghost min-h-11 min-w-11 shrink-0"
                      href={item.target.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={currentTranslate("gameNews.openExternal")}
                      title={currentTranslate("gameNews.openExternal")}
                    >
                      <Icon icon="mdi:open-in-new" class="size-4" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              {/if}
            {/each}
          </div>
        {/if}
      {:catch _}
        <p class="content-card-shell rounded-xl border p-6 text-center text-sm text-error">
          {homeNewsError}
        </p>
      {/await}
    {:else}
      <p class="content-card-shell rounded-xl border p-6 text-center text-sm text-base-content/60">
        {homeNewsUnavailable}
      </p>
    {/if}
  </section>

  <section class="mx-auto mb-12" aria-labelledby="content-directory-title">
    <div class="mb-4 border-b border-(--archive-border-subtle) pb-4">
      <div class="flex items-center gap-2">
        <Icon icon="mdi:account-group" class="size-4 text-primary" aria-hidden="true" />
        <h2
          id="content-directory-title"
          class="text-sm font-semibold tracking-wide text-(--archive-text-muted)"
        >
          {directoryTitle}
        </h2>
      </div>
      <p class="mt-2 max-w-2xl text-sm/6 text-(--archive-text-muted)">{directoryDescription}</p>
    </div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each directoryItems as item (item.key)}
        <a
          href={item.href}
          class="group card-hover-lift content-card-shell flex min-h-28 items-start gap-4 rounded-xl p-4 transition-[border-color] duration-200 hover:border-primary/35 sm:p-5"
        >
          <span
            class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-content"
            ><Icon icon={item.icon} class="size-6" aria-hidden="true" /></span
          >
          <span class="min-w-0 flex-1"
            ><span class="flex items-center justify-between gap-3 text-base font-semibold"
              ><span>{currentTranslate(item.navigationKey)}</span><Icon
                icon="mdi:arrow-right"
                class="size-4 shrink-0 text-base-content/35 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary"
                aria-hidden="true"
              /></span
            ><span class="mt-1.5 block text-sm/5 text-base-content/60"
              >{currentTranslate(`directory.${item.key}.description`)}</span
            ></span
          >
        </a>
      {/each}
    </div>
  </section>
</section>
<div class="mx-auto mb-12 flex w-full justify-end">
  <a class="btn btn-ghost btn-sm min-h-11" href={supportPageUrl}>
    {currentTranslate("support.cta")}
  </a>
</div>

<!-- ──── Version Info (standalone, below data area) ─────────────────── -->
<section class="mx-auto mt-12" aria-labelledby="version-information-title">
  <div class="mb-4 border-b border-(--archive-border-subtle) pb-4">
    <div class="flex items-center gap-2">
      <Icon icon="mdi:earth" class="size-4 text-primary" aria-hidden="true" />
      <h2
        id="version-information-title"
        class="text-sm font-semibold tracking-wide text-(--archive-text-muted)"
      >
        {versionInfoTitle}
      </h2>
    </div>
  </div>
  <div class="content-card-shell overflow-x-auto rounded-xl">
    <table class="table table-sm w-full">
      <thead>
        <tr class="text-xs uppercase tracking-wider text-base-content/50">
          <th></th>
          <th>{versionAppLabel}</th>
          <th>{versionDataLabel}</th>
          <th>{versionAssetLabel}</th>
        </tr>
      </thead>
      <tbody>
        {#each supportedRegions as region (region)}
          {@const versions = data.versionsByRegion[region] ?? null}
          <tr>
            <td
              ><span class="badge badge-sm homepage-region-badge version-region-badge font-semibold"
                >{region.toUpperCase()}</span
              ></td
            >
            <td class="font-mono text-xs">{versions?.appVersion ?? "—"}</td>
            <td class="font-mono text-xs">{getDisplayDataVersion(versions) ?? "—"}</td>
            <td class="font-mono text-xs">{getDisplayAssetVersion(region, versions) ?? "—"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<svelte:head>
  <title>Sekai Viewer</title>
</svelte:head>

<footer class="mx-auto mt-12 border-t border-(--archive-border-subtle) px-4 py-7 text-center">
  <p class="text-xs font-semibold tracking-wide text-base-content/55">{footerBrandLabel}</p>
  <p class="mt-1 text-xs text-base-content/45">{footerDescription}</p>
  <p class="mx-auto mt-3 max-w-3xl text-[0.68rem] leading-relaxed text-base-content/35">
    {disclaimerText}
  </p>
</footer>

{#if iframeUrl}
  <dialog
    bind:this={iframeDialog}
    class="modal"
    onclose={() => (iframeUrl = null)}
    onclick={(event) => event.target === iframeDialog && iframeDialog?.close()}
  >
    <div class="modal-box max-w-5xl p-2 sm:p-4">
      <iframe
        title={currentTranslate("gameNews.internalFrameTitle")}
        src={iframeUrl}
        class="h-[75vh] w-full rounded-xl"
        sandbox="allow-scripts allow-forms allow-same-origin"
        referrerpolicy="no-referrer"
      ></iframe>
      <div class="modal-action">
        <button class="btn min-h-11" type="button" onclick={() => iframeDialog?.close()}
          >{currentTranslate("closeLabel")}</button
        >
      </div>
    </div>
  </dialog>
{/if}
