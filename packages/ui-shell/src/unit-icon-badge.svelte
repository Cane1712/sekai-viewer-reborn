<script lang="ts">
  import type {
    UnitColorResolver,
    UnitIconBadgeVariant,
    UnitIconResolver
  } from "./unit-icon-badge.types";
  import { getUnitIconBorderColor, resolveUnitIconUrl } from "./unit-icon-data";

  let {
    unit,
    fallbackLabel,
    mapNoneToPiapro = false,
    variant = "default",
    class: className,
    resolveIconUrl = resolveUnitIconUrl,
    getBorderColor = getUnitIconBorderColor
  }: {
    unit: string;
    fallbackLabel?: string;
    mapNoneToPiapro?: boolean;
    variant?: UnitIconBadgeVariant;
    class?: string;
    resolveIconUrl?: UnitIconResolver;
    getBorderColor?: UnitColorResolver;
  } = $props();

  const iconUrl = $derived(resolveIconUrl(unit, mapNoneToPiapro));
  const borderColor = $derived(getBorderColor(unit, mapNoneToPiapro) ?? undefined);

  const frameClass: Record<UnitIconBadgeVariant, string> = {
    sm: "size-7 border border-base-content/15 bg-(--archive-surface-asset-backdrop)",
    default: "size-9 border border-base-content/15 bg-(--archive-surface-asset-backdrop)",
    lg: "size-11 border-2 border-base-content/15 bg-(--archive-surface-asset-backdrop)"
  };
  const imgClass: Record<UnitIconBadgeVariant, string> = {
    sm: "size-7",
    default: "size-10 max-w-none",
    lg: "size-12 max-w-none"
  };
  const textPillClass: Record<UnitIconBadgeVariant, string> = {
    sm: "h-5 min-w-5 px-1 text-[0.55rem]",
    default: "h-7 min-w-7 px-1 text-[0.65rem]",
    lg: "h-9 min-w-9 px-1.5 text-xs"
  };
</script>

{#if iconUrl}
  <span
    class="unit-icon-frame inline-flex shrink-0 items-center justify-center rounded-full {frameClass[
      variant
    ]} {className ?? ''}"
    style:border-color={borderColor}
  >
    <img
      src={iconUrl}
      alt=""
      aria-hidden="true"
      class="{imgClass[variant]} shrink-0 object-contain"
      loading="lazy"
      decoding="async"
    />
  </span>
{:else if fallbackLabel}
  <span
    class="inline-flex items-center justify-center rounded-full border border-base-content/15 bg-base-200 text-base-content font-semibold leading-none {textPillClass[
      variant
    ]} {className ?? ''}"
    style:border-color={borderColor}
  >
    <span>{fallbackLabel}</span>
  </span>
{/if}
