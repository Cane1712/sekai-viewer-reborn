<script lang="ts">
  import Icon from "@iconify/svelte";

  let {
    status,
    loadingLabel,
    notFoundLabel,
    errorLabel
  }: {
    status: "loading" | "ready" | "notFound" | "error";
    loadingLabel: string;
    notFoundLabel: string;
    errorLabel: string;
  } = $props();
</script>

{#if status === "loading"}
  <div role="status" aria-busy="true" aria-label={loadingLabel}>
    <!-- Mirrors the detail layout: an identity card beside the info cards. -->
    <div
      aria-hidden="true"
      class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)]"
    >
      <div class="content-card-shell rounded-2xl p-3 sm:p-5">
        <div
          class="mx-auto aspect-square w-1/2 animate-pulse rounded-xl bg-(--archive-surface-sunken) motion-reduce:animate-none"
        ></div>
        <div class="mt-4 h-7 w-2/3 rounded bg-(--archive-surface-sunken)"></div>
      </div>
      <div class="flex flex-col gap-4">
        {#each [0, 1] as index (index)}
          <div class="content-card-shell rounded-2xl p-3 sm:p-5">
            <div class="h-4 w-32 rounded bg-(--archive-surface-sunken)"></div>
            <div class="mt-4 grid gap-2 sm:grid-cols-2">
              {#each [0, 1, 2, 3] as row (row)}
                <div class="h-16 rounded-xl bg-(--archive-surface-sunken)"></div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{:else if status !== "ready"}
  <div
    class="content-card-inset flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-(--archive-border-subtle) p-6 text-center"
    role="status"
  >
    <Icon
      icon={status === "error" ? "mdi:alert-circle-outline" : "mdi:map-search-outline"}
      class="size-8 {status === 'error' ? 'text-error' : 'text-(--archive-text-muted)'}"
      aria-hidden="true"
    />
    <p>{status === "error" ? errorLabel : notFoundLabel}</p>
  </div>
{/if}
