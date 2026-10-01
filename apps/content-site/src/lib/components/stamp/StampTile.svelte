<script lang="ts">
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import { getStampDisplayName, type StampItem } from "$lib/domain/stamp";

  let {
    stamp,
    imageSrc,
    imageUnavailableLabel,
    onOpen
  }: {
    stamp: StampItem;
    imageSrc: string | null;
    imageUnavailableLabel: string;
    /** Opens the stamp's preview, which carries its name, characters, and how to obtain it. */
    onOpen: () => void;
  } = $props();

  const displayName = $derived(getStampDisplayName(stamp.name));
</script>

<!-- The list shows only the image. The whole tile is a button named by the stamp's own text. -->
<button
  type="button"
  class="content-card-shell group size-full min-w-0 cursor-zoom-in rounded-2xl p-2 text-left outline-none transition-[transform,border-color,background-color] duration-180 hover-lift hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none sm:p-3"
  aria-haspopup="dialog"
  aria-label={displayName}
  title={displayName}
  onclick={onOpen}
>
  <div class="relative aspect-square w-full overflow-hidden rounded-xl">
    {#if imageSrc}
      <AssetImage
        buttonClass="block size-full overflow-hidden"
        src={imageSrc}
        alt=""
        fallbackLabel={imageUnavailableLabel}
        loadMode="visible"
        imageClass="size-full object-contain"
      />
    {:else}
      <span
        class="flex size-full items-center justify-center p-2 text-center text-xs text-(--archive-text-muted)"
        >{imageUnavailableLabel}</span
      >
    {/if}
  </div>
</button>
