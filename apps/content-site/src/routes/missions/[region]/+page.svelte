<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { goto, invalidateAll } from "$app/navigation";
  import { SvelteSet, SvelteURLSearchParams } from "svelte/reactivity";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import MissionCatalogue from "$lib/components/mission/MissionCatalogue.svelte";
  import MissionCharacterPicker from "$lib/components/mission/MissionCharacterPicker.svelte";
  import CharacterMissionGrid from "$lib/components/mission/CharacterMissionGrid.svelte";
  import StoryMissionsCard from "$lib/components/mission/StoryMissionsCard.svelte";
  import { groupMissionsByFamily } from "$lib/components/mission/catalogue-groups";
  import {
    missionFamilies,
    type Mission,
    type MissionCharacterOption,
    type MissionFamily,
    type MissionResourceBoxDetail
  } from "$lib/domain/mission";
  import { formatCharacterMissionSentence } from "$lib/domain/character-growth";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { createPageTitle } from "$lib/page-title";
  import sourceMessages from "@platform/i18n-source/content-site/mission.json";
  import type { PageProps } from "./$types";

  type MissionPageResponse = {
    items: Mission[];
    pagination: {
      page: number;
      hasNext: boolean;
    };
  };
  let { data }: PageProps = $props();
  let resolvedMessages = $state<Record<string, string> | null>(null);
  type FamilySummaryState = {
    status: "loading" | "ready" | "error";
    items: Mission[];
    total: number | null;
  };

  type CharacterOptionsState = {
    status: "loading" | "ready" | "error";
    items: MissionCharacterOption[];
  };

  let items = $state<Mission[]>([]);
  let characterOptions = $state<CharacterOptionsState>({ status: "loading", items: [] });
  // Character lists by region, fetched once each; picking another character reuses them.
  // Deliberately not reactive: the load effect reads it, and a reactive map would rerun
  // that effect on every cache write.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const characterLists = new Map<string, Promise<MissionCharacterOption[]>>();
  // Not reactive: the effect below must not rerun when this changes.
  let characterListRegion: string | null = null;
  let familySummaries = $state<Partial<Record<MissionFamily, FamilySummaryState>>>({});
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isInitialLoading = $state(true);
  let isLoadingMore = $state(false);
  let initialError = $state(false);
  let loadMoreError = $state(false);
  let listRequestId = 0;

  const messages = $derived({
    ...sourceMessages,
    ...resolveStreamingMessages(data.i18nMessages, ["common"]),
    ...resolvedMessages
  });
  const t = $derived(createI18nTranslator(data.uiLocale, messages));
  const labels = $derived({
    title: t("navigation.missions"),
    home: t("home"),
    search: "",
    searchAction: "",
    loading: t("mission.loading"),
    empty: t("mission.empty"),
    error: t("mission.error"),
    retry: t("mission.retry"),
    previous: "",
    next: ""
  });
  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(data.uiLocale).format(value);
  const formatMissionTemplate = (value: string, requirement: number | null): string => {
    const replacement = requirement === null ? "…" : formatNumber(requirement);
    return value.replaceAll("{requirement}", replacement).replaceAll("{progress}", replacement);
  };
  const knownRewardTypes = new Set([
    "coin",
    "jewel",
    "gacha_ticket",
    "material",
    "honor",
    "bonds_honor",
    "virtual_coin"
  ]);
  const resourceLabel = (type: string | null): string =>
    type && knownRewardTypes.has(type) ? t(`mission.resource.${type}`) : t("mission.reward");
  const rewardsOf = (item: Mission) =>
    item.rewards
      .flatMap(
        (
          reward
        ): Pick<
          MissionResourceBoxDetail,
          | "resourceType"
          | "resourceId"
          | "resourceQuantity"
          | "resourceName"
          | "resourceAssetbundleName"
        >[] =>
          reward.resourceBox?.details.length
            ? reward.resourceBox.details
            : reward.resourceType
              ? [reward]
              : []
      )
      .map((detail) => ({
        detail,
        // Named items (tickets, materials) use their own name over the generic type label.
        label: detail.resourceName ?? resourceLabel(detail.resourceType),
        quantityLabel:
          detail.resourceQuantity === null ? null : `×${formatNumber(detail.resourceQuantity)}`
      }));
  // Story missions carry no text, so their target and rewards stand in for a sentence.
  const storyMissionText = (item: Mission, rewardLabels: string[]): string =>
    item.requirement === null
      ? t("mission.storyUnnamed").replace("{id}", formatNumber(item.id))
      : [
          t("mission.storyEpisodeGoal").replace("{count}", formatNumber(item.requirement)),
          ...rewardLabels
        ].join(" · ");
  const toItem = (item: Mission) => {
    const rewards = rewardsOf(item);
    const rewardLabels = rewards.map(({ label, quantityLabel }) =>
      quantityLabel ? `${label} ${quantityLabel}` : label
    );
    const fallbackSentence =
      item.family === "storyMissions" ? storyMissionText(item, rewardLabels) : t("mission.unnamed");
    const hasTargetTemplate =
      item.sentence?.includes("{requirement}") || item.sentence?.includes("{progress}");
    return {
      key: `${item.family}-${item.id}`,
      // A character mission spans many targets, so its sentence keeps a placeholder.
      sentence:
        item.family === "characterMissionV2s"
          ? formatCharacterMissionSentence(item.sentence ?? t("mission.unnamed"))
          : formatMissionTemplate(item.sentence ?? fallbackSentence, item.requirement),
      // Normal mission text already states its target; story text is built from it.
      requirementLabel:
        item.family === "normalMissions" && !item.sentence && item.requirement !== null
          ? t("mission.requirement").replace("{count}", formatNumber(item.requirement))
          : null,
      targetUnavailableLabel:
        item.family !== "characterMissionV2s" && item.requirement === null && hasTargetTemplate
          ? t("mission.targetUnavailable")
          : null,
      rewards
    };
  };
  const familyCountLabel = (summary: FamilySummaryState): string => {
    if (summary.status === "loading") return "";
    if (summary.total === null) return t("mission.totalUnavailable");
    return summary.total === 1
      ? t("mission.totalCountOne")
      : t("mission.totalCount").replace("{count}", formatNumber(summary.total));
  };
  const overviewGroups = $derived(
    missionFamilies.map((family) => {
      const summary = familySummaries[family] ?? { status: "loading", items: [], total: null };
      return {
        family,
        label: t(`mission.family.${family}`),
        status: summary.status,
        statusLabel: summary.status === "error" ? t("mission.error") : t("mission.loading"),
        countLabel: familyCountLabel(summary),
        browseLabel:
          summary.total === null
            ? t("mission.viewAll")
            : t("mission.viewAllWithCount").replace("{count}", formatNumber(summary.total)),
        browseAriaLabel: t("mission.browseFamily").replace(
          "{family}",
          t(`mission.family.${family}`)
        ),
        items: summary.items.slice(0, 3).map(toItem)
      };
    })
  );
  const overviewFailed = $derived(
    missionFamilies.every((family) => familySummaries[family]?.status === "error")
  );
  const missionKey = (mission: Mission): string => `${mission.family}-${mission.id}`;
  const queryParams = (
    family: MissionFamily | null,
    page?: number,
    character: number | null = null
  ): SvelteURLSearchParams => {
    const params = new SvelteURLSearchParams();
    if (page !== undefined) params.set("page", String(page));
    if (family) params.set("family", family);
    if (family === "characterMissionV2s" && character !== null) {
      params.set("character", String(character));
    }
    return params;
  };
  const listHref = (region: string): string => {
    const query = queryParams(data.query.family, undefined, data.query.character).toString();
    return `${resolve("/missions/[region]", { region })}${query ? `?${query}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listHref(region)
    }))
  );
  const navigateFamily = (family: MissionFamily | null, character: number | null = null): void => {
    const query = queryParams(family, undefined, character).toString();
    void goto(
      `${resolve("/missions/[region]", { region: data.region })}${query ? `?${query}` : ""}`,
      {
        keepFocus: true,
        noScroll: true
      }
    );
  };
  const selectCharacter = (character: number): void =>
    navigateFamily("characterMissionV2s", character);
  const isCharacterFamily = $derived(data.query.family === "characterMissionV2s");
  const dataHref = (page: number): string => {
    const query = queryParams(data.query.family, page, data.query.character).toString();
    return `${resolve("/missions/[region]/data", { region: data.region })}?${query}`;
  };
  const loadNextPage = async (): Promise<void> => {
    if (!browser || isLoadingMore || !hasNext) return;
    const requestId = listRequestId;
    isLoadingMore = true;
    loadMoreError = false;
    try {
      const response = await fetch(dataHref(currentPage + 1));
      if (!response.ok) throw new Error("Mission list request failed.");
      const next = (await response.json()) as MissionPageResponse;
      if (requestId !== listRequestId) return;
      const seenKeys = new SvelteSet(items.map(missionKey));
      const appendedItems = next.items.filter((item) => {
        const key = missionKey(item);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });
      items = [...items, ...appendedItems];
      currentPage = next.pagination.page;
      hasNext = next.pagination.hasNext;
    } catch {
      if (requestId === listRequestId) loadMoreError = true;
    } finally {
      if (requestId === listRequestId) isLoadingMore = false;
    }
  };

  const fetchCharacterList = (region: string): Promise<MissionCharacterOption[]> => {
    const cached = characterLists.get(region);
    if (cached) return cached;
    const request = fetch(resolve("/missions/[region]/characters", { region }))
      .then(async (response) => {
        if (!response.ok) throw new Error("Mission character list request failed.");
        return ((await response.json()) as { items: MissionCharacterOption[] }).items;
      })
      .catch((error: unknown) => {
        // Forget failures so a retry fetches again.
        characterLists.delete(region);
        throw error;
      });
    characterLists.set(region, request);
    return request;
  };
  const showCharacterList = (region: string): void => {
    characterListRegion = region;
    characterOptions = { status: "loading", items: [] };
    fetchCharacterList(region)
      .then((items) => {
        if (characterListRegion === region) characterOptions = { status: "ready", items };
      })
      .catch(() => {
        if (characterListRegion === region) characterOptions = { status: "error", items: [] };
      });
  };

  $effect(() => {
    // Tracks only the family and region, so choosing another character does not refetch.
    if (!browser || data.query.family !== "characterMissionV2s") return;
    const region = data.region;
    if (characterListRegion !== region) showCharacterList(region);
  });

  $effect(() => {
    const bundle = data.i18nMessages;
    let active = true;
    resolvedMessages = null;
    void Promise.resolve(bundle)
      .then((value) => {
        if (active) resolvedMessages = value;
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  });

  $effect(() => {
    const requestId = ++listRequestId;
    items = [];
    familySummaries = Object.fromEntries(
      data.familyOverviews.map(({ family }) => [
        family,
        { status: "loading", items: [], total: null }
      ])
    );
    currentPage = 1;
    hasNext = false;
    isInitialLoading = data.catalogue !== null;
    isLoadingMore = false;
    initialError = false;
    loadMoreError = false;

    for (const overview of data.familyOverviews) {
      // Runs only in promise callbacks, so reading familySummaries here is not tracked.
      const setSummary = (summary: FamilySummaryState): void => {
        if (requestId !== listRequestId) return;
        familySummaries = { ...familySummaries, [overview.family]: summary };
      };
      void Promise.resolve(overview.summary)
        .then((summary) =>
          setSummary({
            status: summary.loadFailed ? "error" : "ready",
            items: summary.items,
            total: summary.total
          })
        )
        .catch(() => setSummary({ status: "error", items: [], total: null }));
    }

    if (data.catalogue === null) return;
    void Promise.resolve(data.catalogue)
      .then((catalogue) => {
        if (requestId !== listRequestId) return;
        items = catalogue.items;
        currentPage = catalogue.pagination.page;
        hasNext = catalogue.pagination.hasNext;
        initialError = catalogue.loadFailed;
        isInitialLoading = false;
      })
      .catch(() => {
        if (requestId !== listRequestId) return;
        initialError = true;
        isInitialLoading = false;
      });
  });
</script>

<svelte:head
  ><title>{createPageTitle(`${t("navigation.missions")} ${regionLabels[data.region]}`)}</title
  ></svelte:head
>

{#snippet storyMissionsContent()}
  {#if data.storyMissions}
    <StoryMissionsCard
      missions={data.storyMissions}
      region={data.region}
      locale={data.uiLocale}
      {t}
      {resourceLabel}
      onRetry={() => void invalidateAll()}
    />
  {/if}
{/snippet}

{#snippet characterPrompt()}
  <p class="text-sm text-(--archive-text-muted)">
    {t("mission.characterPrompt")}
  </p>
{/snippet}

{#snippet characterPicker()}
  <MissionCharacterPicker
    characters={characterOptions.items}
    status={characterOptions.status}
    selectedId={data.query.character}
    getImageSrc={getLocalCharacterThumbnailAssetURL}
    labels={{
      title: t("mission.characterPickerTitle"),
      loading: t("mission.characterPickerLoading"),
      error: t("mission.characterPickerError"),
      retry: t("mission.retry"),
      otherGroup: t("mission.characterPickerOtherGroup"),
      change: t("mission.characterChange")
    }}
    onSelect={selectCharacter}
    onRetry={() => showCharacterList(data.region)}
  />
{/snippet}

{#snippet characterMissionGroup()}
  <CharacterMissionGrid
    missions={items.filter((mission) => mission.family === "characterMissionV2s")}
    tileSurface="shell"
    region={data.region}
    locale={data.uiLocale}
    labels={{
      extra: t("mission.characterExtra"),
      unnamed: t("mission.unnamed"),
      close: t("mission.close"),
      goalCount: t("mission.levelCount"),
      goalCountOne: t("mission.levelCountOne"),
      loading: t("mission.levelsLoading"),
      error: t("mission.levelsError"),
      unavailable: t("mission.targetUnavailable"),
      retry: t("mission.retry"),
      level: t("mission.targetLevel"),
      exp: t("mission.levelExp"),
      resourceLabel
    }}
  />
{/snippet}

<MissionCatalogue
  {labels}
  groupBody={isCharacterFamily ? characterMissionGroup : undefined}
  content={data.storyMissions
    ? storyMissionsContent
    : isCharacterFamily && data.query.character === null
      ? characterPrompt
      : undefined}
  filters={isCharacterFamily ? characterPicker : undefined}
  homeHref={resolve("/")}
  {regions}
  groups={!data.query.family
    ? overviewFailed
      ? []
      : overviewGroups
    : isInitialLoading || initialError
      ? []
      : groupMissionsByFamily(items).map((group) => ({
          family: group.family,
          label: t(`mission.family.${group.family}`),
          countLabel: t("mission.shownCount").replace("{count}", formatNumber(group.items.length)),
          items: group.items.map(toItem)
        }))}
  overview={!data.query.family}
  loadingGroupCount={1}
  status={!data.query.family
    ? overviewFailed
      ? "error"
      : "ready"
    : isInitialLoading
      ? "loading"
      : initialError
        ? "error"
        : "ready"}
  rewardsLabel={t("mission.rewards")}
  region={data.region}
  catalogueKey={`${data.region}:${data.query.family ?? "all"}:${data.query.character ?? ""}`}
  familyLabel={t("mission.familyLabel")}
  selectedFamily={data.query.family}
  getFamilyLabel={(family) => t(`mission.tab.${family ?? "all"}`)}
  onFamilyChange={navigateFamily}
  hasNext={Boolean(data.query.family) && !initialError && hasNext}
  {isLoadingMore}
  loadMoreLabel={t("mission.loadMore")}
  loadingMoreLabel={t("mission.loadingMore")}
  loadMoreError={loadMoreError ? t("mission.loadMoreError") : null}
  onLoadMore={() => void loadNextPage()}
  onRetryLoadMore={() => void loadNextPage()}
  onRetry={() => void invalidateAll()}
/>
