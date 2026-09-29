<script lang="ts" generics="T">
  import RewardItem from "$lib/components/shared/RewardItem.svelte";
  import type { MissionResourceBoxDetail } from "$lib/domain/mission";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { RewardLadderSummary } from "$lib/domain/reward-ladder";

  let {
    steps,
    summary,
    idPrefix,
    region,
    locale,
    getKey,
    getLabel,
    getNote,
    getDetails,
    resourceLabel,
    labels
  }: {
    steps: T[];
    summary: RewardLadderSummary<T>;
    idPrefix: string;
    region: SupportedRegion;
    locale: string;
    getKey: (step: T) => string | number;
    getLabel: (step: T) => string;
    /** Optional second line under the label, such as the EXP a rank needs. */
    getNote?: (step: T) => string | null;
    getDetails: (step: T) => MissionResourceBoxDetail[];
    resourceLabel: (resourceType: string | null) => string;
    labels: {
      totals: string;
      milestones: string;
      all: string;
      showAll: string;
      showMilestones: string;
      noRewards: string;
    };
  } = $props();

  let showAll = $state(false);

  const milestoneKeys = $derived(new Set(summary.milestones.map((step) => getKey(step))));
  const visibleSteps = $derived(showAll ? steps : summary.milestones);

  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  // Named items (tickets, materials) use their own name over the generic type label.
  const itemLabel = (detail: MissionResourceBoxDetail): string =>
    detail.resourceName ?? resourceLabel(detail.resourceType);
</script>

{#snippet stepRow(step: T, milestone: boolean)}
  {@const note = getNote?.(step) ?? null}
  <li
    class="flex break-inside-avoid items-center justify-between gap-3 border-b border-(--archive-border-subtle) py-2 text-sm"
    data-milestone={milestone ? "true" : undefined}
  >
    <span class="grid shrink-0 tabular-nums">
      <span
        class={milestone
          ? "font-semibold text-(--archive-text-strong)"
          : "text-(--archive-text-muted)"}
      >
        {getLabel(step)}
      </span>
      {#if note}<span class="text-xs text-(--archive-text-muted)">{note}</span>{/if}
    </span>
    <span
      class="flex min-w-0 flex-wrap justify-end gap-x-3 gap-y-1 text-right tabular-nums {milestone
        ? 'text-(--archive-text-strong)'
        : 'text-(--archive-text-muted)'}"
    >
      {#each getDetails(step) as detail, index (index)}
        <RewardItem
          {detail}
          {region}
          label={itemLabel(detail)}
          quantityLabel={detail.resourceQuantity === null
            ? null
            : `×${formatNumber(detail.resourceQuantity)}`}
        />
      {:else}
        {labels.noRewards}
      {/each}
    </span>
  </li>
{/snippet}

{#if summary.totals.length > 0}
  <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" aria-label={labels.totals}>
    {#each summary.totals as total (`${total.resourceType}:${total.detail.resourceId ?? ""}`)}
      <div
        class="content-card-inset grid gap-1 rounded-xl border border-(--archive-border-subtle) p-3"
      >
        <dt class="sr-only">{itemLabel(total.detail)}</dt>
        <dd class="text-lg font-semibold text-(--archive-text-strong) tabular-nums">
          <RewardItem
            detail={total.detail}
            {region}
            label={itemLabel(total.detail)}
            quantityLabel={`×${formatNumber(total.quantity)}`}
            size="lg"
            preview={false}
          />
        </dd>
      </div>
    {/each}
  </dl>
{/if}

<section class="grid gap-2" aria-labelledby={`${idPrefix}-list-title`}>
  <h3 id={`${idPrefix}-list-title`} class="text-sm font-semibold text-(--archive-text-strong)">
    {showAll ? labels.all : labels.milestones}
  </h3>
  <!-- One column flow for both states: the column count follows the card width, and
       showing every step only fills in the rows between milestones. -->
  {#if visibleSteps.length > 0}
    <ul class="columns-[17rem] gap-x-8">
      {#each visibleSteps as step (getKey(step))}
        {@render stepRow(step, milestoneKeys.has(getKey(step)))}
      {/each}
    </ul>
  {/if}
  <button
    type="button"
    class="btn btn-ghost btn-sm touch-target self-start"
    aria-expanded={showAll}
    onclick={() => (showAll = !showAll)}
  >
    {showAll ? labels.showMilestones : labels.showAll}
  </button>
</section>
