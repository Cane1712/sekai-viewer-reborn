<script lang="ts">
  import Icon from "@iconify/svelte";
  import { resolve } from "$app/paths";
  import { tick } from "svelte";
  import {
    formatCharacterMissionSentence,
    summarizeCharacterMission
  } from "$lib/domain/character-growth";
  import type { Mission, MissionParameterGroupLevel } from "$lib/domain/mission";
  import type { SupportedRegion } from "$lib/domain/regions";

  type LevelPage = {
    items: MissionParameterGroupLevel[];
    pagination: { page: number; hasNext: boolean };
  };
  type LevelState = {
    status: "loading" | "ready" | "error";
    items: MissionParameterGroupLevel[];
  };

  let {
    missions,
    region,
    locale,
    labels,
    tileSurface = "inset"
  }: {
    missions: Mission[];
    region: SupportedRegion;
    locale: string;
    labels: {
      extra: string;
      unnamed: string;
      close: string;
      /** `{count}` is replaced with the number of level goals. */
      goalCount: string;
      goalCountOne: string;
      loading: string;
      error: string;
      /** Shown when the region has no level data for a mission. */
      unavailable: string;
      retry: string;
      /** `{level}` and `{count}` are replaced with the level and its target. */
      level: string;
      /** `{count}` is replaced with the EXP a level awards. */
      exp: string;
      resourceLabel: (resourceType: string | null) => string;
    };
    /** `inset` inside a card; `shell` (white) when the grid sits straight on a sunken area. */
    tileSurface?: "inset" | "shell";
  } = $props();

  // Level ladders run to a few hundred goals at most; this bounds a misbehaving API.
  const MAX_LEVEL_PAGES = 20;

  const dialogId = $props.id();
  const titleId = `${dialogId}-title`;
  let dialog: HTMLDialogElement | null = $state(null);
  let activeMission = $state<Mission | null>(null);
  let lastTrigger: HTMLButtonElement | null = null;
  let levelsByGroup = $state<Record<number, LevelState>>({});

  const formatNumber = (value: number): string => new Intl.NumberFormat(locale).format(value);
  const sentenceOf = (mission: Mission): string =>
    formatCharacterMissionSentence(mission.sentence ?? labels.unnamed);
  const groupIdOf = (mission: Mission): number | null =>
    mission.parameterGroup?.id ?? mission.parameterGroupId;
  const goalCountLabel = (count: number): string =>
    count === 1 ? labels.goalCountOne : labels.goalCount.replace("{count}", formatNumber(count));

  const loadLevels = async (groupId: number): Promise<void> => {
    levelsByGroup = { ...levelsByGroup, [groupId]: { status: "loading", items: [] } };
    const items: MissionParameterGroupLevel[] = [];
    try {
      for (let page = 1; page <= MAX_LEVEL_PAGES; page += 1) {
        const response = await fetch(
          `${resolve("/missions/[region]/parameter-groups/[id]/levels", { region, id: String(groupId) })}?page=${page}`
        );
        if (!response.ok) throw new Error("Level goals request failed.");
        const next = (await response.json()) as LevelPage;
        items.push(...next.items);
        if (!next.pagination.hasNext) break;
      }
      levelsByGroup = { ...levelsByGroup, [groupId]: { status: "ready", items } };
    } catch {
      levelsByGroup = { ...levelsByGroup, [groupId]: { status: "error", items: [] } };
    }
  };

  const openDialog = async (event: MouseEvent, mission: Mission): Promise<void> => {
    lastTrigger = event.currentTarget as HTMLButtonElement;
    activeMission = mission;
    const groupId = groupIdOf(mission);
    // Ladders are fetched once and kept; a failed fetch is retried on the next open.
    if (groupId !== null && levelsByGroup[groupId]?.status !== "ready") void loadLevels(groupId);
    await tick();
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
  };
  const handleDialogClose = (): void => {
    activeMission = null;
    lastTrigger?.focus();
    lastTrigger = null;
  };
  const closeDialog = (): void => {
    if (dialog?.open && typeof dialog.close === "function") {
      dialog.close();
      return;
    }
    dialog?.removeAttribute("open");
    handleDialogClose();
  };

  const levelRewards = (level: MissionParameterGroupLevel): string[] => [
    ...(level.exp ? [labels.exp.replace("{count}", formatNumber(level.exp))] : []),
    ...(level.reward?.resourceType
      ? [
          level.reward.resourceQuantity === null
            ? labels.resourceLabel(level.reward.resourceType)
            : `${labels.resourceLabel(level.reward.resourceType)} ×${formatNumber(level.reward.resourceQuantity)}`
        ]
      : [])
  ];
  const levelLabel = (level: MissionParameterGroupLevel, index: number): string =>
    labels.level
      .replace("{level}", formatNumber(level.seq ?? index + 1))
      .replace("{count}", level.requirement === null ? "…" : formatNumber(level.requirement));
</script>

<ul class="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {#each missions as mission (mission.id)}
    <li class="min-w-0">
      <button
        type="button"
        class="{tileSurface === 'shell'
          ? 'content-card-shell'
          : 'content-card-inset'} flex size-full min-h-11 min-w-0 cursor-pointer items-start gap-2 rounded-xl border border-(--archive-border-subtle) p-3 text-left text-sm wrap-anywhere text-(--archive-text-strong) outline-none transition-colors duration-180 hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-haspopup="dialog"
        aria-controls={dialogId}
        onclick={(event) => void openDialog(event, mission)}
      >
        {#if summarizeCharacterMission(mission).isExtra}
          <span class="badge badge-outline badge-sm shrink-0">{labels.extra}</span>
        {/if}
        <span class="min-w-0">{sentenceOf(mission)}</span>
      </button>
    </li>
  {/each}
</ul>

<dialog
  bind:this={dialog}
  id={dialogId}
  class="modal"
  aria-labelledby={titleId}
  onclose={handleDialogClose}
  onclick={(event) => {
    if (event.target === event.currentTarget) closeDialog();
  }}
>
  <div
    class="modal-box flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl flex-col overflow-hidden p-0 sm:w-[calc(100%-2rem)]"
  >
    {#if activeMission}
      {@const groupId = groupIdOf(activeMission)}
      {@const levelState = groupId === null ? null : levelsByGroup[groupId]}
      {@const totalLevels = activeMission.parameterGroup?.totalLevels ?? null}
      <header
        class="flex shrink-0 items-start justify-between gap-4 border-b border-(--archive-border-subtle) p-4 sm:p-5"
      >
        <div class="min-w-0">
          <h2 id={titleId} class="text-lg font-bold wrap-anywhere text-(--archive-text-strong)">
            {#if summarizeCharacterMission(activeMission).isExtra}
              <span class="badge badge-outline badge-sm mr-1.5 align-middle">{labels.extra}</span>
            {/if}
            {sentenceOf(activeMission)}
          </h2>
          {#if totalLevels !== null}
            <p class="mt-1 text-sm text-(--archive-text-muted) tabular-nums">
              {goalCountLabel(totalLevels)}
            </p>
          {/if}
        </div>
        <button
          type="button"
          class="btn btn-circle btn-ghost btn-sm touch-target shrink-0"
          aria-label={labels.close}
          title={labels.close}
          onclick={closeDialog}
        >
          <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
        </button>
      </header>
      <div class="min-h-0 overflow-y-auto p-4 sm:p-5" aria-busy={levelState?.status === "loading"}>
        {#if groupId === null}
          <p class="text-sm text-(--archive-text-muted)">{labels.unavailable}</p>
        {:else if !levelState || levelState.status === "loading"}
          <p role="status" class="sr-only">{labels.loading}</p>
          <ul class="columns-3xs gap-x-8" aria-hidden="true">
            {#each Array.from({ length: 12 }) as _, index (index)}
              <li class="flex break-inside-avoid justify-between gap-3 py-2">
                <span class="h-4 w-28 rounded bg-(--archive-surface-sunken)"></span>
                <span class="h-4 w-16 rounded bg-(--archive-surface-sunken)"></span>
              </li>
            {/each}
          </ul>
        {:else if levelState.status === "error"}
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p role="alert" class="text-sm text-error">{labels.error}</p>
            {#if groupId !== null}
              <button
                type="button"
                class="btn btn-link touch-target px-0"
                onclick={() => void loadLevels(groupId)}
              >
                {labels.retry}
              </button>
            {/if}
          </div>
        {:else}
          <ul class="columns-3xs gap-x-8">
            {#each levelState.items as level, index (level.seq ?? index)}
              <li
                class="flex break-inside-avoid items-baseline justify-between gap-3 border-b border-(--archive-border-subtle) py-2 text-sm"
              >
                <span class="shrink-0 text-(--archive-text-muted) tabular-nums">
                  {levelLabel(level, index)}
                </span>
                <span
                  class="min-w-0 text-right wrap-anywhere text-(--archive-text-strong) tabular-nums"
                >
                  {levelRewards(level).join(" · ")}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>
  <form
    method="dialog"
    class="modal-backdrop"
    onsubmit={(event) => {
      event.preventDefault();
      closeDialog();
    }}
  >
    <button type="submit" aria-label={labels.close}></button>
  </form>
</dialog>
