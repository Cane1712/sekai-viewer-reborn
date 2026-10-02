<script lang="ts" module>
  import type { TitlePreview } from "$lib/domain/title-preview";

  // One request per title and level, shared by every reward row that shows it. It only
  // de-duplicates fetches and never drives rendering, so it need not be reactive.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const previewRequests = new Map<string, Promise<TitlePreview>>();
</script>

<script lang="ts">
  import Icon from "@iconify/svelte";
  import { resolve } from "$app/paths";
  import { HonorDegree } from "@platform/ui-shell";
  import type { TitlePreviewKind } from "$lib/domain/title-preview";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { createHonorDegreeAssetResolver } from "$lib/honor-degree";
  import { getTitlePreviewLabels } from "./title-preview-labels";

  let {
    region,
    kind,
    id,
    level = null,
    fallbackName
  }: {
    region: SupportedRegion;
    kind: TitlePreviewKind;
    id: number;
    /** The rewarded level: the title renders at it and it is highlighted. */
    level?: number | null;
    /** Shown until the title loads, and if it cannot. */
    fallbackName: string;
  } = $props();

  const labelsOf = getTitlePreviewLabels();
  const labels = $derived(labelsOf());
  const dialogId = $props.id();
  const titleId = `${dialogId}-title`;
  let dialog: HTMLDialogElement | null = $state(null);
  let previewState = $state<
    { status: "idle" | "loading" | "error" } | { status: "ready"; preview: TitlePreview }
  >({ status: "idle" });
  const resolveAsset = $derived(createHonorDegreeAssetResolver(region));

  const previewUrl = (): string => {
    const path = resolve("/honors/[region]/preview/[kind]/[id]", {
      region,
      kind,
      id: String(id)
    });
    return level !== null && level > 0 ? `${path}?level=${level}` : path;
  };

  const load = async (): Promise<void> => {
    const url = previewUrl();
    previewState = { status: "loading" };
    let request = previewRequests.get(url);
    if (!request) {
      request = fetch(url).then(async (response) => {
        if (!response.ok) throw new Error("Title preview request failed.");
        return (await response.json()) as TitlePreview;
      });
      previewRequests.set(url, request);
      request.catch(() => previewRequests.delete(url));
    }
    try {
      previewState = { status: "ready", preview: await request };
    } catch {
      previewState = { status: "error" };
    }
  };

  export function show(): void {
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    if (previewState.status === "idle" || previewState.status === "error") void load();
  }

  const close = (): void => {
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    dialog?.removeAttribute("open");
  };
</script>

<dialog
  bind:this={dialog}
  id={dialogId}
  class="modal"
  aria-labelledby={titleId}
  onclick={(event) => {
    if (event.target === event.currentTarget) close();
  }}
>
  <!-- The dialog renders inside its reward row, so reset the alignment that row sets. -->
  <div
    class="modal-box flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-xl flex-col overflow-hidden p-0 text-start sm:w-[calc(100%-2rem)]"
  >
    <header
      class="flex shrink-0 items-start justify-between gap-4 border-b border-(--archive-border-subtle) p-4 sm:p-5"
    >
      <div class="min-w-0">
        <p class="text-xs font-semibold text-(--archive-text-muted)">{labels.dialog}</p>
        <h2 id={titleId} class="text-lg font-bold wrap-anywhere text-(--archive-text-strong)">
          {previewState.status === "ready"
            ? (previewState.preview.name ?? fallbackName)
            : fallbackName}
        </h2>
      </div>
      <button
        type="button"
        class="btn btn-circle btn-ghost btn-sm touch-target shrink-0"
        aria-label={labels.close}
        title={labels.close}
        onclick={close}
      >
        <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
      </button>
    </header>
    <div
      class="grid min-h-0 gap-4 overflow-y-auto p-4 sm:p-5"
      aria-busy={previewState.status === "loading"}
    >
      {#if previewState.status === "ready"}
        {@const preview = previewState.preview}
        <div class="flex justify-center">
          <HonorDegree
            honor={preview.degree}
            {resolveAsset}
            slot="main"
            size="L"
            label={preview.name ?? fallbackName}
            class="h-auto! w-full! max-w-95"
          />
        </div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {#if preview.rarity}
            <dt class="text-(--archive-text-muted)">{labels.rarity}</dt>
            <dd class="text-(--archive-text-strong)">
              {labels.rarities[preview.rarity] ?? preview.rarity}
            </dd>
          {/if}
        </dl>
        {#if preview.subtitle}
          <p class="text-sm text-(--archive-text-default)">{preview.subtitle}</p>
        {/if}
        {#if preview.levels.length > 0}
          <div
            class="content-card-inset overflow-x-auto rounded-xl border-(--archive-border-subtle)"
          >
            <table class="table table-sm" aria-label={labels.levels}>
              <thead>
                <tr>
                  <th scope="col" class="w-px text-center whitespace-nowrap">{labels.level}</th>
                  <th scope="col">{labels.condition}</th>
                </tr>
              </thead>
              <tbody>
                {#each preview.levels as entry, index (index)}
                  {@const rewarded = entry.level !== null && entry.level === level}
                  <tr
                    class={rewarded ? "bg-primary/10" : undefined}
                    aria-current={rewarded ? "true" : undefined}
                  >
                    <th
                      scope="row"
                      class="text-center tabular-nums {rewarded
                        ? 'font-semibold text-primary'
                        : 'font-normal text-(--archive-text-default)'}"
                    >
                      {entry.level ?? "—"}
                    </th>
                    <td
                      class={rewarded
                        ? "text-(--archive-text-strong)"
                        : "text-(--archive-text-default)"}
                    >
                      {entry.description ?? "—"}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {:else if previewState.status === "error"}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="alert" class="text-sm text-error">{labels.error}</p>
          <button type="button" class="btn btn-link touch-target px-0" onclick={() => void load()}>
            {labels.retry}
          </button>
        </div>
      {:else}
        <p role="status" class="sr-only">{labels.loading}</p>
        <div
          class="mx-auto aspect-19/4 w-full max-w-95 animate-pulse rounded-full bg-(--archive-surface-sunken)"
          aria-hidden="true"
        ></div>
      {/if}
    </div>
  </div>
  <form
    method="dialog"
    class="modal-backdrop"
    onsubmit={(event) => {
      event.preventDefault();
      close();
    }}
  >
    <button type="submit" aria-label={labels.close}></button>
  </form>
</dialog>
