<script lang="ts">
  import type { MissionResourceBoxDetail } from "$lib/domain/mission";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { getRewardItemIcon } from "$lib/domain/reward-item";
  import { titlePreviewKindOf } from "$lib/domain/title-preview";
  import TitlePreviewDialog from "./TitlePreviewDialog.svelte";

  let {
    detail,
    region,
    label,
    quantityLabel = null,
    size = "md",
    preview = true,
    class: className = ""
  }: {
    detail: Pick<
      MissionResourceBoxDetail,
      "resourceType" | "resourceId" | "resourceAssetbundleName"
    > &
      Partial<Pick<MissionResourceBoxDetail, "resourceLevel" | "resourceRarity">>;
    region: SupportedRegion;
    /** The item's name: the icon's tooltip and accessible label, or the text without an icon. */
    label: string;
    /** Already formatted, for example "×100". */
    quantityLabel?: string | null;
    /** `lg` suits standalone totals; `md` suits reward rows. */
    size?: "md" | "lg";
    /** A title reward opens its preview; off for totals that sum several titles. */
    preview?: boolean;
    class?: string;
  } = $props();

  // Without a configured asset server the item still shows as text.
  const icon = $derived.by(() => {
    try {
      return getRewardItemIcon(detail, region);
    } catch {
      return null;
    }
  });
  // How many icon sources have failed: 0 shows `src`, 1 shows `fallbackSrc`, then text only.
  let failures = $state(0);
  $effect(() => {
    void icon?.src;
    failures = 0;
  });
  const src = $derived(
    !icon ? null : failures === 0 ? icon.src : failures === 1 ? icon.fallbackSrc : null
  );
  // A title reward opens a preview of the title itself.
  const titleKind = $derived(
    !preview || detail.resourceId === null ? null : titlePreviewKindOf(detail.resourceType)
  );
  let titlePreview: TitlePreviewDialog | null = $state(null);
  const accessibleLabel = $derived(quantityLabel ? `${label} ${quantityLabel}` : label);
</script>

{#snippet iconImage()}
  <img
    src={src ?? undefined}
    alt=""
    class="shrink-0 object-contain {size === 'lg' ? 'size-14' : 'size-12'}"
    loading="lazy"
    decoding="async"
    onerror={() => (failures += 1)}
  />
  {#if quantityLabel}<span
      class="tabular-nums {size === 'lg'
        ? 'text-lg font-semibold text-(--archive-text-strong)'
        : ''}"
      aria-hidden="true">{quantityLabel}</span
    >{/if}
{/snippet}

{#if titleKind && detail.resourceId !== null}
  <button
    type="button"
    class="btn btn-ghost touch-target tooltip h-auto min-h-0 gap-1 p-0.5 align-middle font-normal {className}"
    data-tip={label}
    aria-label={accessibleLabel}
    aria-haspopup="dialog"
    onclick={() => titlePreview?.show()}
  >
    {#if src}
      {@render iconImage()}
    {:else}
      <span class="min-w-0 wrap-anywhere">{label}</span>
      {#if quantityLabel}<span class="shrink-0 tabular-nums">{quantityLabel}</span>{/if}
    {/if}
  </button>
  <TitlePreviewDialog
    bind:this={titlePreview}
    {region}
    kind={titleKind}
    id={detail.resourceId}
    level={detail.resourceLevel ?? null}
    fallbackName={label}
  />
{:else if src}
  <!-- A game-asset icon may stand alone (DESIGN.md, Focus and accessibility): the tooltip
       and the accessible label carry the item's name. -->
  <span
    class="tooltip inline-flex shrink-0 items-center gap-1 align-middle {className}"
    data-tip={label}
    role="img"
    aria-label={accessibleLabel}
  >
    {@render iconImage()}
  </span>
{:else}
  <span class="inline-flex min-w-0 items-center gap-1.5 align-middle {className}">
    <span class="min-w-0 wrap-anywhere">{label}</span>
    {#if quantityLabel}<span class="shrink-0 tabular-nums">{quantityLabel}</span>{/if}
  </span>
{/if}
