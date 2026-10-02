<script lang="ts">
  import Icon from "@iconify/svelte";
  import { closeIcon, downloadIcon, openInNewIcon } from "./icons";
  import { onDestroy, untrack, type Snippet } from "svelte";
  import {
    ImageRetryController,
    STATIC_ASSET_RETRY_POLICY,
    type ImageRetryPolicy
  } from "./image-retry/index";

  type Props = {
    open?: boolean;
    src: string;
    fallbackSrc?: string;
    alt?: string;
    fallbackLabel?: string;
    closeLabel?: string;
    downloadLabel?: string;
    openInNewWindowLabel?: string;
    formatOptions?: string[];
    dialogBoxClass?: string;
    dialogImageClass?: string;
    retryPolicy?: ImageRetryPolicy;
    /** Optional content shown below the image, as wide as the image. */
    children?: Snippet;
  };

  let {
    open = $bindable(false),
    src,
    fallbackSrc,
    alt = "",
    fallbackLabel = "",
    closeLabel = "Close",
    downloadLabel = "Download",
    openInNewWindowLabel = "Open in new window",
    formatOptions = [],
    dialogBoxClass = "relative flex max-w-[min(96vw,1800px)] items-center justify-center overflow-hidden rounded-box bg-base-100/96 p-2 md:p-4",
    dialogImageClass = "h-auto max-h-[88vh] w-auto max-w-full object-contain",
    retryPolicy = STATIC_ASSET_RETRY_POLICY,
    children
  }: Props = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  // Seed the controller for the initial render without making construction the
  // source of reactivity; the pre-effect keeps it synchronized thereafter.
  const imageRetry = untrack(() => new ImageRetryController(src, fallbackSrc, retryPolicy));

  $effect.pre(() => {
    imageRetry.setSources(src, fallbackSrc, retryPolicy);
  });

  onDestroy(() => imageRetry.dispose());

  const normalizedFormatOptions = $derived(
    Array.from(new Set(formatOptions.map((format) => format.trim().toLowerCase()).filter(Boolean)))
  );
  const hasDownloadFormatOptions = $derived(normalizedFormatOptions.length > 0);
  const replaceSrcExtension = (value: string, extension: string): string =>
    value.replace(/(\.[a-z0-9]+)(?=([?#].*)?$)/i, `.${extension}`);
  const currentSrc = $derived(imageRetry.currentSrc);
  const getDownloadSrc = (format: string): string => replaceSrcExtension(currentSrc, format);

  $effect(() => {
    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  class="modal"
  aria-label={alt || fallbackLabel || undefined}
  onclose={() => {
    open = false;
  }}
>
  <div class={`modal-box ${dialogBoxClass} ${children ? "flex-col gap-3" : ""}`}>
    <div class="absolute right-3 top-3 z-10 flex items-center justify-end gap-2">
      {#if !imageRetry.imageFailed}
        {#if hasDownloadFormatOptions}
          <details class="dropdown dropdown-end">
            <summary
              class="btn btn-circle btn-sm touch-target border-base-content/10 bg-base-100/90 shadow-sm"
              aria-label={downloadLabel}
              title={downloadLabel}
            >
              <Icon icon={downloadIcon} class="size-5" aria-hidden="true" />
            </summary>
            <ul
              class="menu dropdown-content z-20 mt-2 min-w-28 rounded-box border border-base-content/10 bg-base-100 p-1 text-sm shadow-md"
            >
              {#each normalizedFormatOptions as format (format)}
                <li>
                  <a
                    href={getDownloadSrc(format)}
                    download
                    aria-label={`${downloadLabel} ${format.toUpperCase()}`}
                  >
                    {format.toUpperCase()}
                  </a>
                </li>
              {/each}
            </ul>
          </details>
        {:else}
          <a
            href={currentSrc}
            download
            class="btn btn-circle btn-sm touch-target border-base-content/10 bg-base-100/90 shadow-sm"
            aria-label={downloadLabel}
            title={downloadLabel}
          >
            <Icon icon={downloadIcon} class="size-5" aria-hidden="true" />
          </a>
        {/if}
        <a
          href={currentSrc}
          target="_blank"
          rel="noreferrer"
          class="btn btn-circle btn-sm touch-target border-base-content/10 bg-base-100/90 shadow-sm"
          aria-label={openInNewWindowLabel}
          title={openInNewWindowLabel}
        >
          <Icon icon={openInNewIcon} class="size-5" aria-hidden="true" />
        </a>
      {/if}
      <form method="dialog">
        <button
          type="submit"
          class="btn btn-circle btn-sm touch-target border-base-content/10 bg-base-100/90 shadow-sm"
          aria-label={closeLabel}
          title={closeLabel}
        >
          <Icon icon={closeIcon} class="size-5" aria-hidden="true" />
        </button>
      </form>
    </div>

    <div class="relative flex items-center justify-center">
      {#if !imageRetry.imageLoaded && !imageRetry.imageFailed}
        <div
          class="absolute inset-0 flex items-center justify-center rounded-box bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(0,0,0,0.18))]"
          aria-hidden="true"
        >
          <span
            class="loading loading-spinner loading-lg text-base-100 drop-shadow-sm"
            aria-hidden="true"
          ></span>
        </div>
      {/if}
      {#if imageRetry.imageFailed}
        <div
          class="flex min-h-[40vh] w-[min(70vw,32rem)] flex-col items-center justify-center gap-4 rounded-box border border-dashed border-base-content/15 bg-base-200/40 px-8 py-10 text-center text-base text-base-content/70"
        >
          <Icon icon="mdi:file-remove-outline" class="size-12 opacity-75" aria-hidden="true" />
          {#if fallbackLabel}
            <p class="font-medium">{fallbackLabel}</p>
          {/if}
        </div>
      {/if}
      {#key imageRetry.requestKey}
        {@const requestSnapshot = imageRetry.requestSnapshot}
        <img
          src={imageRetry.requestUrl}
          {alt}
          class={`${dialogImageClass} transition-[opacity,transform] duration-280 ease-out motion-reduce:transition-none in-data-low-motion:transition-none ${imageRetry.imageLoaded && !imageRetry.imageFailed ? "scale-100 opacity-100" : "scale-[1.01] opacity-0 motion-reduce:scale-100 in-data-low-motion:scale-100"} ${imageRetry.imageFailed ? "pointer-events-none sr-only" : ""}`}
          onload={() => requestSnapshot && imageRetry.handleImageLoad(requestSnapshot)}
          onerror={() => requestSnapshot && imageRetry.handleImageError(requestSnapshot)}
        />
      {/key}
    </div>
    {#if children}
      <!-- w-0 + min-w-full: the content takes the image's width instead of widening the box. -->
      <div class="w-0 min-w-full">{@render children()}</div>
    {/if}
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">{closeLabel}</button>
  </form>
</dialog>
