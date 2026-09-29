<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import {
    getCommonMaterialThumbnailURL,
    getGachaTicketThumbnailURL,
    getRemoteAssetEndpointURL,
    getVirtualLiveBannerAssetURL,
    type AssetServer
  } from "$lib/assets/index";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import RewardItem from "$lib/components/shared/RewardItem.svelte";
  import { isTitleReward } from "$lib/domain/reward-item";
  import VirtualLiveScheduleSwitcher from "$lib/components/virtual-live/VirtualLiveScheduleSwitcher.svelte";
  import VirtualLiveCharacterGrid from "$lib/components/virtual-live/VirtualLiveCharacterGrid.svelte";
  import VirtualLiveSetlistSummary from "$lib/components/virtual-live/VirtualLiveSetlistSummary.svelte";
  import VirtualLiveAdditionalData from "$lib/components/virtual-live/VirtualLiveAdditionalData.svelte";
  import EventDebugDialog from "$lib/components/shared/EventDebugDialog.svelte";
  import Icon from "@iconify/svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import DetailPageSkeleton from "$lib/components/shared/DetailPageSkeleton.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type {
    VirtualLiveReward,
    VirtualLiveRewardResourceBoxDetail
  } from "$lib/domain/virtual-live";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { formatDisplayDateTime, toTimestampMs } from "$lib/time/date-time";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import { createPageTitle } from "$lib/page-title";
  import type { PageData } from "./$types";
  import { DETAIL_MEDIA_BUTTON_CLASS, DETAIL_MEDIA_RADIUS_CLASS } from "$lib/styles/detail-media";
  import {
    REWARD_CHIP_CLASS,
    REWARD_CHIP_ICON_CLASS,
    REWARD_CHIP_QUANTITY_CLASS
  } from "$lib/styles/reward-chip";

  let { data }: { data: PageData } = $props();
  const getInitialMessages = (): Record<string, string> =>
    resolveStreamingMessages(data.i18nMessages, ["common", "virtual-live", "music", "error"]);
  let messages = $state<Record<string, string>>(getInitialMessages());
  const initialText = (key: string, fallback?: string): string =>
    createI18nTranslator(data.uiLocale, messages)(key, fallback);
  let translate = $derived(createI18nTranslator(data.uiLocale, messages));
  let translationRequestId = 0;
  let debugDialog = $state<HTMLDialogElement | null>(null);
  let previewOpen = $state(false);
  const previewFormatOptions = ["webp", "png"];

  $effect(() => {
    const requestId = ++translationRequestId;
    if (!browser) return;
    void Promise.resolve(data.i18nMessages)
      .then((next) => {
        if (requestId === translationRequestId) messages = next;
      })
      .catch(() => {});
  });

  const t = (key: string, fallback?: string): string => translate(key, fallback);
  const listHref = (): string => resolve("/virtual-lives/[region]", { region: data.region });
  const breadcrumbs = (label: string) => [
    { label: t("home"), href: resolve("/") },
    { label: t("navigation.virtualLives"), href: listHref() },
    { label }
  ];
  const regionOrder: SupportedRegion[] = ["jp", "en", "tw", "kr", "cn"];
  const regionOptions = (available: SupportedRegion[]): RegionBadgeOption[] =>
    regionOrder
      .filter((region) => available.includes(region) || region === data.region)
      .map((region) =>
        region === data.region
          ? { key: region, label: region.toUpperCase(), active: true }
          : {
              key: region,
              label: region.toUpperCase(),
              href: resolve("/virtual-live/[region]/[id]", { region, id: data.virtualLiveId }),
              active: false
            }
      );
  const currentRegionOption = (): RegionBadgeOption[] => [
    { key: data.region, label: data.region.toUpperCase(), active: true }
  ];
  const unavailableMessage = (available: SupportedRegion[]): string =>
    available.some((region) => region !== data.region)
      ? data.virtualLiveUnavailableInCurrentRegionMessage
      : data.failedToLoadVirtualLiveDataMessage;
  const formatDate = (value: string | number | null): string =>
    formatDisplayDateTime(toTimestampMs(value) ?? value, data.uiLocale);
  const displayValue = (value: string | number | null): string =>
    value === null || value === "" ? t("virtualLiveValueUnavailable") : String(value);
  const typeLabel = (type: string | null): string =>
    type
      ? t(`virtualLiveType.${type}`, type.replaceAll("_", " "))
      : t("virtualLiveValueUnavailable");
  type RewardGroup = {
    virtualLiveType: string | null;
    details: VirtualLiveRewardResourceBoxDetail[];
  };
  const formatNumber = (value: number | null): string | null =>
    value === null ? null : new Intl.NumberFormat(data.uiLocale).format(value);
  const getRewardGroups = (rewards: VirtualLiveReward[]): RewardGroup[] => {
    const groups: RewardGroup[] = [];

    for (const reward of rewards) {
      const details = reward.resourceBox?.details ?? [];
      if (details.length === 0) {
        continue;
      }

      const existingGroup = groups.find((item) => item.virtualLiveType === reward.virtualLiveType);
      if (existingGroup) {
        existingGroup.details.push(...details);
      } else {
        groups.push({ virtualLiveType: reward.virtualLiveType, details: [...details] });
      }
    }

    return groups;
  };
  const getRewardDetailKey = (detail: VirtualLiveRewardResourceBoxDetail, index: number): string =>
    `${index}-${detail.resourceType ?? "resource"}-${detail.resourceId ?? "none"}-${detail.seq ?? "none"}`;
  const getRewardDetailLabel = (detail: VirtualLiveRewardResourceBoxDetail): string => {
    const type = detail.resourceType?.replaceAll("_", " ") ?? t("virtualLiveValueUnavailable");
    const id = detail.resourceId !== null ? ` #${detail.resourceId}` : "";
    const level = detail.resourceLevel !== null ? ` Lv.${formatNumber(detail.resourceLevel)}` : "";
    return `${type}${id}${level}`;
  };
  const getRewardDetailImageSrc = (detail: VirtualLiveRewardResourceBoxDetail): string | null => {
    if (!detail.resourceType) {
      return null;
    }

    const assetRegion = data.region as AssetServer;
    if (detail.resourceType === "material" && detail.resourceId !== null) {
      return getRemoteAssetEndpointURL(
        `thumbnail/material/material${detail.resourceId}.webp`,
        assetRegion
      );
    }

    if (
      ["coin", "ingamevoice", "jewel", "live_point", "slot", "virtual_coin"].includes(
        detail.resourceType
      )
    ) {
      return getCommonMaterialThumbnailURL(detail.resourceType, assetRegion);
    }

    if (detail.resourceType === "paid_jewel") {
      return getCommonMaterialThumbnailURL("jewel", assetRegion);
    }

    if (detail.resourceType === "skill_practice_ticket" && detail.resourceId !== null) {
      return getRemoteAssetEndpointURL(
        `thumbnail/skill_practice_ticket/ticket${detail.resourceId}.webp`,
        assetRegion
      );
    }

    // Ticket thumbnails are named by asset bundle, not by the numeric resourceId.
    if (detail.resourceType === "gacha_ticket") {
      return detail.resourceAssetbundleName
        ? getGachaTicketThumbnailURL(detail.resourceAssetbundleName, assetRegion)
        : null;
    }

    if (detail.resourceType === "boost_item" && detail.resourceId !== null) {
      return getRemoteAssetEndpointURL(
        `thumbnail/boost_item/boost_item${detail.resourceId}.webp`,
        assetRegion
      );
    }

    return null;
  };
  const getRewardDetailFallbackIcon = (detail: VirtualLiveRewardResourceBoxDetail): string => {
    if (detail.resourceType === "stamp") {
      return "mdi:text-box-outline";
    }

    if (detail.resourceType === "honor" || detail.resourceType === "bonds_honor") {
      return "mdi:card-account-details-outline";
    }

    if (detail.resourceType === "gacha_ticket") {
      return "mdi:ticket-outline";
    }

    return "mdi:gift-outline";
  };
  const hideBrokenImage = (event: Event): void => {
    if (event.currentTarget instanceof HTMLImageElement) {
      event.currentTarget.hidden = true;
    }
  };
  $effect(() => {
    if (data.region || data.virtualLiveId) {
      previewOpen = false;
    }
  });
</script>

{#snippet rewardDetailChip(detail: VirtualLiveRewardResourceBoxDetail)}
  {@const imageSrc = getRewardDetailImageSrc(detail)}
  {@const quantity = formatNumber(detail.resourceQuantity)}
  {#if isTitleReward(detail.resourceType)}
    <!-- Title rewards show the in-game title icon; it opens a preview of the title. -->
    <RewardItem
      {detail}
      region={data.region}
      label={detail.resourceName ?? getRewardDetailLabel(detail)}
      quantityLabel={quantity ? `×${quantity}` : null}
    />
  {:else}
    <span
      class={REWARD_CHIP_CLASS}
      title={getRewardDetailLabel(detail)}
      aria-label={getRewardDetailLabel(detail)}
    >
      {#if imageSrc}
        <img
          src={imageSrc}
          alt=""
          class={REWARD_CHIP_ICON_CLASS}
          loading="lazy"
          decoding="async"
          onerror={hideBrokenImage}
        />
      {:else}
        <span class="grid {REWARD_CHIP_ICON_CLASS} place-items-center" aria-hidden="true">
          <Icon icon={getRewardDetailFallbackIcon(detail)} class="size-6 opacity-70" />
        </span>
      {/if}
      {#if quantity}
        <span class={REWARD_CHIP_QUANTITY_CLASS}>×{quantity}</span>
      {/if}
    </span>
  {/if}
{/snippet}

<svelte:head>
  {#await data.virtualLivePayload}
    <title>
      {createPageTitle(`${initialText("pageTitle.virtualLivePrefix")} ${data.virtualLiveId}`)}
    </title>
  {:then payload}
    <title
      >{payload.virtualLive?.name
        ? createPageTitle(payload.virtualLive.name, translate("navigation.virtualLives"))
        : createPageTitle(
            `${initialText("pageTitle.virtualLivePrefix")} ${data.virtualLiveId}`
          )}</title
    >
  {/await}
</svelte:head>

<section use:swipeRegion class="content-page-shell gap-4 px-2">
  {#await data.virtualLivePayload}
    <PageHeader
      breadcrumbs={breadcrumbs(`${t("pageTitle.virtualLivePrefix")} ${data.virtualLiveId}`)}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}<RegionBadgeSwitch options={currentRegionOption()} />{/snippet}
    </PageHeader>
    <DetailPageSkeleton kind="virtual-live" />
  {:then payload}
    <PageHeader
      breadcrumbs={breadcrumbs(
        payload.virtualLive?.name ?? `${t("pageTitle.virtualLivePrefix")} ${data.virtualLiveId}`
      )}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        {#if dev && payload.debugVirtualLiveJson}<button
            type="button"
            class="btn btn-outline btn-sm"
            onclick={() => debugDialog?.showModal()}>{t("debugJsonButton")}</button
          >{/if}
        {#await data.availableRegions then available}<RegionBadgeSwitch
            options={regionOptions(available)}
          />{/await}
      {/snippet}
    </PageHeader>

    {#if payload.error}<div class="alert alert-error">{payload.error}</div>{/if}

    {#if payload.virtualLive}
      {@const live = payload.virtualLive}
      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)]"
      >
        <div class="flex flex-col gap-4">
          <article class="card content-card-shell overflow-hidden shadow-sm">
            <div class="card-body items-center gap-3 p-3 text-center sm:p-5">
              <div
                class={`content-card-inset aspect-16/7 w-full overflow-hidden ${DETAIL_MEDIA_RADIUS_CLASS}`}
              >
                {#if live.assetBundleName}
                  {@const bannerSrc = getVirtualLiveBannerAssetURL(
                    live.assetBundleName,
                    data.region
                  )}
                  {@const bannerAlt = `${live.name ?? live.id} ${t("virtualLiveBannerAltSuffix")}`}
                  <AssetImage
                    src={bannerSrc}
                    alt={bannerAlt}
                    imageClass={`h-full w-full object-contain p-4 md:p-6 ${DETAIL_MEDIA_RADIUS_CLASS}`}
                    buttonClass={DETAIL_MEDIA_BUTTON_CLASS}
                    interactive={true}
                    onclick={() => {
                      previewOpen = true;
                    }}
                  />
                  <ImagePreviewDialog
                    bind:open={previewOpen}
                    src={bannerSrc}
                    alt={bannerAlt}
                    closeLabel={t("closeLabel")}
                    formatOptions={previewFormatOptions}
                    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
                  />
                {:else}
                  <div
                    class="flex h-full items-center justify-center px-6 text-center text-sm opacity-70"
                  >
                    {t("imageUnavailable")}
                  </div>
                {/if}
              </div>
            </div>
          </article>

          <article class="card content-card-shell shadow-sm">
            <div class="card-body gap-4 p-3 sm:p-5">
              <div class="flex items-start justify-between gap-3">
                <p
                  class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                >
                  <Icon
                    icon="mdi:information-outline"
                    class="size-4 shrink-0 translate-y-[0.5px]"
                    aria-hidden="true"
                  />
                  <span>{t("virtualLiveDetailTitle")}</span>
                </p>
                <span
                  class="badge badge-sm badge-outline shrink-0 self-start border-base-content/20 font-semibold"
                >
                  #{live.id}
                </span>
              </div>

              <dl class="space-y-2">
                <div class="content-card-inset rounded-xl p-3 sm:px-4">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                    {t("nameLabel")}
                  </dt>
                  <dd class="mt-1 text-sm font-medium">{live.name ?? live.id}</dd>
                </div>
                <div class="content-card-inset rounded-xl p-3 sm:px-4">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                    {t("typeLabel")}
                  </dt>
                  <dd class="mt-1 text-sm font-medium">{typeLabel(live.virtualLiveType)}</dd>
                </div>
                <div class="content-card-inset rounded-xl p-3 sm:px-4">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                    {t("startAt")}
                  </dt>
                  <dd class="mt-1 text-sm font-medium">{formatDate(live.startAt)}</dd>
                </div>
                <div class="content-card-inset rounded-xl p-3 sm:px-4">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                    {t("endAt")}
                  </dt>
                  <dd class="mt-1 text-sm font-medium">{formatDate(live.endAt)}</dd>
                </div>
                <div class="content-card-inset rounded-xl p-3 sm:px-4">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                    {t("internalResourceCodeLabel")}
                  </dt>
                  <dd class="mt-1 wrap-break-word text-sm font-medium">
                    {displayValue(live.assetBundleName)}
                  </dd>
                </div>
              </dl>
            </div>
          </article>

          {#if live.waitingRoom}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-3 sm:p-5">
                <h2
                  class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                >
                  <Icon
                    icon="mdi:door-open"
                    class="size-4 shrink-0 translate-y-[0.5px]"
                    aria-hidden="true"
                  />
                  <span>{t("virtualLiveWaitingRoomTitle")}</span>
                </h2>
                <dl class="space-y-2">
                  <div class="content-card-inset rounded-xl p-3 sm:px-4">
                    <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                      {t("startAt")}
                    </dt>
                    <dd class="mt-1 text-sm font-medium">{formatDate(live.waitingRoom.startAt)}</dd>
                  </div>
                  <div class="content-card-inset rounded-xl p-3 sm:px-4">
                    <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                      {t("endAt")}
                    </dt>
                    <dd class="mt-1 text-sm font-medium">{formatDate(live.waitingRoom.endAt)}</dd>
                  </div>
                </dl>
              </div>
            </article>
          {/if}

          <VirtualLiveAdditionalData
            group={live.virtualLiveGroup}
            screenMv={live.screenMvMusicVocal}
            pamphlet={live.pamphlet}
            ticket={live.ticket}
            region={data.region}
            title={t("virtualLiveAdditionalDataTitle")}
            groupTitle={t("virtualLiveGroupTitle")}
            screenMvTitle={t("virtualLiveScreenMvTitle")}
            pamphletTitle={t("virtualLivePamphletTitle")}
            ticketTitle={t("virtualLiveTicketTitle")}
            periodLabel={t("virtualLiveGroupPeriod")}
            musicFallbackLabel={t("virtualLiveScreenMvMusicFallback")}
            musicJacketAltSuffix={t("musicJacketAltSuffix")}
            imageUnavailableLabel={t("imageUnavailable")}
            characterLabel={t("characterLabel")}
            {formatDate}
            formatTicketType={(value) =>
              t(`virtualLiveTicketType.${value}`, value.replaceAll("_", " "))}
          />
        </div>

        <div class="flex flex-col gap-4">
          {#if live.information && (live.information.summary || live.information.description)}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-3 sm:p-5">
                <section class="space-y-2" aria-labelledby="virtual-live-information-title">
                  <h2
                    id="virtual-live-information-title"
                    class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                  >
                    <Icon
                      icon="mdi:text-box-outline"
                      class="size-4 shrink-0 translate-y-[0.5px]"
                      aria-hidden="true"
                    />
                    <span>{t("virtualLiveInformationTitle")}</span>
                  </h2>
                  <div class="content-card-inset space-y-2 rounded-xl p-3">
                    {#if live.information.summary}
                      <p class="text-sm font-semibold">{live.information.summary}</p>
                    {/if}
                    {#if live.information.description}
                      <p class="whitespace-pre-line text-xs/5 opacity-70">
                        {live.information.description}
                      </p>
                    {/if}
                  </div>
                </section>
              </div>
            </article>
          {/if}

          {#if live.schedules.length > 0}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-3 sm:p-5">
                <section class="space-y-2" aria-labelledby="virtual-live-schedules-title">
                  <h2
                    id="virtual-live-schedules-title"
                    class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                  >
                    <Icon
                      icon="mdi:calendar-clock"
                      class="size-4 shrink-0 translate-y-[0.5px]"
                      aria-hidden="true"
                    />
                    <span>{t("virtualLiveSchedulesTitle")}</span>
                  </h2>
                  <VirtualLiveScheduleSwitcher
                    schedules={live.schedules}
                    uiLocale={data.uiLocale}
                    virtualLiveId={data.virtualLiveId}
                    labelledBy="virtual-live-schedules-title"
                    unavailableLabel={t("virtualLiveValueUnavailable")}
                    afterEventLabel={t("virtualLiveScheduleIsAfterEventLabel")}
                  />
                </section>
              </div>
            </article>
          {/if}

          {#if live.characters.length > 0}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-3 sm:p-5">
                <section class="space-y-2" aria-labelledby="virtual-live-characters-title">
                  <h2
                    id="virtual-live-characters-title"
                    class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                  >
                    <Icon
                      icon="mdi:account-group"
                      class="size-4 shrink-0 translate-y-[0.5px]"
                      aria-hidden="true"
                    />
                    <span>{t("virtualLiveCharactersTitle")}</span>
                  </h2>
                  <VirtualLiveCharacterGrid
                    characters={live.characters}
                    region={data.region}
                    characterLabel={t("characterLabel")}
                    unavailableLabel={t("virtualLiveValueUnavailable")}
                  />
                </section>
              </div>
            </article>
          {/if}

          {#if live.setlists.length > 0}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-3 sm:p-5">
                <section class="space-y-2" aria-labelledby="virtual-live-setlists-title">
                  <h2
                    id="virtual-live-setlists-title"
                    class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                  >
                    <Icon
                      icon="mdi:playlist-check"
                      class="size-4 shrink-0 translate-y-[0.5px]"
                      aria-hidden="true"
                    />
                    <span>{t("virtualLiveSetlistsTitle")}</span>
                  </h2>
                  <VirtualLiveSetlistSummary
                    setlists={live.setlists}
                    region={data.region}
                    virtualLiveId={data.virtualLiveId}
                    title={t("virtualLiveSetlistDialogTitle")}
                    closeLabel={t("closeLabel")}
                    {t}
                    formatType={typeLabel}
                  />
                </section>
              </div>
            </article>
          {/if}

          {#if live.rewards.length > 0}
            {@const rewardGroups = getRewardGroups(live.rewards)}
            {#if rewardGroups.length > 0}
              <article class="card content-card-shell shadow-sm">
                <div class="card-body gap-4 p-3 sm:p-5">
                  <section class="space-y-2" aria-labelledby="virtual-live-rewards-title">
                    <h2
                      id="virtual-live-rewards-title"
                      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                    >
                      <Icon
                        icon="mdi:gift-outline"
                        class="size-4 shrink-0 translate-y-[0.5px]"
                        aria-hidden="true"
                      />
                      <span>{t("virtualLiveRewardsTitle")}</span>
                    </h2>
                    <div class="grid gap-2 sm:grid-cols-2">
                      {#each rewardGroups as group, groupIndex (group.virtualLiveType ?? groupIndex)}
                        <section
                          class="content-card-inset rounded-xl p-3"
                          aria-labelledby={`virtual-live-reward-group-${groupIndex}`}
                        >
                          <h3
                            id={`virtual-live-reward-group-${groupIndex}`}
                            class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60"
                          >
                            {typeLabel(group.virtualLiveType)}
                          </h3>
                          <div class="mt-2 flex flex-wrap gap-2">
                            {#each group.details as detail, detailIndex (getRewardDetailKey(detail, detailIndex))}
                              {@render rewardDetailChip(detail)}
                            {/each}
                          </div>
                        </section>
                      {/each}
                    </div>
                  </section>
                </div>
              </article>
            {/if}
          {/if}
        </div>
      </div>
    {:else if !payload.error}
      {#await data.availableRegions}<div class="alert">
          <span class="loading loading-spinner loading-sm"></span>{t("virtualLiveDetailLoading")}
        </div>{:then available}<div class="alert alert-error">
          {unavailableMessage(available)}
        </div>{/await}
    {/if}

    {#if dev && payload.debugVirtualLiveJson}<EventDebugDialog
        bind:dialog={debugDialog}
        title={t("virtualLiveDebugJsonTitle")}
        closeLabel={t("closeLabel")}
        json={payload.debugVirtualLiveJson}
      />{/if}
  {/await}
</section>
