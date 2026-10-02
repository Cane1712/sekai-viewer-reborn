<script lang="ts">
  let {
    hasNext,
    isLoading,
    error,
    loadingLabel,
    idleLabel,
    errorLabel,
    retryLabel,
    onLoadMore
  }: {
    hasNext: boolean;
    isLoading: boolean;
    error: boolean;
    loadingLabel: string;
    idleLabel: string;
    errorLabel: string;
    retryLabel: string;
    onLoadMore: () => void;
  } = $props();

  let sentinel: HTMLDivElement | null = $state(null);

  // Loads the next page as the end of the list nears the viewport.
  $effect(() => {
    if (
      !sentinel ||
      !hasNext ||
      isLoading ||
      error ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: "240px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

{#if error}
  <div class="mt-5 flex flex-col items-center justify-center gap-3 p-4 text-center" role="status">
    <p class="text-sm text-error">{errorLabel}</p>
    <button type="button" class="btn touch-target" onclick={onLoadMore}>{retryLabel}</button>
  </div>
{:else if hasNext}
  <div
    bind:this={sentinel}
    class="flex min-h-20 items-center justify-center gap-3 p-4 text-sm text-(--archive-text-muted)"
    role="status"
    aria-live="polite"
  >
    {#if isLoading}
      <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
      <span>{loadingLabel}</span>
    {:else}
      <button type="button" class="btn btn-ghost touch-target" onclick={onLoadMore}
        >{idleLabel}</button
      >
    {/if}
  </div>
{/if}
