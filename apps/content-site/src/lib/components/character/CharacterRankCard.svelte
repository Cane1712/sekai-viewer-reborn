<script lang="ts">
  import type { SupportedRegion } from "$lib/domain/regions";
  import Icon from "@iconify/svelte";
  import RewardLadder from "$lib/components/shared/RewardLadder.svelte";
  import {
    getCharacterRankRewardDetails,
    summarizeCharacterRanks,
    type CharacterRankSummary
  } from "$lib/domain/character-growth";
  import type { Honor } from "$lib/domain/honor";
  import type { CharacterRankReference, MissionResourceBoxDetail } from "$lib/domain/mission";
  import { createHonorDegreeAssetResolver, toCatalogueHonorDegree } from "$lib/honor-degree";

  let {
    ranks,
    region,
    locale,
    t
  }: {
    ranks: Promise<{
      items: CharacterRankReference[];
      honors?: Record<number, Honor>;
      loadFailed: boolean;
    }>;
    region: SupportedRegion;
    locale: string;
    t: (key: string, fallback: string) => string;
  } = $props();

  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const resourceLabel = (resourceType: string | null): string => {
    switch (resourceType) {
      case "coin":
        return t("characterRankResource.coin", "Coins");
      case "jewel":
        return t("characterRankResource.jewel", "Crystals");
      case "material":
        return t("characterRankResource.material", "Material");
      case "honor":
        return t("characterRankResource.honor", "Title");
      case "bonds_honor":
        return t("characterRankResource.bonds_honor", "Kizuna title");
      case "virtual_coin":
        return t("characterRankResource.virtual_coin", "Virtual coins");
      case "stamp":
        return t("characterRankResource.stamp", "Stamps");
      case "avatar_costume":
        return t("characterRankResource.avatar_costume", "Avatar costumes");
      default:
        return t("characterRankReward", "Reward");
    }
  };
  const resolveHonorAsset = $derived(createHonorDegreeAssetResolver(region));
  // Rank rewards name an honor and the level it reaches; show that level's small degree.
  const honorDegreeOf =
    (honors: Record<number, Honor> = {}) =>
    (detail: MissionResourceBoxDetail) => {
      if (detail.resourceType !== "honor" || detail.resourceId === null) return null;
      const honor = honors[detail.resourceId];
      if (!honor) return null;
      const level = detail.resourceLevel;
      const leveled =
        level === null
          ? honor
          : { ...honor, levels: honor.levels.filter((item) => item.level === level) };
      const group = honor.group ?? {
        id: honor.groupId,
        name: null,
        honorType: honor.honorType,
        backgroundAssetBundleName: null,
        frameName: null
      };
      const name = honor.name ?? resourceLabel("honor");
      return {
        honor: toCatalogueHonorDegree(leveled, group).sub,
        resolveAsset: resolveHonorAsset,
        label:
          level === null
            ? name
            : t("characterRankHonorLevel", "{name} Lv.{level}")
                .replace("{name}", name)
                .replace("{level}", formatNumber(level))
      };
    };
  const rankLabel = (rank: number | null): string =>
    t("characterRankLabel", "Rank {rank}").replace("{rank}", formatNumber(rank ?? 0));
  const headerLabel = (summary: CharacterRankSummary): string =>
    [
      t("characterRankSummary", "{count} ranks").replace(
        "{count}",
        formatNumber(summary.rankCount)
      ),
      summary.maxPowerBonusRate === null
        ? null
        : t("characterRankMaxBonus", "Max power bonus +{bonus}%").replace(
            "{bonus}",
            formatNumber(summary.maxPowerBonusRate)
          )
    ]
      .filter(Boolean)
      .join(" · ");
</script>

<article class="card content-card-shell shadow-sm" aria-labelledby="character-rank-title">
  <div class="card-body gap-4 p-3 sm:p-5">
    {#await ranks}
      <h2
        id="character-rank-title"
        class="flex min-h-7 min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon icon="mdi:medal-outline" class="size-4 shrink-0" aria-hidden="true" />
        <span>{t("characterRankTitle", "Character Rank")}</span>
      </h2>
      <p role="status" class="sr-only">
        {t("characterRankLoading", "Character Rank rewards are loading...")}
      </p>
      <div class="grid gap-4" aria-hidden="true">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {#each [0, 1, 2, 3, 4] as index (index)}
            <div
              class="content-card-inset grid gap-2 rounded-xl border border-(--archive-border-subtle) p-3"
            >
              <div class="h-3 w-3/5 rounded bg-(--archive-surface-default)"></div>
              <div class="h-5 w-2/5 rounded bg-(--archive-surface-default)"></div>
            </div>
          {/each}
        </div>
        <div class="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {#each [0, 1, 2, 3, 4, 5] as index (index)}
            <div class="h-4 rounded bg-(--archive-surface-sunken)"></div>
          {/each}
        </div>
      </div>
    {:then result}
      {@const summary = summarizeCharacterRanks(result.items)}
      <div class="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2
          id="character-rank-title"
          class="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
        >
          <Icon icon="mdi:medal-outline" class="size-4 shrink-0" aria-hidden="true" />
          <span>{t("characterRankTitle", "Character Rank")}</span>
        </h2>
        {#if !result.loadFailed && summary.rankCount > 0}
          <p class="text-xs text-(--archive-text-muted) tabular-nums">{headerLabel(summary)}</p>
        {/if}
      </div>

      {#if result.loadFailed}
        <p class="text-sm text-error" role="alert">
          {t("characterRankLoadFailed", "Character Rank rewards could not be loaded.")}
        </p>
      {:else if summary.rankCount === 0}
        <p class="text-sm text-(--archive-text-muted)">
          {t("characterRankEmpty", "No Character Rank rewards were found.")}
        </p>
      {:else}
        <RewardLadder
          steps={result.items}
          {summary}
          idPrefix="character-rank"
          {region}
          {locale}
          getKey={(rank) => rank.characterRank ?? 0}
          getLabel={(rank) => rankLabel(rank.characterRank)}
          getNote={(rank) =>
            rank.totalExp === null || rank.totalExp === undefined
              ? null
              : t("characterRankTotalExp", "{count} EXP total").replace(
                  "{count}",
                  formatNumber(rank.totalExp)
                )}
          getDetails={getCharacterRankRewardDetails}
          {resourceLabel}
          honorDegree={honorDegreeOf(result.honors)}
          labels={{
            totals: t("characterRankTotalsLabel", "Rewards across all ranks"),
            milestones: t("characterRankMilestonesTitle", "Milestone ranks"),
            all: t("characterRankAllTitle", "All ranks"),
            showAll: t("characterRankShowAll", "Show all {count} ranks").replace(
              "{count}",
              formatNumber(summary.rankCount)
            ),
            showMilestones: t("characterRankShowMilestones", "Show milestone ranks only"),
            noRewards: t("characterRankNoRewards", "No rewards are listed.")
          }}
        />
      {/if}
    {/await}
  </div>
</article>
