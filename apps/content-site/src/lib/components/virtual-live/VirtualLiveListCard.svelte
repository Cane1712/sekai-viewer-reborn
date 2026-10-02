<script lang="ts">
  import { resolve } from "$app/paths";
  import { getVirtualLiveBannerAssetURL } from "$lib/assets/index";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import EventCardFrame from "$lib/components/shared/EventCardFrame.svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { getVirtualLiveBannerBundle, type VirtualLiveListItem } from "$lib/domain/virtual-live";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import {
    EVENT_LIST_CARD_FRAME_CLASS,
    EVENT_LIST_CARD_IMAGE_CLASS,
    EVENT_LIST_CARD_TITLE_CLASS
  } from "$lib/styles/event-card";

  const VIRTUAL_LIVE_CARD_MEDIA_CLASS =
    "relative flex h-32 items-center justify-center overflow-hidden bg-transparent px-4 pb-1.5 pt-4 sm:h-36 sm:pb-2";
  import { formatDisplayDateTime, toTimestampMs } from "$lib/time/date-time";

  let {
    region,
    item,
    uiLocale,
    bannerAltSuffix,
    spoilerContentLabel,
    ongoingLabel,
    typeLabel
  }: {
    region: SupportedRegion;
    item: VirtualLiveListItem;
    uiLocale: string;
    bannerAltSuffix: string;
    spoilerContentLabel: string;
    ongoingLabel: string;
    typeLabel: string;
  } = $props();

  const contentDisplaySettings = getContentDisplaySettings();
  const bannerBundle = $derived(getVirtualLiveBannerBundle(item));
  const spoilerRevealAnimationMs = 180;
  let spoilerRevealed = $state(false);
  let spoilerRevealAnimating = $state(false);
  let lastIdentity = $state("");
  let revealTimeout: ReturnType<typeof setTimeout> | null = null;

  const isSpoiler = (): boolean => {
    const startAt = toTimestampMs(item.startAt);
    return startAt !== null && startAt > Date.now();
  };
  const isMosaicked = (): boolean =>
    isSpoiler() && contentDisplaySettings.mosaickedSpoilerContent && !spoilerRevealed;
  const showPlaceholder = (): boolean =>
    isSpoiler() &&
    contentDisplaySettings.mosaickedSpoilerContent &&
    (!spoilerRevealed || spoilerRevealAnimating);
  const formatDate = (value: string | number | null): string =>
    formatDisplayDateTime(toTimestampMs(value) ?? value, uiLocale);
  const timeRange = (): string => `${formatDate(item.startAt)} - ${formatDate(item.endAt)}`;
  const clearRevealTimeout = (): void => {
    if (revealTimeout !== null) clearTimeout(revealTimeout);
    revealTimeout = null;
  };

  $effect(() => {
    const identity = `${region}:${item.id}`;
    if (identity === lastIdentity) return;
    clearRevealTimeout();
    lastIdentity = identity;
    spoilerRevealed = false;
    spoilerRevealAnimating = false;
    return clearRevealTimeout;
  });

  const handleClick = (event: MouseEvent): void => {
    if (!isMosaicked()) return;
    event.preventDefault();
    spoilerRevealAnimating = true;
    clearRevealTimeout();
    revealTimeout = setTimeout(() => {
      spoilerRevealed = true;
      spoilerRevealAnimating = false;
      revealTimeout = null;
    }, spoilerRevealAnimationMs);
  };
</script>

{#snippet mosaicOverlay()}
  <div
    class={`event-list-spoiler-mosaic-overlay flex size-full flex-col items-center justify-center gap-3 px-6 text-center backdrop-blur-2xl transition-opacity duration-180 ease-out ${spoilerRevealAnimating ? "opacity-0" : "opacity-100"}`}
  >
    <div
      class="flex size-9 items-center justify-center rounded-full border-2 border-error/70 text-2xl font-black text-error"
    >
      !
    </div>
    <span class="text-sm font-semibold tracking-[0.12em] text-error">{spoilerContentLabel}</span>
  </div>
{/snippet}

<EventCardFrame
  href={resolve("/virtual-live/[region]/[id]", { region, id: item.id })}
  frameClass={EVENT_LIST_CARD_FRAME_CLASS}
  useBody={false}
  overlay={showPlaceholder() ? mosaicOverlay : undefined}
  onclick={handleClick}
>
  {#if showPlaceholder()}
    <div class={VIRTUAL_LIVE_CARD_MEDIA_CLASS}>
      <div class="size-full rounded-xl bg-base-200/60"></div>
    </div>
    <div class="px-4 pb-4 pt-3"><div class="h-10 rounded-lg bg-base-200/60"></div></div>
  {:else}
    <div class={VIRTUAL_LIVE_CARD_MEDIA_CLASS}>
      {#if item.status === "ongoing"}
        <span
          class="badge absolute right-3 top-3 z-10 border-none bg-primary font-semibold text-primary-content shadow-sm"
        >
          {ongoingLabel}
        </span>
      {/if}
      {#if bannerBundle}
        <AssetImage
          src={getVirtualLiveBannerAssetURL(bannerBundle, region)}
          alt={`${item.name ?? item.id} ${bannerAltSuffix}`}
          imageClass={EVENT_LIST_CARD_IMAGE_CLASS}
          buttonClass="block h-full w-full overflow-hidden"
          loadMode="visible"
        />
      {:else}
        <div class="flex size-full items-center justify-center px-6 text-center text-sm opacity-70">
          {item.name ?? item.id}
        </div>
      {/if}
    </div>

    <div class="flex flex-wrap items-center gap-1.5 px-4 pt-3">
      <span class="badge border-none bg-base-200 font-semibold text-base-content">#{item.id}</span>
      {#if item.virtualLiveType}
        <span class="badge border-none bg-base-200 font-semibold text-base-content"
          >{typeLabel}</span
        >
      {/if}
    </div>

    <div class="px-4 pb-4 pt-3">
      <h2 class={EVENT_LIST_CARD_TITLE_CLASS}>{item.name ?? item.id}</h2>
      <p class="mt-1 text-xs/relaxed opacity-65">{timeRange()}</p>
    </div>
  {/if}
</EventCardFrame>
