<script lang="ts">
  import { goto, invalidate, replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { SharedEventRewardRangeResponse } from "@platform/sekai-master-api-sdk";
  import { CardThumbnail, HonorDegree, resolveCardRarityCount } from "@platform/ui-shell";
  import { getHonorAssetURL, getLeaderCardAssetURL } from "$lib/event-assets";
  import { selectRewardHonor } from "$lib/reward-honor";
  import {
    getProfileCardLayers,
    toProfileHonorDegrees,
    type TrackerCardArt,
    type TrackerHonorLookup,
    type TrackerHonorMission,
    type TrackerLeaderCard,
    type TrackerProfileHonor,
    type TrackerProfileHonorDegree
  } from "$lib/tracker-player-profile";
  import Icon from "@iconify/svelte";
  import { onMount, tick, untrack } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import RankingHistoryChart from "$lib/components/RankingHistoryChart.svelte";
  import GoalProjectionChart from "$lib/components/GoalProjectionChart.svelte";
  import { getTrackerChapterCountdown, getTrackerCountdown } from "$lib/tracker-countdown";
  import { getTrackerRankLadder, type TrackerRankLadder } from "$lib/tracker-ladders";
  import {
    getNextTrackerRefreshDeadline,
    getTrackerPhase,
    parseTrackerTimestamp
  } from "$lib/tracker-phase";
  import { createTrackerRows, type TrackerRow } from "$lib/tracker-rows";
  import {
    calculateChapterRowSpeed,
    createChapterRows,
    type ChapterRow
  } from "$lib/tracker-chapter-rows";
  import { calculateRecentRates, sortTrackerRatePoints } from "$lib/tracker-rates";
  import {
    calculateTrackerGoalPlan,
    type TrackerGoalPlan,
    type TrackerGoalResult
  } from "$lib/tracker-goal";
  import { resolveTrackerEventId } from "$lib/tracker-event-identity";
  import type { EventRewardsResult } from "$lib/server/event-rewards";
  import type { EventTrackerResult } from "$lib/server/event-tracker";
  import type { ChapterTrackerResult } from "$lib/server/chapter-tracker";
  import type { WorldBloomMetadata, WorldBloomRankableChapter } from "$lib/server/world-bloom";
  import type { PageData } from "./$types";

  type EventMetadata = {
    id: number;
    name: string;
    startAt: string | number | null;
    aggregateAt: string | number | null;
    closedAt: string | number | null;
  };
  type CatalogStatus = "available" | "sdk-error" | "network-error" | "invalid-data";
  type EventSearchResponse = {
    status: CatalogStatus;
    events: EventMetadata[];
  };
  type Catalog = {
    status: CatalogStatus;
    currentStatus: CatalogStatus;
    selectedStatus: CatalogStatus;
    currentEvent: EventMetadata | null;
    selectedEvent: EventMetadata | null;
  };
  type TrackerPageReady = {
    catalog: Catalog | null;
    trackerResult: EventTrackerResult;
    resolvedEventId: number | null;
  };
  type GraphPoint = {
    rank: number;
    score: number;
    timestamp: string | null;
    userId: string | null | undefined;
    userName: string | null | undefined;
  };
  type RankingContext = { chapterId: number; chapterNo: number; charaId: number } | null;
  type TimePointGroup = {
    id: number;
    day: number;
    points: Array<{ timestamp: string; index: number }>;
  };
  type SnapshotLocalDateGroup = {
    label: string;
    points: TimePointGroup["points"];
  };
  type TimeTravelStatus =
    | "idle"
    | "loading"
    | "available"
    | "unavailable"
    | "sdk-error"
    | "network-error"
    | "invalid-data";
  type ExtendedData = PageData & {
    trackerResult?: Promise<EventTrackerResult>;
    catalog?: Promise<Catalog | null>;
    trackerReady?: Promise<TrackerPageReady>;
    rewards?: Promise<EventRewardsResult | null>;
    chapters?: Promise<{
      metadata: WorldBloomMetadata | null;
      rankings: Array<{
        chapter: WorldBloomRankableChapter;
        result: ChapterTrackerResult;
      }>;
    } | null>;
    status?: string;
    isWorldBloom?: boolean | Promise<boolean>;
  };

  let { data }: { data: ExtendedData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "tracker"]);
  let messages = $state(fallbackMessages);
  let ladder = $state<TrackerRankLadder>("critical");
  let now = $state(Date.now());
  let hasMounted = $state(false);
  let trackerResult = $state<EventTrackerResult | null>(null);
  let trackerPageReady = $state<TrackerPageReady | null>(null);
  let trackerRequestIdentity = $state<string | null>(null);
  let catalog = $state<Catalog | null>(null);
  let eventQuery = $state("");
  let eventSearchStatus = $state<"idle" | "loading" | CatalogStatus>("idle");
  let eventSearchEvents = $state<EventMetadata[]>([]);
  let isEventPickerOpen = $state(false);
  let isEventPickerFocused = $state(false);
  let activeEventIndex = $state(-1);
  let rewards = $state<EventRewardsResult | null>(null);
  let chapters = $state<Awaited<ExtendedData["chapters"]> | null>(null);
  let selectedChapterId = $state<number | null>(null);
  let selectedRankingTab = $state<"event" | number>("event");
  let selectedChapterRows = $state<ChapterRow[]>([]);
  let isTimeTravelActive = $state(false);
  let timePoints = $state<string[]>([]);
  let timePointsStatus = $state<TimeTravelStatus>("idle");
  let timePointIndex = $state(0);
  let snapshotRankings = $state<EventTrackerResult["rankings"] | null>(null);
  let snapshotTimestamp = $state<string | null>(null);
  let snapshotStatus = $state<TimeTravelStatus>("idle");
  let selectedRow = $state<TrackerRow<SharedEventRewardRangeResponse> | null>(null);
  let selectedRankingContext = $state<RankingContext>(null);
  let graphPoints = $state<GraphPoint[]>([]);
  let activeGraphPoint = $state<GraphPoint | null>(null);
  let graphMode = $state<"snapshot" | "trend">("snapshot");
  let graphStatus = $state<"idle" | "loading" | "available" | "empty" | "error">("idle");
  let goalTargetRank = $state<number | null>(null);
  let goalCurrentScore = $state<number | null>(null);
  let goalSafetyMarginPoints = $state<number | null>(1_000);
  let goalAvailablePlayHours = $state<number | null | undefined>(null);
  let goalResult = $state<TrackerGoalResult | null>(null);
  let shareMessage = $state("");
  let isRefreshing = $state(false);
  let eventPickerInput = $state<HTMLInputElement>();
  let goalOpenButton = $state<HTMLButtonElement>();
  let goalTargetRankControl = $state<HTMLSelectElement>();
  let goalDialog = $state<HTMLDialogElement>();
  let detailsDialog = $state<HTMLDialogElement>();
  const eventSearchCache = new SvelteMap<string, EventSearchResponse>();
  const eventSearchInFlight = new SvelteMap<string, Promise<EventSearchResponse>>();
  let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
  let eventSearchTimer: number | undefined;
  let eventSearchRequestToken = 0;
  let shareMessageTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshTimer: number | undefined;
  let refreshedDeadline: number | null = null;
  let timePointsRequestToken = 0;
  let snapshotRequestToken = 0;
  let graphRequestToken = 0;
  let graphIdentity: { eventId: number; rank: number } | null = null;
  let observedEventKey: number | null = null;
  let chapterRequestToken = 0;
  let isDetailsIdentityVisible = $state(false);
  let detailsModalBox = $state<HTMLDivElement>();
  let detailsPlayerEntry = $state<HTMLElement>();
  let detailsIdentityObserver: IntersectionObserver | undefined;

  const extendedData = $derived(data as ExtendedData);
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const trackerPath = $derived(resolve("/tracker/[region]", { region: data.region }));
  const trackerStatus = $derived(trackerResult?.status ?? null);
  const rankingErrorKey = $derived(
    trackerStatus === "upstream-error"
      ? "tracker.error.historyUpstream"
      : trackerStatus === "sdk-error"
        ? "tracker.error.sdk"
        : trackerStatus === "network-error"
          ? "tracker.error.network"
          : "tracker.error.invalidData"
  );
  const isTrackerLoading = $derived(trackerResult === null);
  const trackerIdentity = $derived(
    `${data.region}:${data.selectionStatus}:${data.selection.eventId ?? "live"}`
  );
  const queryEventId = $derived.by(() => {
    // This route's `selection` field may be shadowed by the parent layout's
    // live selection in PageData, so the browser URL is authoritative here.
    const value =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("eventId");
    if (!value || !/^\d+$/.test(value)) return null;
    const eventId = Number(value);
    return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : null;
  });
  const isExplicitSelection = $derived(queryEventId !== null || data.selection.eventId !== null);
  const formatEventLabel = (eventId: number, eventName?: string | null): string =>
    eventName ? `#${eventId} — ${eventName}` : `#${eventId}`;
  const matchingEvents = $derived.by(() => {
    const query = eventQuery.trim().toLocaleLowerCase();
    const events = eventSearchEvents;
    return query
      ? events.filter((event) => `${event.name} ${event.id}`.toLocaleLowerCase().includes(query))
      : events;
  });
  const visibleMatchingEvents = $derived(matchingEvents.slice(0, 10));
  const eventSearchMessage = $derived(
    eventSearchStatus === "loading"
      ? translate("tracker.loadingMetadata")
      : eventSearchStatus === "available"
        ? visibleMatchingEvents.length
          ? ""
          : translate("tracker.unavailable")
        : eventSearchStatus === "idle"
          ? ""
          : translate(`tracker.metadataError.${eventSearchStatus}`)
  );
  const isInvalidSelection = $derived(data.selectionStatus === "invalid-event-id");
  // The server streams both requests, but the tracker body must not consume
  // either result until the shared readiness promise has settled.
  const isMetadataLoading = $derived(!isInvalidSelection && trackerPageReady === null);
  const eventKey = $derived(
    resolveTrackerEventId({
      selectedEventId: queryEventId ?? data.selection.eventId,
      resultSelectionEventId:
        trackerResult?.selection.mode === "history" ? trackerResult.selection.eventId : null,
      catalogCurrentEventId: trackerPageReady?.resolvedEventId ?? null
    })
  );
  const selectedEvent = $derived.by(() => {
    if (eventKey === null) return null;
    const event = isExplicitSelection ? catalog?.selectedEvent : catalog?.currentEvent;
    return event?.id === eventKey ? event : null;
  });
  const pickerValue = $derived(
    eventKey === null ? "" : formatEventLabel(eventKey, selectedEvent?.name)
  );
  const currentEventId = $derived(
    !isExplicitSelection
      ? (trackerPageReady?.resolvedEventId ?? null)
      : (catalog?.currentEvent?.id ?? null)
  );
  const currentMetadataUnavailable = $derived(
    catalog !== null && (catalog.currentStatus !== "available" || catalog.currentEvent === null)
  );
  const isCurrentEventKnown = $derived(currentEventId !== null);
  const isCurrentEvent = $derived(
    isCurrentEventKnown && eventKey !== null && currentEventId === eventKey
  );
  const isHistoricalEvent = $derived(
    isExplicitSelection && !isCurrentEvent && (isCurrentEventKnown || currentMetadataUnavailable)
  );
  const phase = $derived(
    getTrackerPhase({
      startAt: selectedEvent?.startAt,
      aggregateAt: selectedEvent?.aggregateAt,
      now
    })
  );
  const activityLabel = $derived(
    isHistoricalEvent
      ? translate("tracker.historical")
      : currentMetadataUnavailable || !isCurrentEvent
        ? translate("tracker.phaseUnavailable")
        : phase === "live"
          ? translate("tracker.live")
          : phase === "finished"
            ? translate("tracker.savedRankings")
            : translate("tracker.phaseUnavailable")
  );
  const countdown = $derived(
    isCurrentEvent
      ? getTrackerCountdown({
          startAt: selectedEvent?.startAt,
          aggregateAt: selectedEvent?.aggregateAt,
          closedAt: selectedEvent?.closedAt,
          now
        })
      : null
  );
  const countdownLabel = $derived(
    countdown?.mode === "ends"
      ? translate("tracker.countdownEndsIn")
      : translate("tracker.countdownStartsIn")
  );
  const displayRankings = $derived(snapshotRankings ?? trackerResult?.rankings ?? []);
  const getReward = (rank: number): SharedEventRewardRangeResponse | null =>
    rewards?.status === "available"
      ? (rewards.items.find((reward) => {
          const fromRank = reward.fromRank;
          const toRank = reward.toRank;
          return (
            typeof fromRank === "number" &&
            typeof toRank === "number" &&
            rank >= fromRank &&
            rank <= toRank
          );
        }) ?? null)
      : null;
  const rows = $derived(
    createTrackerRows({
      ladderRanks: getTrackerRankLadder(ladder),
      rankings: displayRankings,
      startAt: selectedEvent?.startAt,
      getReward
    })
  );
  const chapterIsCurrent = (chapter: WorldBloomMetadata["chapters"][number]): boolean => {
    const startAt = parseTrackerTimestamp(chapter.chapterStartAt);
    const endAt = parseTrackerTimestamp(chapter.chapterEndAt);
    return startAt !== null && now >= startAt && (endAt === null || now < endAt);
  };
  const selectedChapter = $derived(
    chapters?.rankings.find(({ chapter }) => chapter.id === selectedChapterId) ??
      chapters?.rankings.find(({ chapter }) => chapterIsCurrent(chapter)) ??
      chapters?.rankings[0] ??
      null
  );
  const currentChapter = $derived(
    chapters?.rankings.find(({ chapter }) => chapterIsCurrent(chapter)) ??
      chapters?.rankings
        .filter(({ chapter }) => {
          const startAt = parseTrackerTimestamp(chapter.chapterStartAt);
          return startAt !== null && startAt <= now;
        })
        .at(-1) ??
      chapters?.rankings[0] ??
      null
  );
  let isWorldBloom = $state(false);
  const chapterRows = $derived<TrackerRow<SharedEventRewardRangeResponse>[]>(
    selectedChapterRows.map((row) => ({
      ladderRank: row.rank,
      status: row.status,
      ranking: row,
      score: row.score,
      speedPerHour: calculateChapterRowSpeed({
        score: row.score,
        startAt: selectedChapter?.chapter.chapterStartAt,
        timestamp: row.timestamp
      }),
      reward: getReward(row.rank),
      graphPoint:
        row.score === null ? null : { rank: row.rank, score: row.score, timestamp: row.timestamp }
    }))
  );
  const activeRankingRows = $derived(
    selectedRankingTab === "event" || !selectedChapter ? rows : chapterRows
  );
  const goalRankOptions = $derived(
    activeRankingRows.filter(
      (row) =>
        row.status === "available" &&
        row.score !== null &&
        parseTrackerTimestamp(row.ranking?.timestamp) !== null
    )
  );
  const goalLineRow = $derived(
    goalRankOptions.find((row) => row.ladderRank === goalTargetRank) ?? null
  );
  const goalLineRowCapturedAt = $derived(parseTrackerTimestamp(goalLineRow?.ranking?.timestamp));
  const goalLineCapturedAt = $derived(goalLineRowCapturedAt);
  const goalTargetRate = $derived(goalLineRow?.speedPerHour ?? null);
  const goalCurrentScoreValid = $derived(
    goalCurrentScore !== null && Number.isSafeInteger(goalCurrentScore) && goalCurrentScore >= 0
  );
  const goalSafetyMarginValid = $derived(
    goalSafetyMarginPoints !== null &&
      Number.isSafeInteger(goalSafetyMarginPoints) &&
      goalSafetyMarginPoints >= 0
  );
  const goalAvailablePlayHoursValid = $derived(
    goalAvailablePlayHours === null ||
      goalAvailablePlayHours === undefined ||
      (Number.isFinite(goalAvailablePlayHours) && goalAvailablePlayHours >= 0)
  );
  const goalChapterIsLive = $derived.by(() => {
    if (selectedRankingTab === "event") return true;
    const chapter = selectedChapter?.chapter;
    if (!chapter) return false;
    const startAt = parseTrackerTimestamp(chapter.chapterStartAt);
    const deadlineAt = parseTrackerTimestamp(chapter.aggregateAt ?? chapter.chapterEndAt);
    return startAt !== null && deadlineAt !== null && startAt <= now && now < deadlineAt;
  });
  const goalDeadlineAt = $derived.by(() => {
    if (!isCurrentEvent || snapshotTimestamp !== null || phase !== "live" || !goalChapterIsLive)
      return null;
    const deadline =
      selectedRankingTab === "event"
        ? selectedEvent?.aggregateAt
        : (selectedChapter?.chapter.aggregateAt ?? selectedChapter?.chapter.chapterEndAt);
    const deadlineAt = parseTrackerTimestamp(deadline);
    return deadlineAt !== null && deadlineAt > now ? deadlineAt : null;
  });
  const goalCanUseLiveData = $derived(
    trackerStatus === "available" &&
      goalDeadlineAt !== null &&
      goalLineRow !== null &&
      goalLineCapturedAt !== null
  );
  const goalHasTargetRate = $derived(goalTargetRate !== null && Number.isFinite(goalTargetRate));
  const goalPlan = $derived<TrackerGoalPlan | null>(
    goalCanUseLiveData &&
      goalCurrentScoreValid &&
      goalSafetyMarginValid &&
      goalAvailablePlayHoursValid &&
      goalHasTargetRate &&
      goalResult?.status === "ready"
      ? goalResult
      : null
  );
  const goalCanSubmit = $derived(
    goalCanUseLiveData &&
      goalHasTargetRate &&
      goalCurrentScoreValid &&
      goalSafetyMarginValid &&
      goalAvailablePlayHoursValid
  );
  const activeRankingContext = $derived<RankingContext>(
    selectedRankingTab === "event" || !selectedChapter
      ? null
      : {
          chapterId: selectedChapter.chapter.id,
          chapterNo: selectedChapter.chapter.chapterNo,
          charaId: selectedChapter.chapter.gameCharacterId
        }
  );
  const handleRankingTabKeydown = (event: KeyboardEvent, index: number): void => {
    const tabCount = (chapters?.rankings.length ?? 0) + 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabCount;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabCount) % tabCount;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabCount - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    if (nextIndex === 0) {
      selectRankingTab("event");
      document.getElementById("tracker-event-ranking-tab")?.focus();
    } else {
      const chapter = chapters?.rankings[nextIndex - 1];
      if (chapter) {
        selectRankingTab(chapter.chapter.id);
        document.getElementById(`tracker-chapter-tab-${chapter.chapter.id}`)?.focus();
      }
    }
  };
  const chapterCountdown = $derived(
    selectedChapter
      ? getTrackerChapterCountdown({
          currentStartAt: selectedChapter.chapter.chapterStartAt,
          nextStartAt:
            chapters?.rankings[
              chapters.rankings.findIndex(
                ({ chapter }) => chapter.id === selectedChapter.chapter.id
              ) + 1
            ]?.chapter.chapterStartAt ?? null,
          currentEndAt: selectedChapter.chapter.aggregateAt ?? selectedChapter.chapter.chapterEndAt,
          now
        })
      : null
  );
  const selectRankingTab = (tab: "event" | number): void => {
    selectedRankingTab = tab;
    if (typeof tab === "number") selectedChapterId = tab;
    else selectedChapterId = null;
    goalResult = null;
    goalTargetRank = goalRankOptions[0]?.ladderRank ?? null;
  };
  const nextRefreshAt = $derived(
    isCurrentEvent && phase !== "upcoming"
      ? getNextTrackerRefreshDeadline({ aggregateAt: selectedEvent?.aggregateAt ?? null, now })
      : null
  );
  const nextRefreshSeconds = $derived(
    nextRefreshAt === null ? null : Math.max(0, Math.ceil((nextRefreshAt - now) / 1000))
  );
  const selectedTimePoint = $derived(timePoints[timePointIndex] ?? null);
  const rankingLoading = $derived(isRefreshing || snapshotStatus === "loading");
  const sortedGraphPoints = $derived(sortTrackerRatePoints(graphPoints));
  const recentRateTarget = $derived(activeGraphPoint ?? sortedGraphPoints.at(-1) ?? null);
  const recentRates = $derived(calculateRecentRates(graphPoints, recentRateTarget));

  const rankTier = (rank: number): "top" | "elite" | "high" | "mid" | "long" =>
    rank === 1
      ? "top"
      : rank <= 10
        ? "elite"
        : rank <= 100
          ? "high"
          : rank <= 1000
            ? "mid"
            : "long";
  const rankTierLabel = (rank: number): string => translate(`tracker.tier.${rankTier(rank)}`);

  const formatNumber = (value: number | null): string =>
    value === null
      ? translate("tracker.unavailable")
      : new Intl.NumberFormat(data.uiLocale).format(value);
  const formatSpeed = (value: number | null): string =>
    value === null
      ? translate("tracker.speedUnavailable")
      : `${new Intl.NumberFormat(data.uiLocale, { maximumFractionDigits: 0 }).format(value)} /h`;
  const formatGoalNumber = (value: number, maximumFractionDigits = 1): string =>
    new Intl.NumberFormat(data.uiLocale, {
      maximumFractionDigits,
      minimumFractionDigits: 0
    }).format(value);
  const formatGoalApproxNumber = (value: number, maximumFractionDigits = 1): string =>
    interpolate("tracker.goalApproxValue", {
      value: formatGoalNumber(value, maximumFractionDigits)
    });
  const formatGoalRate = (value: number): string =>
    interpolate("tracker.goalApproxRate", { value: formatGoalNumber(value) });
  const formatGoalDaily = (value: number): string =>
    interpolate("tracker.goalApproxDaily", { value: formatGoalNumber(value) });
  const formatTimestamp = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return translate("tracker.unavailable");
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? translate("tracker.unavailable")
      : new Intl.DateTimeFormat(data.uiLocale, {
          dateStyle: "medium",
          timeStyle: "short",
          // Keep SSR deterministic, then show the ranking timestamp in the viewer's local time.
          timeZone: hasMounted ? undefined : "UTC"
        }).format(date);
  };
  const formatSnapshotDate = (value: string): string | null => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat(data.uiLocale, {
          dateStyle: "medium",
          timeZone: hasMounted ? undefined : "UTC"
        }).format(date);
  };
  const formatSnapshotGroupLabel = (value: string): string | null => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat(data.uiLocale, {
          dateStyle: "medium",
          timeZone: hasMounted ? undefined : "UTC"
        }).format(date);
  };
  const formatSnapshotOption = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? translate("tracker.unavailable")
      : new Intl.DateTimeFormat(data.uiLocale, {
          timeStyle: "short",
          timeZone: hasMounted ? undefined : "UTC"
        }).format(date);
  };
  const timePointGroups = $derived.by<TimePointGroup[]>(() => {
    const eventStart = parseTrackerTimestamp(selectedEvent?.startAt);
    const groups: TimePointGroup[] = [];
    for (const [index, timestamp] of timePoints.entries()) {
      const pointAt = parseTrackerTimestamp(timestamp);
      // A day is a continuous 24-hour event interval; local midnight is display-only.
      const day =
        eventStart !== null && pointAt !== null
          ? Math.max(1, Math.floor((pointAt - eventStart) / 86_400_000) + 1)
          : index + 1;
      const group = groups.at(-1);
      if (group?.day === day) group.points.push({ timestamp, index });
      else groups.push({ id: groups.length, day, points: [{ timestamp, index }] });
    }
    return groups;
  });
  const selectedTimePointGroup = $derived(
    timePointGroups.find((group) => group.points.some((point) => point.index === timePointIndex)) ??
      timePointGroups.at(-1) ??
      null
  );
  const selectedTimePointLocalDateGroups = $derived.by<SnapshotLocalDateGroup[]>(() => {
    const groups: SnapshotLocalDateGroup[] = [];
    for (const point of selectedTimePointGroup?.points ?? []) {
      const label = formatSnapshotGroupLabel(point.timestamp) ?? translate("tracker.unavailable");
      const group = groups.at(-1);
      if (group?.label === label) group.points.push(point);
      else groups.push({ label, points: [point] });
    }
    return groups;
  });
  const formatActivityDay = (group: TimePointGroup): string => {
    const start = group.points[0]?.timestamp;
    const end = group.points.at(-1)?.timestamp;
    const startDate = start ? formatSnapshotDate(start) : null;
    const endDate = end ? formatSnapshotDate(end) : null;
    const label = interpolate("tracker.activityDay", { day: group.day });
    return startDate && endDate && startDate !== endDate
      ? `${label} · ${startDate}–${endDate}`
      : label;
  };
  const interpolate = (key: string, values: Record<string, string | number>): string =>
    Object.entries(values).reduce(
      (message, [name, value]) => message.replace(`{${name}}`, String(value)),
      translate(key)
    );
  const endpoint = (path: string, params: Record<string, string>): string =>
    `${trackerPath}/${path}?${new URLSearchParams(params)}`;
  async function fetchJsonWithDeadline<Payload>(url: string): Promise<{
    response: Response;
    payload: Payload;
  }> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const payload = (await response.json()) as Payload;
      return { response, payload };
    } finally {
      window.clearTimeout(timeout);
    }
  }
  const isCatalogStatus = (value: unknown): value is CatalogStatus =>
    value === "available" ||
    value === "sdk-error" ||
    value === "network-error" ||
    value === "invalid-data";
  const isEventMetadata = (value: unknown): value is EventMetadata => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const event = value as Record<string, unknown>;
    return (
      typeof event.id === "number" &&
      Number.isSafeInteger(event.id) &&
      event.id > 0 &&
      typeof event.name === "string"
    );
  };
  const parseEventSearchResponse = (payload: unknown): EventSearchResponse => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { status: "invalid-data", events: [] };
    }
    const source = payload as Record<string, unknown>;
    const status = isCatalogStatus(source.status) ? source.status : "invalid-data";
    const events = Array.isArray(source.events)
      ? source.events.filter((event): event is EventMetadata => isEventMetadata(event))
      : [];
    return { status, events };
  };
  const eventSearchKey = (query: string): string =>
    `${data.region}:${query.trim().toLocaleLowerCase()}`;
  const requestEventSearch = (query: string): Promise<EventSearchResponse> => {
    const key = eventSearchKey(query);
    const cached = eventSearchCache.get(key);
    if (cached) return Promise.resolve(cached);
    const existing = eventSearchInFlight.get(key);
    if (existing) return existing;

    const request = fetchJsonWithDeadline<unknown>(endpoint("events", { query }))
      .then(({ response, payload }) =>
        response.ok
          ? parseEventSearchResponse(payload)
          : ({ status: "network-error", events: [] } satisfies EventSearchResponse)
      )
      .catch((): EventSearchResponse => ({ status: "network-error", events: [] }))
      .then((result) => {
        if (result.status === "available") eventSearchCache.set(key, result);
        return result;
      });
    eventSearchInFlight.set(key, request);
    void request
      .finally(() => {
        if (eventSearchInFlight.get(key) === request) eventSearchInFlight.delete(key);
      })
      .catch(() => undefined);
    return request;
  };
  const loadEventSearch = async (query: string, requestToken: number): Promise<void> => {
    const result = await requestEventSearch(query);
    if (requestToken !== eventSearchRequestToken || eventQuery.trim() !== query) return;
    eventSearchEvents = result.events;
    eventSearchStatus = result.status;
    isEventPickerOpen = true;
    activeEventIndex = -1;
  };
  const isPositiveEventIdQuery = (value: string): boolean => /^[1-9]\d*$/.test(value);
  const scheduleEventSearch = (value: string): void => {
    if (eventSearchTimer !== undefined) window.clearTimeout(eventSearchTimer);
    const requestToken = ++eventSearchRequestToken;
    const query = value.trim();
    eventSearchEvents = [];
    eventSearchStatus = "idle";
    if (!query) {
      isEventPickerOpen = false;
      return;
    }

    isEventPickerOpen = true;
    eventSearchStatus = "loading";
    eventSearchTimer = window.setTimeout(
      () => {
        eventSearchTimer = undefined;
        void loadEventSearch(query, requestToken);
      },
      isPositiveEventIdQuery(query) ? 0 : 220
    );
  };
  const isTimeTravelStatus = (
    value: unknown
  ): value is Exclude<TimeTravelStatus, "idle" | "loading"> =>
    value === "available" ||
    value === "unavailable" ||
    value === "sdk-error" ||
    value === "network-error" ||
    value === "invalid-data";
  const timeTravelMessage = (
    status: TimeTravelStatus,
    subject: "timePoint" | "snapshot"
  ): string =>
    status === "unavailable"
      ? translate(`tracker.${subject}Unavailable`)
      : translate(`tracker.${subject}Error.${status}`);
  const navigateToEvent = (eventId: number | null): void => {
    eventSearchRequestToken += 1;
    if (eventSearchTimer !== undefined) window.clearTimeout(eventSearchTimer);
    eventSearchTimer = undefined;
    isEventPickerOpen = false;
    isEventPickerFocused = false;
    activeEventIndex = -1;
    void goto(
      eventId === null
        ? trackerPath
        : `${trackerPath}?${new URLSearchParams({ eventId: String(eventId) })}`
    );
  };
  const selectEvent = (event: EventMetadata): void => {
    eventQuery = formatEventLabel(event.id, event.name);
    navigateToEvent(event.id);
  };
  const handleEventPickerInput = (value: string): void => {
    eventQuery = value;
    activeEventIndex = -1;
    scheduleEventSearch(value);
  };
  const clearEventSearch = (): void => {
    eventQuery = "";
    scheduleEventSearch("");
    activeEventIndex = -1;
    isEventPickerFocused = true;
    eventPickerInput?.focus();
  };
  const handleEventPickerKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      isEventPickerOpen = false;
      activeEventIndex = -1;
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (eventSearchStatus !== "available" || !visibleMatchingEvents.length) return;
      event.preventDefault();
      isEventPickerOpen = true;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      activeEventIndex = visibleMatchingEvents.length
        ? (activeEventIndex + direction + visibleMatchingEvents.length) %
          visibleMatchingEvents.length
        : -1;
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const activeEvent = activeEventIndex >= 0 ? visibleMatchingEvents[activeEventIndex] : null;
    if (activeEvent) {
      selectEvent(activeEvent);
      return;
    }
    const trimmedQuery = eventQuery.trim();
    if (!trimmedQuery) {
      navigateToEvent(null);
      return;
    }
    if (isPositiveEventIdQuery(trimmedQuery)) navigateToEvent(Number(trimmedQuery));
  };
  const formatRewardRange = (reward: SharedEventRewardRangeResponse | null): string => {
    return selectRewardHonor(reward).label ?? translate("tracker.degreeUnavailable");
  };
  const resolveHonorAsset = (bundlePath: string, resourceName: string): string | null =>
    getHonorAssetURL(bundlePath, resourceName, data.region);
  const getRewardHonorMedia = (reward: SharedEventRewardRangeResponse | null) => {
    const honor = selectRewardHonor(reward).honor;
    if (!honor) return null;
    const bodyBundle =
      honor.kind === "rank-match"
        ? `rank_live/honor/${honor.backgroundAssetBundleName ?? honor.assetBundleName}`
        : `honor/${honor.assetBundleName}`;
    return resolveHonorAsset(bodyBundle, "degree_main.png") ? honor : null;
  };
  /** The reward title's art replaces its text label; the text stays as a fallback. */
  const hasRewardHonorMedia = (reward: SharedEventRewardRangeResponse | null): boolean =>
    getRewardHonorMedia(reward) !== null;
  const refresh = async (): Promise<void> => {
    isRefreshing = true;
    try {
      await invalidate("tools-site:tracker:rankings");
    } finally {
      isRefreshing = false;
    }
  };
  const createTrackerNetworkFailure = (): EventTrackerResult => ({
    selection:
      data.selection.eventId === null
        ? { mode: "live", eventId: null }
        : { mode: "history", eventId: data.selection.eventId },
    loadedAt: null,
    status: "network-error",
    rankings: []
  });
  const createCatalogNetworkFailure = (): Catalog => ({
    status: "network-error",
    currentStatus: "network-error",
    selectedStatus: "network-error",
    currentEvent: null,
    selectedEvent: null
  });
  const toNumber = (value: unknown): number | null => {
    const parsed =
      typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const normalizePoint = (value: unknown, rank: number): GraphPoint | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const score = toNumber(record.score ?? record.eventPoint ?? record.rankingScore);
    return score === null
      ? null
      : {
          rank: toNumber(record.rank ?? record.ranking) ?? rank,
          score,
          timestamp: typeof record.timestamp === "string" ? record.timestamp : null,
          userId: typeof record.userId === "string" ? record.userId : null,
          userName: typeof record.userName === "string" ? record.userName : null
        };
  };
  const fetchGraphPoints = async (
    eventId: number,
    rank: number,
    timestamp?: string,
    context: RankingContext = null
  ): Promise<GraphPoint[]> => {
    const params: Record<string, string> = { eventId: String(eventId), rank: String(rank) };
    if (timestamp) params.timestamp = timestamp;
    if (context) params.charaId = String(context.charaId);
    const { response, payload } = await fetchJsonWithDeadline<{
      status?: string;
      points?: unknown;
    }>(endpoint("graph", params));
    if (!response.ok || payload.status !== "available" || !Array.isArray(payload.points))
      throw new Error("Ranking graph unavailable");
    return payload.points
      .map((point) => normalizePoint(point, rank))
      .filter((point): point is GraphPoint => point !== null);
  };
  const disconnectDetailsIdentityObserver = (): void => {
    detailsIdentityObserver?.disconnect();
    detailsIdentityObserver = undefined;
  };
  const observeDetailsIdentity = (): void => {
    disconnectDetailsIdentityObserver();
    if (typeof IntersectionObserver === "undefined" || !detailsModalBox || !detailsPlayerEntry)
      return;
    detailsIdentityObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry) isDetailsIdentityVisible = !entry.isIntersecting;
      },
      { root: detailsModalBox, threshold: 0 }
    );
    detailsIdentityObserver.observe(detailsPlayerEntry);
  };
  // Leader card art for avatars by `{region}:{cardId}`; null once looked up and missing.
  const cardArtByKey = new SvelteMap<string, TrackerCardArt | null>();
  const requestedCardKeys = new SvelteSet<string>();
  const cardArtKey = (cardId: number): string => `${data.region}:${cardId}`;
  // Card art is shared across regions and the JP bucket is the most complete (TW and KR lack
  // many thumbnails), so it loads first with the page's region as the fallback, as in
  // content-site's card lists.
  const getLeaderCardFallbackURL = (
    variant: "thumbnail" | "member-small",
    assetBundleName: string,
    trained: boolean
  ): string | null =>
    data.region === "jp"
      ? null
      : getLeaderCardAssetURL(variant, assetBundleName, trained, data.region);
  const getCardArt = (leaderCard: TrackerLeaderCard | null | undefined): TrackerCardArt | null =>
    leaderCard ? (cardArtByKey.get(cardArtKey(leaderCard.cardId)) ?? null) : null;
  const loadCardArt = async (ids: number[]): Promise<void> => {
    const keys = ids.map(cardArtKey);
    try {
      const { response, payload } = await fetchJsonWithDeadline<{ cards?: unknown }>(
        endpoint("cards", { ids: ids.join(",") })
      );
      if (!response.ok || !Array.isArray(payload.cards)) throw new Error("Card lookup failed");
      const cards = payload.cards as TrackerCardArt[];
      ids.forEach((id, index) =>
        cardArtByKey.set(keys[index], cards.find((card) => card.id === id) ?? null)
      );
    } catch {
      // Avatars keep their placeholder; the next ranking update retries these cards.
      for (const key of keys) requestedCardKeys.delete(key);
    }
  };
  $effect(() => {
    const ids = [
      ...new Set(
        activeRankingRows.flatMap((row) =>
          row.status === "available" && row.ranking?.leaderCard
            ? [row.ranking.leaderCard.cardId]
            : []
        )
      )
    ].filter((id) => untrack(() => !requestedCardKeys.has(cardArtKey(id))));
    if (ids.length === 0) return;
    untrack(() => {
      for (const id of ids) requestedCardKeys.add(cardArtKey(id));
    });
    void loadCardArt(ids);
  });

  let profileHonorStatus = $state<"idle" | "loading" | "available" | "error">("idle");
  let profileHonorDegrees = $state<TrackerProfileHonorDegree[]>([]);
  let profileHonorRequestToken = 0;
  const loadProfileHonors = async (
    profileHonors: readonly TrackerProfileHonor[] = selectedRow?.ranking?.profileHonors ?? [],
    honorMissions: readonly TrackerHonorMission[] = selectedRow?.ranking?.honorMissions ?? []
  ): Promise<void> => {
    const requestToken = ++profileHonorRequestToken;
    profileHonorDegrees = [];
    if (profileHonors.length === 0) {
      profileHonorStatus = "available";
      return;
    }
    profileHonorStatus = "loading";
    const idsOf = (kind: TrackerProfileHonor["kind"]): string =>
      profileHonors
        .filter((honor) => honor.kind === kind)
        .map((honor) => honor.honorId)
        .join(",");
    try {
      const { response, payload } = await fetchJsonWithDeadline<
        Partial<TrackerHonorLookup> & { status?: unknown }
      >(endpoint("honors", { honors: idsOf("normal"), bonds: idsOf("bonds") }));
      if (requestToken !== profileHonorRequestToken) return;
      if (!response.ok || payload.status !== "available") throw new Error("Title lookup failed");
      profileHonorDegrees = toProfileHonorDegrees(
        profileHonors,
        {
          honors: Array.isArray(payload.honors) ? payload.honors : [],
          bondsHonors: Array.isArray(payload.bondsHonors) ? payload.bondsHonors : [],
          bondsViewData: payload.bondsViewData ?? null
        },
        honorMissions
      );
      profileHonorStatus = "available";
    } catch {
      if (requestToken === profileHonorRequestToken) profileHonorStatus = "error";
    }
  };

  const openDetails = (
    row: TrackerRow<SharedEventRewardRangeResponse>,
    context: RankingContext = null
  ): void => {
    if (row.status === "unavailable") return;
    selectedRow = row;
    selectedRankingContext = context;
    graphRequestToken += 1;
    graphIdentity = null;
    graphPoints = [];
    activeGraphPoint = null;
    graphStatus = "idle";
    isDetailsIdentityVisible = false;
    if (!detailsDialog?.open) detailsDialog?.showModal();
    void tick().then(observeDetailsIdentity);
    void openGraph(row);
    void loadProfileHonors(row.ranking?.profileHonors ?? [], row.ranking?.honorMissions ?? []);
  };
  const handleRankingRowClick = (
    event: MouseEvent,
    row: TrackerRow<SharedEventRewardRangeResponse>,
    context: RankingContext = null
  ): void => {
    if (event.target instanceof Element && event.target.closest("button, a, input")) return;
    openDetails(row, context);
  };
  const closeDetails = (): void => {
    if (detailsDialog?.open) detailsDialog.close();
  };
  const handleDetailsClosed = (): void => {
    isDetailsIdentityVisible = false;
    disconnectDetailsIdentityObserver();
  };
  const openGraph = async (row = selectedRow): Promise<void> => {
    if (!row || eventKey === null) return;
    const requestToken = ++graphRequestToken;
    const requestEventKey = eventKey;
    const requestRank = row.ladderRank;
    graphIdentity = { eventId: requestEventKey, rank: requestRank };
    const requestTimestamp = snapshotTimestamp;
    graphStatus = "loading";
    graphPoints = [];
    activeGraphPoint = null;
    graphMode = requestTimestamp ? "snapshot" : "trend";
    try {
      let points = await fetchGraphPoints(
        requestEventKey,
        requestRank,
        requestTimestamp ?? undefined,
        selectedRankingContext
      );
      if (requestTimestamp && points.length < 2) {
        points = await fetchGraphPoints(
          requestEventKey,
          requestRank,
          undefined,
          selectedRankingContext
        );
      }
      if (
        requestToken !== graphRequestToken ||
        eventKey !== requestEventKey ||
        graphIdentity?.eventId !== requestEventKey ||
        graphIdentity.rank !== requestRank
      )
        return;
      if (requestTimestamp && points.length < 2) graphMode = "trend";
      graphPoints = points;
      graphStatus = points.length ? "available" : "empty";
    } catch {
      if (
        requestToken !== graphRequestToken ||
        eventKey !== requestEventKey ||
        graphIdentity?.eventId !== requestEventKey ||
        graphIdentity.rank !== requestRank
      )
        return;
      graphStatus = "error";
    }
  };
  const returnToLatest = (): void => {
    snapshotRequestToken += 1;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = undefined;
    snapshotRankings = null;
    snapshotTimestamp = null;
    snapshotStatus = "idle";
    timePointIndex = Math.max(timePoints.length - 1, 0);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("snapshot")) return;
    url.searchParams.delete("snapshot");
    replaceState(url, {});
  };
  const resetTimeTravel = (): void => {
    timePointsRequestToken += 1;
    snapshotRequestToken += 1;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    returnToLatest();
    timePoints = [];
    timePointIndex = 0;
    timePointsStatus = "idle";
  };
  const toggleTimeTravel = (): void => {
    if (isTimeTravelActive) {
      isTimeTravelActive = false;
      resetTimeTravel();
      return;
    }
    isTimeTravelActive = true;
    resetTimeTravel();
    void loadTimePoints(eventKey);
  };
  const loadTimePoints = async (requestEventKey: number | null): Promise<void> => {
    const requestToken = ++timePointsRequestToken;
    if (typeof window === "undefined" || !isTimeTravelActive || requestEventKey === null) {
      timePointsStatus = "idle";
      return;
    }
    timePointsStatus = "loading";
    try {
      const { payload } = await fetchJsonWithDeadline<{
        status?: string;
        timePoints?: unknown;
      }>(endpoint("time", { eventId: String(requestEventKey) }));
      if (
        requestToken !== timePointsRequestToken ||
        !isTimeTravelActive ||
        eventKey !== requestEventKey
      )
        return;
      timePoints =
        payload.status === "available" && Array.isArray(payload.timePoints)
          ? payload.timePoints.filter((point): point is string => typeof point === "string")
          : [];
      timePointIndex = Math.max(timePoints.length - 1, 0);
      timePointsStatus =
        payload.status === "available"
          ? timePoints.length
            ? "available"
            : "unavailable"
          : isTimeTravelStatus(payload.status)
            ? payload.status
            : "invalid-data";
    } catch {
      if (
        requestToken !== timePointsRequestToken ||
        !isTimeTravelActive ||
        eventKey !== requestEventKey
      )
        return;
      timePoints = [];
      timePointsStatus = "network-error";
    }
  };
  const loadSnapshot = async (timestamp: string): Promise<void> => {
    if (!isTimeTravelActive || eventKey === null) return;
    const requestToken = ++snapshotRequestToken;
    const requestEventKey = eventKey;
    snapshotStatus = "loading";
    try {
      const { payload } = await fetchJsonWithDeadline<{
        status?: string;
        rankings?: EventTrackerResult["rankings"];
      }>(endpoint("snapshot", { eventId: String(requestEventKey), timestamp }));
      if (
        requestToken !== snapshotRequestToken ||
        !isTimeTravelActive ||
        eventKey !== requestEventKey
      )
        return;
      if (payload.status !== "available" || !Array.isArray(payload.rankings)) {
        snapshotStatus = isTimeTravelStatus(payload.status) ? payload.status : "invalid-data";
        return;
      }
      snapshotRankings = payload.rankings;
      snapshotTimestamp = timestamp;
      snapshotStatus = "idle";
      goalResult = null;
    } catch {
      if (
        requestToken !== snapshotRequestToken ||
        !isTimeTravelActive ||
        eventKey !== requestEventKey
      )
        return;
      snapshotStatus = "network-error";
    }
  };
  const queueSnapshot = (timestamp: string): void => {
    if (!isTimeTravelActive) return;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => void loadSnapshot(timestamp), 200);
  };
  const selectTimePoint = (index: number): void => {
    const timestamp = timePoints[index];
    if (!timestamp) return;
    timePointIndex = index;
    if (index === timePoints.length - 1) {
      snapshotRequestToken += 1;
      if (snapshotTimer) clearTimeout(snapshotTimer);
      returnToLatest();
      return;
    }
    queueSnapshot(timestamp);
  };
  const shareTracker = async (): Promise<void> => {
    if (shareMessageTimer) clearTimeout(shareMessageTimer);
    shareMessageTimer = undefined;
    const url = new URL(window.location.href);
    if (snapshotTimestamp) url.searchParams.set("snapshot", snapshotTimestamp);
    else url.searchParams.delete("snapshot");
    const canonicalUrl = url.toString();
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      shareMessage = translate("tracker.linkCopied");
    } catch {
      shareMessage = canonicalUrl;
    }
    shareMessageTimer = setTimeout(() => {
      shareMessage = "";
      shareMessageTimer = undefined;
    }, 3000);
  };
  const resetGoalResult = (): void => {
    goalResult = null;
  };
  const openGoalCalculator = (): void => {
    resetGoalResult();
    if (!goalRankOptions.some((row) => row.ladderRank === goalTargetRank)) {
      goalTargetRank = goalRankOptions[0]?.ladderRank ?? null;
    }
    if (!goalDialog?.open) {
      goalDialog?.showModal();
      void tick().then(() => goalTargetRankControl?.focus());
    }
  };
  const closeGoalCalculator = (): void => {
    if (goalDialog?.open) goalDialog.close();
  };
  const handleGoalTargetRankChange = (event: Event): void => {
    const control = event.currentTarget;
    if (!(control instanceof HTMLSelectElement)) return;
    const rank = Number(control.value);
    goalTargetRank = Number.isSafeInteger(rank) && rank > 0 ? rank : null;
    resetGoalResult();
  };
  const submitGoal = (event: SubmitEvent): void => {
    event.preventDefault();
    goalResult = calculateTrackerGoalPlan({
      latestDataAt: goalLineCapturedAt,
      deadlineAt: goalDeadlineAt,
      player: { currentScore: goalCurrentScore },
      target: {
        score: goalLineRow?.score ?? null,
        rate: goalLineRow?.speedPerHour ?? null
      },
      safetyMarginPoints: goalSafetyMarginPoints,
      availablePlayHours: goalAvailablePlayHours
    });
  };
  const handleGoalDialogCancel = (event: Event): void => {
    event.preventDefault();
    closeGoalCalculator();
  };
  const handleGoalDialogClose = (): void => {
    goalOpenButton?.focus();
  };
  const selectTimePointGroup = (id: number): void => {
    const group = timePointGroups.find((candidate) => candidate.id === id);
    const newestPoint = group?.points.at(-1);
    if (newestPoint) selectTimePoint(newestPoint.index);
  };
  onMount(() => {
    hasMounted = true;
    const snapshot = new URLSearchParams(window.location.search).get("snapshot");
    if (snapshot) {
      isTimeTravelActive = true;
      snapshotTimestamp = snapshot;
    }
    const clock = window.setInterval(() => (now = Date.now()), 1000);
    return () => {
      window.clearInterval(clock);
      if (snapshotTimer) clearTimeout(snapshotTimer);
      if (eventSearchTimer !== undefined) window.clearTimeout(eventSearchTimer);
      if (shareMessageTimer) clearTimeout(shareMessageTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      disconnectDetailsIdentityObserver();
    };
  });
  $effect(() => {
    if (typeof window !== "undefined") {
      const requestEventKey = eventKey;
      if (observedEventKey === requestEventKey) return;
      observedEventKey = requestEventKey;
      const urlSnapshot = new URLSearchParams(window.location.search).get("snapshot");
      timePointsRequestToken += 1;
      snapshotRequestToken += 1;
      graphRequestToken += 1;
      if (snapshotTimer) clearTimeout(snapshotTimer);
      timePoints = [];
      timePointIndex = 0;
      goalResult = null;
      if (urlSnapshot) {
        isTimeTravelActive = true;
        snapshotRankings = null;
        snapshotTimestamp = urlSnapshot;
        snapshotStatus = "idle";
      } else {
        returnToLatest();
      }
      selectedRow = null;
      graphPoints = [];
      graphStatus = "idle";
      graphIdentity = null;
      if (isTimeTravelActive) {
        void loadTimePoints(requestEventKey);
        if (urlSnapshot && requestEventKey !== null) void loadSnapshot(urlSnapshot);
      }
    }
  });
  $effect(() => {
    if (
      !isEventPickerFocused &&
      queryEventId === null &&
      trackerResult?.selection.mode === "live" &&
      eventKey !== null &&
      pickerValue !== ""
    ) {
      eventQuery = pickerValue;
    }
  });
  $effect(() => {
    let cancelled = false;
    const requestIdentity = trackerIdentity;
    const selectionChanged =
      trackerRequestIdentity !== null && trackerRequestIdentity !== requestIdentity;
    if (selectionChanged) {
      trackerResult = null;
      trackerPageReady = null;
      catalog = null;
      eventSearchRequestToken += 1;
      eventSearchEvents = [];
      eventSearchStatus = "idle";
      if (eventSearchTimer !== undefined) window.clearTimeout(eventSearchTimer);
      eventSearchTimer = undefined;
      rewards = null;
      chapters = null;
      selectedChapterId = null;
      selectedRankingTab = "event";
      selectedChapterRows = [];
      goalResult = null;
    }
    trackerRequestIdentity = requestIdentity;
    void extendedData.trackerReady?.then(
      (value) => {
        if (cancelled || trackerRequestIdentity !== requestIdentity) return;
        trackerResult = value.trackerResult;
        catalog = value.catalog;
        trackerPageReady = value;
      },
      () => {
        if (cancelled || trackerRequestIdentity !== requestIdentity) return;
        trackerResult = createTrackerNetworkFailure();
        catalog = createCatalogNetworkFailure();
        trackerPageReady = {
          catalog,
          trackerResult,
          resolvedEventId: null
        };
      }
    );
    void extendedData.rewards?.then((value) => {
      if (!cancelled && trackerRequestIdentity === requestIdentity) rewards = value;
    });
    void extendedData.chapters?.then((value) => {
      if (!cancelled && trackerRequestIdentity === requestIdentity) chapters = value;
    });
    return () => (cancelled = true);
  });
  $effect(() => {
    let cancelled = false;
    void Promise.resolve(extendedData.isWorldBloom).then((value) => {
      if (!cancelled) isWorldBloom = value === true;
    });
    return () => {
      cancelled = true;
    };
  });
  $effect(() => {
    if (nextRefreshAt === null) {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = undefined;
      refreshedDeadline = null;
      return;
    }
    if (isRefreshing) {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = undefined;
      return;
    }
    if (nextRefreshAt === refreshedDeadline) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshedDeadline = nextRefreshAt;
    refreshTimer = window.setTimeout(
      () => {
        refreshTimer = undefined;
        refreshedDeadline = null;
        void refresh();
      },
      Math.max(0, nextRefreshAt - Date.now())
    );
  });
  $effect(() => {
    void Promise.resolve(data.i18nMessages).then(
      (value) => (messages = { ...fallbackMessages, ...value })
    );
  });
  $effect(() => {
    const chapter = selectedChapter;
    const selectedLadder = ladder;
    const requestToken = ++chapterRequestToken;
    selectedChapterRows = [];
    if (!chapter) return;
    const requestEventKey = eventKey;
    const requestChapterId = chapter.chapter.id;
    queueMicrotask(() => {
      if (
        requestToken !== chapterRequestToken ||
        eventKey !== requestEventKey ||
        selectedChapter?.chapter.id !== requestChapterId
      )
        return;
      selectedChapterRows = createChapterRows(chapter.result.rankings, selectedLadder);
    });
  });
</script>

<svelte:head><title>{translate("tracker.title")} | Sekai Tools</title></svelte:head>

{#snippet rewardHonorMedia(reward: SharedEventRewardRangeResponse | null)}
  {@const honor = getRewardHonorMedia(reward)}
  {#if honor}
    <span class="block aspect-19/4 w-48 max-w-full overflow-hidden" aria-hidden="true">
      <HonorDegree
        {honor}
        resolveAsset={resolveHonorAsset}
        slot="main"
        size="S"
        decorative
        label={formatRewardRange(reward)}
        class="block h-auto! w-full!"
      />
    </span>
  {/if}
{/snippet}

{#snippet leaderAvatar(leaderCard: TrackerLeaderCard | null | undefined)}
  {@const art = getCardArt(leaderCard)}
  {#if leaderCard && art}
    <CardThumbnail
      src={getLeaderCardAssetURL("thumbnail", art.assetBundleName, leaderCard.trained, "jp")}
      fallbackSrc={getLeaderCardFallbackURL("thumbnail", art.assetBundleName, leaderCard.trained)}
      alt=""
      trained={leaderCard.trained}
      attr={art.attr}
      rarityType={art.rarityType}
      rarityCount={resolveCardRarityCount(art.rarityType)}
      maxSize={null}
      containerClass="tracker-avatar"
    />
  {:else}
    <span class="tracker-avatar" aria-hidden="true"></span>
  {/if}
{/snippet}

<main class="tracker-canvas" aria-labelledby="tracker-title">
  <header class="tracker-context">
    <div class="tracker-title-block">
      <p class="tracker-kicker">
        {interpolate("tracker.currentRegion", { region: translate(`region.${data.region}`) })}
      </p>
      <h1 id="tracker-title">{translate("tracker.title")}</h1>
    </div>
    <div class="tracker-status-panel" aria-live="polite">
      {#if isMetadataLoading}
        <div class="tracker-status-skeleton" aria-hidden="true">
          <span class="skeleton h-6 w-24 rounded-full"></span>
          <span class="skeleton h-4 w-36"></span>
          <span class="skeleton h-4 w-28"></span>
        </div>
      {:else}
        <div class="tracker-primary-status">
          <span class:badge-success={isCurrentEvent && phase === "live"} class="badge badge-outline"
            >{activityLabel}</span
          >
          {#if countdown}
            <span class="tracker-countdown">
              <span class="tracker-countdown-label">{countdownLabel}</span>
              <span class="tracker-countdown-values" aria-live="off">
                {#if countdown.values.days > 0}<span
                    >{countdown.values.days}<small>{translate("tracker.timeUnit.day")}</small></span
                  >{/if}
                <span
                  >{String(countdown.values.hours).padStart(2, "0")}<small
                    >{translate("tracker.timeUnit.hour")}</small
                  ></span
                >
                <span
                  >{String(countdown.values.minutes).padStart(2, "0")}<small
                    >{translate("tracker.timeUnit.minute")}</small
                  ></span
                >
                <span
                  >{String(countdown.values.seconds).padStart(2, "0")}<small
                    >{translate("tracker.timeUnit.second")}</small
                  ></span
                >
              </span>
            </span>
          {/if}
        </div>
        <div class="tracker-freshness-action">
          <div class="tracker-freshness">
            {#if trackerResult}
              <span
                >{interpolate("tracker.loadedAt", {
                  time: formatTimestamp(trackerResult.loadedAt)
                })}</span
              >
              {#if nextRefreshSeconds !== null}<span aria-live="off"
                  >{interpolate("tracker.autoRefresh", { seconds: nextRefreshSeconds })}</span
                >{/if}
            {:else}
              <span class="skeleton h-4 w-36" aria-hidden="true"></span>
            {/if}
          </div>
          <button
            class="btn btn-square btn-sm btn-outline touch-target rounded-full tracker-refresh-action"
            type="button"
            onclick={refresh}
            disabled={isRefreshing || isHistoricalEvent}
            aria-label={isRefreshing
              ? translate("tracker.refreshing")
              : translate("tracker.refreshRankings")}
            title={isRefreshing
              ? translate("tracker.refreshing")
              : translate("tracker.refreshRankings")}
            ><Icon icon={isRefreshing ? "mdi:loading" : "mdi:refresh"} aria-hidden="true" /></button
          >
        </div>
      {/if}
    </div>
  </header>

  {#if isMetadataLoading}
    <section class="tracker-ranking-workspace" aria-live="polite">
      <div
        class="tracker-ranking-skeleton"
        role="status"
        aria-label={translate("tracker.loading")}
        aria-busy="true"
      >
        <div class="tracker-skeleton-heading" aria-hidden="true">
          <span class="skeleton h-3 w-20"></span><span class="skeleton h-7 w-32"></span>
        </div>
        <div class="tracker-skeleton-table" aria-hidden="true">
          {#each getTrackerRankLadder(ladder) as rank (rank)}
            <div class="tracker-skeleton-row">
              <span class="skeleton h-9 w-12"></span><span class="skeleton h-5 w-full max-w-48"
              ></span><span class="skeleton h-5 w-20"></span><span class="skeleton h-5 w-16"
              ></span><span class="skeleton h-6 w-24 rounded-full"></span>
            </div>
          {/each}
        </div>
      </div>
    </section>
  {:else}
    <section class="tracker-control-deck" aria-label={translate("tracker.eventSelection")}>
      <div class="tracker-event-picker">
        <div class="tracker-event-combobox">
          <input
            bind:this={eventPickerInput}
            id="tracker-event-picker"
            class="input input-sm"
            role="combobox"
            type="text"
            inputmode="search"
            autocomplete="off"
            aria-label={translate("tracker.eventSelection")}
            aria-expanded={isEventPickerOpen}
            aria-controls="tracker-event-options"
            aria-activedescendant={activeEventIndex >= 0
              ? `tracker-event-option-${visibleMatchingEvents[activeEventIndex]?.id}`
              : undefined}
            value={isEventPickerFocused ? eventQuery : pickerValue}
            placeholder={translate("tracker.eventPickerPlaceholder")}
            onfocus={() => {
              isEventPickerFocused = true;
              isEventPickerOpen = eventSearchStatus === "available" && eventQuery.trim().length > 0;
            }}
            oninput={(event) => handleEventPickerInput(event.currentTarget.value)}
            onkeydown={handleEventPickerKeydown}
            onblur={() => {
              isEventPickerFocused = false;
              isEventPickerOpen = false;
              activeEventIndex = -1;
            }}
          />
          {#if isEventPickerFocused && eventQuery.length > 0}
            <button
              class="btn btn-ghost btn-xs btn-circle touch-target tracker-event-clear"
              type="button"
              aria-label={translate("tracker.clearEventSearch")}
              title={translate("tracker.clearEventSearch")}
              onmousedown={(event) => event.preventDefault()}
              onclick={clearEventSearch}
            >
              <Icon icon="mdi:close" aria-hidden="true" />
            </button>
          {/if}
          {#if isEventPickerOpen}
            <ul
              id="tracker-event-options"
              class="tracker-event-suggestions"
              role="listbox"
              aria-label={translate("tracker.eventSuggestions")}
            >
              {#if eventSearchStatus === "available" && visibleMatchingEvents.length > 0}
                {#each visibleMatchingEvents as event, index (event.id)}
                  <li
                    id={`tracker-event-option-${event.id}`}
                    role="option"
                    aria-selected={eventKey === event.id || activeEventIndex === index}
                    tabindex="-1"
                    onmousedown={(mouseEvent) => mouseEvent.preventDefault()}
                    onclick={() => selectEvent(event)}
                    onkeydown={(keyboardEvent) => {
                      if (keyboardEvent.key === "Enter") selectEvent(event);
                    }}
                  >
                    <span>{formatEventLabel(event.id, event.name)}</span>
                  </li>
                {/each}
              {:else}
                <li
                  class="tracker-event-search-status"
                  role={eventSearchStatus === "loading" || eventSearchStatus === "available"
                    ? "status"
                    : "alert"}
                  aria-live="polite"
                >
                  {eventSearchMessage}
                </li>
              {/if}
            </ul>
          {/if}
        </div>
      </div>
      <div class="tracker-control-row">
        <div class="tracker-ladder-control">
          <span class="tracker-control-label">{translate("tracker.rankings")}</span>
          <div
            class="tracker-ladder-switcher"
            role="group"
            aria-label={translate("tracker.rankRange")}
          >
            <span
              class:tracker-ladder-indicator-full={ladder === "full"}
              class="tracker-ladder-indicator"
              aria-hidden="true"
            ></span>
            <button
              class:btn-primary={ladder === "critical"}
              class:btn-outline={ladder !== "critical"}
              class="btn btn-sm rounded-full border-0 touch-target tracker-ladder-option"
              type="button"
              aria-pressed={ladder === "critical"}
              onclick={() => (ladder = "critical")}>{translate("tracker.ranks.critical")}</button
            ><button
              class:btn-primary={ladder === "full"}
              class:btn-outline={ladder !== "full"}
              class="btn btn-sm rounded-full border-0 touch-target tracker-ladder-option"
              type="button"
              aria-pressed={ladder === "full"}
              onclick={() => (ladder = "full")}>{translate("tracker.ranks.all")}</button
            >
          </div>
        </div>
        <div class="tracker-tool-action-region">
          <div class="tracker-tool-actions">
            <button
              class:btn-primary={isTimeTravelActive}
              class:btn-outline={!isTimeTravelActive}
              class="btn btn-sm touch-target tracker-history-tool"
              type="button"
              aria-expanded={isTimeTravelActive}
              aria-controls="tracker-time-travel-controls"
              onclick={toggleTimeTravel}
            >
              <Icon icon="mdi:history" class="size-4 shrink-0" aria-hidden="true" />
              {isTimeTravelActive
                ? translate("tracker.backToLatestRankings")
                : translate("tracker.viewPastRankings")}
            </button>
            <button
              bind:this={goalOpenButton}
              id="tracker-goal-open"
              class="btn btn-sm btn-outline touch-target"
              type="button"
              aria-haspopup="dialog"
              aria-controls="tracker-goal-dialog"
              onclick={openGoalCalculator}
            >
              <Icon icon="mdi:calculator-variant" class="size-4 shrink-0" aria-hidden="true" />
              {translate("tracker.openGoalCalculator")}
            </button>
            <button
              class="btn btn-sm btn-outline touch-target"
              type="button"
              onclick={shareTracker}
            >
              <Icon
                icon="mdi:share-variant-outline"
                class="size-4 shrink-0"
                aria-hidden="true"
              />{translate("tracker.share")}
            </button>
          </div>
          {#if shareMessage.trim()}
            <span class="tracker-share-message" role="status" aria-live="polite"
              >{shareMessage}</span
            >
          {/if}
        </div>
      </div>
      {#if isTimeTravelActive}
        <section
          id="tracker-time-travel-controls"
          class="tracker-time-travel-panel"
          aria-labelledby="tracker-time-travel-title"
        >
          <div class="tracker-time-travel-copy">
            <h2 id="tracker-time-travel-title">{translate("tracker.pastRankings")}</h2>
          </div>
          <div class="tracker-time-travel-content">
            {#if timePointsStatus === "available"}
              <div class="tracker-time-selects">
                <label class="tracker-time-control" for="tracker-activity-day"
                  ><span>{translate("tracker.activityDayLabel")}</span><select
                    id="tracker-activity-day"
                    class="select select-sm"
                    value={selectedTimePointGroup?.id ?? ""}
                    onchange={(event) => selectTimePointGroup(Number(event.currentTarget.value))}
                    >{#each timePointGroups as group (group.id)}<option value={group.id}
                        >{formatActivityDay(group)}</option
                      >{/each}</select
                  ></label
                >
                <label class="tracker-time-control" for="tracker-saved-time"
                  ><span>{translate("tracker.rankingSnapshotTime")}</span><select
                    id="tracker-saved-time"
                    class="select select-sm"
                    value={selectedTimePoint ?? ""}
                    onchange={(event) => {
                      const point = selectedTimePointGroup?.points.find(
                        (candidate) => candidate.timestamp === event.currentTarget.value
                      );
                      if (point) selectTimePoint(point.index);
                    }}
                    >{#each selectedTimePointLocalDateGroups as group (group.label)}<optgroup
                        label={group.label}
                        >{#each group.points as point (point.timestamp)}<option
                            value={point.timestamp}
                            >{formatSnapshotOption(
                              point.timestamp
                            )}{#if point.index === timePoints.length - 1}
                              · {translate("tracker.latest")}{/if}</option
                          >{/each}</optgroup
                      >{/each}</select
                  ></label
                >
              </div>
            {:else if timePointsStatus === "idle" || timePointsStatus === "loading"}
              <div
                class="tracker-time-select-skeleton"
                role="status"
                aria-label={translate("tracker.snapshotLoading")}
              >
                <span class="skeleton h-3 w-28" aria-hidden="true"></span>
                <span class="skeleton h-11 w-full rounded-field" aria-hidden="true"></span>
                <span class="skeleton h-3 w-32" aria-hidden="true"></span>
                <span class="skeleton h-11 w-full rounded-field" aria-hidden="true"></span>
              </div>
            {:else}
              <p
                class="tracker-time-note tracker-time-status"
                role={timePointsStatus === "unavailable" ? undefined : "alert"}
              >
                {timeTravelMessage(timePointsStatus, "timePoint")}
              </p>
            {/if}
          </div>
        </section>
      {/if}
    </section>

    {#if snapshotTimestamp}<div class="tracker-snapshot-banner">
        <span
          >{interpolate("tracker.snapshotAt", { time: formatTimestamp(snapshotTimestamp) })}</span
        ><button class="btn btn-sm btn-outline touch-target" type="button" onclick={returnToLatest}
          >{translate("tracker.backToLatestRankings")}</button
        >
      </div>{/if}
    <div
      class:tracker-status-visible={snapshotStatus !== "idle"}
      class="tracker-snapshot-status-region"
      aria-live="polite"
    >
      {#if snapshotStatus === "loading"}
        <p role="status">{translate("tracker.snapshotLoading")}</p>
      {:else if snapshotStatus !== "idle"}
        <p role={snapshotStatus === "unavailable" ? undefined : "alert"}>
          {timeTravelMessage(snapshotStatus, "snapshot")}
        </p>
      {/if}
    </div>

    <section class="tracker-ranking-workspace" aria-labelledby="tracker-results-title">
      <div class="tracker-workspace-heading">
        <div>
          {#if isWorldBloom}<p class="tracker-kicker tracker-world-bloom-kicker">
              {translate("tracker.worldBloom")}
            </p>{/if}
          <h2 id="tracker-results-title">{translate("tracker.rankings")}</h2>
        </div>
        {#if isHistoricalEvent}<a class="btn btn-sm btn-outline touch-target" href={trackerPath}
            ><Icon icon="mdi:arrow-left" aria-hidden="true" />{translate(
              "tracker.goToCurrentEvent"
            )}</a
          >{/if}
      </div>
      {#if isWorldBloom}<div class="tracker-ranking-tabs-shell">
          <div class="tracker-ranking-tabs-scroll">
            <div
              class="tracker-ranking-tabs min-w-max flex-nowrap"
              role="tablist"
              aria-label={translate("tracker.rankingWorkspace")}
            >
              {#if chapters === null}
                <span class="tracker-ranking-tabs-loading" aria-hidden="true">
                  <span class="skeleton h-11 w-32 rounded-box"></span>
                  <span class="skeleton h-11 w-28 rounded-box"></span>
                  <span class="skeleton h-11 w-28 rounded-box"></span>
                </span>
              {:else}
                <button
                  id="tracker-event-ranking-tab"
                  class:btn-primary={selectedRankingTab === "event"}
                  class:btn-outline={selectedRankingTab !== "event"}
                  class="btn btn-sm shrink-0 rounded-full touch-target tracker-ladder-option"
                  type="button"
                  role="tab"
                  aria-selected={selectedRankingTab === "event"}
                  aria-controls="tracker-ranking-panel"
                  tabindex={selectedRankingTab === "event" ? 0 : -1}
                  onclick={() => selectRankingTab("event")}
                  onkeydown={(event) => handleRankingTabKeydown(event, 0)}
                  >{translate("tracker.eventRankings")}</button
                >
                {#each chapters?.rankings ?? [] as chapter, index (chapter.chapter.id)}
                  {@const isCurrent = currentChapter?.chapter.id === chapter.chapter.id}
                  <button
                    id={`tracker-chapter-tab-${chapter.chapter.id}`}
                    class:btn-primary={selectedRankingTab === chapter.chapter.id}
                    class:btn-outline={selectedRankingTab !== chapter.chapter.id}
                    class:tracker-current-tab={isCurrent}
                    class="btn btn-sm shrink-0 rounded-full touch-target tracker-ladder-option"
                    type="button"
                    role="tab"
                    aria-selected={selectedRankingTab === chapter.chapter.id}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-controls="tracker-ranking-panel"
                    tabindex={selectedRankingTab === chapter.chapter.id ? 0 : -1}
                    onclick={() => selectRankingTab(chapter.chapter.id)}
                    onkeydown={(event) => handleRankingTabKeydown(event, index + 1)}
                    >{interpolate("tracker.chapter", {
                      number: chapter.chapter.chapterNo
                    })}{#if isCurrent}<span class="tracker-current-marker"
                        >{translate("tracker.currentChapter")}</span
                      >{/if}</button
                  >
                {/each}
              {/if}
            </div>
          </div>
        </div>{/if}
      {#if isWorldBloom}<div class="tracker-chapter-countdown-slot">
          {#if isWorldBloom && selectedRankingTab !== "event" && selectedChapter}
            <div class="tracker-chapter-countdown" aria-live="polite">
              <span class="tracker-countdown-label">
                {chapterCountdown?.mode === "starts"
                  ? translate("tracker.countdownStartsIn")
                  : chapterCountdown?.mode === "ends"
                    ? translate("tracker.countdownEndsIn")
                    : parseTrackerTimestamp(
                          selectedChapter.chapter.aggregateAt ??
                            selectedChapter.chapter.chapterEndAt
                        ) !== null &&
                        parseTrackerTimestamp(
                          selectedChapter.chapter.aggregateAt ??
                            selectedChapter.chapter.chapterEndAt
                        )! <= now
                      ? translate("tracker.chapterEnded")
                      : translate("tracker.chapterCountdownUnavailable")}
              </span>
              {#if chapterCountdown}
                <span class="tracker-countdown-values" aria-live="off">
                  {#if chapterCountdown.values.days > 0}<span
                      >{chapterCountdown.values.days}<small
                        >{translate("tracker.timeUnit.day")}</small
                      ></span
                    >{/if}
                  <span
                    >{String(chapterCountdown.values.hours).padStart(2, "0")}<small
                      >{translate("tracker.timeUnit.hour")}</small
                    ></span
                  >
                  <span
                    >{String(chapterCountdown.values.minutes).padStart(2, "0")}<small
                      >{translate("tracker.timeUnit.minute")}</small
                    ></span
                  >
                  <span
                    >{String(chapterCountdown.values.seconds).padStart(2, "0")}<small
                      >{translate("tracker.timeUnit.second")}</small
                    ></span
                  >
                </span>
              {/if}
            </div>
          {/if}
        </div>{/if}
      <div class="tracker-ranking-result-region" aria-live="polite">
        {#if isTrackerLoading}
          <div
            class="tracker-ranking-skeleton"
            role="status"
            aria-live="polite"
            aria-label={translate("tracker.loading")}
            aria-busy="true"
          >
            <div class="tracker-skeleton-heading" aria-hidden="true">
              <span class="skeleton h-3 w-20"></span><span class="skeleton h-7 w-32"></span>
            </div>
            <div class="tracker-skeleton-table" aria-hidden="true">
              {#each getTrackerRankLadder(ladder) as rank (rank)}
                <div class="tracker-skeleton-row">
                  <span class="skeleton h-9 w-12"></span><span class="skeleton h-5 w-full max-w-48"
                  ></span><span class="skeleton h-5 w-20"></span><span class="skeleton h-5 w-16"
                  ></span><span class="skeleton h-6 w-24 rounded-full"></span>
                </div>
              {/each}
            </div>
            <div class="tracker-skeleton-cards" aria-hidden="true">
              {#each getTrackerRankLadder(ladder) as rank (rank)}
                <div class="tracker-skeleton-card">
                  <div class="tracker-skeleton-card-heading">
                    <span class="skeleton h-6 w-16"></span><span class="skeleton h-4 w-20"></span>
                  </div>
                  <span class="skeleton h-5 w-3/5"></span><span class="skeleton h-4 w-2/5"
                  ></span><span class="skeleton h-4 w-1/2"></span><span class="skeleton h-4 w-3/5"
                  ></span>
                </div>
              {/each}
            </div>
          </div>
        {:else if isInvalidSelection}
          <div class="tracker-ranking-result-message">
            <p role="alert">{translate("tracker.eventIdInvalid")}</p>
            <a class="btn btn-sm btn-outline touch-target" href={trackerPath}
              ><Icon icon="mdi:arrow-left" aria-hidden="true" />{translate(
                "tracker.goToCurrentEvent"
              )}</a
            >
          </div>
        {:else if trackerStatus !== "available"}
          <div class="tracker-ranking-result-message">
            <p role="alert">{translate(rankingErrorKey)}</p>
            <button
              class="btn btn-sm btn-outline touch-target"
              type="button"
              onclick={refresh}
              disabled={isRefreshing}
            >
              <Icon icon="mdi:refresh" class="size-4 shrink-0" aria-hidden="true" />
              {translate("tracker.retry")}
            </button>
          </div>
        {:else}
          <div class="tracker-table-wrap">
            {#if rankingLoading}<div class="tracker-ranking-loading" role="status">
                <span class="loading loading-spinner loading-sm" aria-hidden="true"
                ></span>{translate("tracker.rankingsLoading")}
              </div>{/if}
            <div
              id="tracker-ranking-panel"
              role={isWorldBloom ? "tabpanel" : undefined}
              aria-labelledby={isWorldBloom
                ? selectedRankingTab === "event"
                  ? "tracker-event-ranking-tab"
                  : `tracker-chapter-tab-${selectedChapter?.chapter.id}`
                : undefined}
            >
              <table class="table tracker-table">
                <thead
                  ><tr
                    ><th scope="col">{translate("tracker.rank")}</th><th scope="col"
                      >{translate("tracker.player")}</th
                    ><th scope="col">{translate("tracker.score")}</th><th scope="col"
                      >{translate("tracker.speed")}</th
                    ><th scope="col">{translate("tracker.degree")}</th><th scope="col"
                      ><span class="sr-only">{translate("tracker.viewTrend")}</span></th
                    ></tr
                  ></thead
                >
                <tbody>
                  {#each activeRankingRows.filter((row) => row.status === "available") as row (row.ladderRank)}
                    <tr
                      class="tracker-ranking-row"
                      class:tier-top={rankTier(row.ladderRank) === "top"}
                      class:tier-elite={rankTier(row.ladderRank) === "elite"}
                      class:tier-high={rankTier(row.ladderRank) === "high"}
                      class:tier-mid={rankTier(row.ladderRank) === "mid"}
                      class:tier-long={rankTier(row.ladderRank) === "long"}
                      onclick={(event) => handleRankingRowClick(event, row, activeRankingContext)}
                    >
                      <th scope="row"
                        ><span class="tracker-rank-number">#{formatNumber(row.ladderRank)}</span
                        ><span class="tracker-tier">{rankTierLabel(row.ladderRank)}</span></th
                      >
                      <td
                        ><div class="tracker-player-cell">
                          {@render leaderAvatar(row.ranking?.leaderCard)}<strong
                            class="tracker-player-name"
                            >{row.ranking?.userName ??
                              row.ranking?.userId ??
                              translate("tracker.unavailable")}</strong
                          >
                        </div></td
                      >
                      <td class="tracker-score">{formatNumber(row.score)}</td><td
                        class="tracker-speed">{formatSpeed(row.speedPerHour)}</td
                      ><td
                        ><div class="grid max-w-48 gap-1">
                          {@render rewardHonorMedia(row.reward)}
                          <span
                            class={hasRewardHonorMedia(row.reward)
                              ? "sr-only"
                              : "badge badge-outline badge-sm max-w-48 whitespace-normal wrap-anywhere"}
                            >{formatRewardRange(row.reward)}</span
                          >
                        </div></td
                      >
                      <td class="tracker-row-icon"
                        ><button
                          class="btn btn-ghost btn-sm btn-circle touch-target"
                          type="button"
                          aria-label={interpolate("tracker.openRankDetailsAndTrend", {
                            rank: row.ladderRank
                          })}
                          onclick={() => openDetails(row, activeRankingContext)}
                          ><Icon icon="mdi:chart-line" aria-hidden="true" /></button
                        ></td
                      >
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
          <div class="tracker-ranking-cards">
            {#each activeRankingRows.filter((row) => row.status === "available") as row (row.ladderRank)}<button
                class="tracker-ranking-card"
                class:tier-top={rankTier(row.ladderRank) === "top"}
                class:tier-elite={rankTier(row.ladderRank) === "elite"}
                class:tier-high={rankTier(row.ladderRank) === "high"}
                class:tier-mid={rankTier(row.ladderRank) === "mid"}
                class:tier-long={rankTier(row.ladderRank) === "long"}
                type="button"
                onclick={() => openDetails(row, activeRankingContext)}
                aria-label={interpolate("tracker.openRankDetailsAndTrend", {
                  rank: row.ladderRank
                })}
                ><div class="tracker-card-heading">
                  <strong class="tracker-rank-number">#{formatNumber(row.ladderRank)}</strong><span
                    class="tracker-tier">{rankTierLabel(row.ladderRank)}</span
                  ><Icon class="tracker-row-icon" icon="mdi:chart-line" aria-hidden="true" />
                </div>
                <span class="tracker-player-cell"
                  >{@render leaderAvatar(row.ranking?.leaderCard)}<span class="tracker-player-name"
                    >{row.ranking?.userName ??
                      row.ranking?.userId ??
                      translate("tracker.unavailable")}</span
                  ></span
                ><span>{translate("tracker.score")}: {formatNumber(row.score)}</span><span
                  >{translate("tracker.speed")}: {formatSpeed(row.speedPerHour)}</span
                >{#if !hasRewardHonorMedia(row.reward)}<span
                    >{translate("tracker.degree")}: {formatRewardRange(row.reward)}</span
                  >{/if}
                {@render rewardHonorMedia(row.reward)}</button
              >{/each}
          </div>
        {/if}
      </div>
    </section>
  {/if}
</main>

<dialog
  bind:this={goalDialog}
  id="tracker-goal-dialog"
  class="modal tracker-goal-dialog"
  aria-labelledby="tracker-goal-dialog-title"
  aria-describedby="tracker-goal-dialog-description"
  oncancel={handleGoalDialogCancel}
  onclose={handleGoalDialogClose}
>
  <form
    class="modal-box tracker-goal-dialog-box"
    aria-describedby="tracker-goal-dialog-description"
    onsubmit={submitGoal}
  >
    <div class="tracker-goal-dialog-heading">
      <div>
        <h2 id="tracker-goal-dialog-title">{translate("tracker.goalCalculator")}</h2>
        <p id="tracker-goal-dialog-description">{translate("tracker.goalDisclaimer")}</p>
      </div>
      <button
        class="btn btn-square btn-sm btn-ghost size-11 min-h-11 shrink-0"
        type="button"
        onclick={closeGoalCalculator}
        aria-label={translate("tracker.goalClose")}
        title={translate("tracker.goalClose")}
      >
        <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
      </button>
    </div>
    <div class="tracker-goal-fields">
      <label class="tracker-goal-field" for="tracker-goal-current-score">
        <span>{translate("tracker.goalCurrentScore")}</span>
        <input
          id="tracker-goal-current-score"
          class="input input-sm min-h-11 w-full min-w-0"
          type="number"
          min="0"
          step="1"
          required
          bind:value={goalCurrentScore}
          oninput={resetGoalResult}
        />
      </label>
      <label class="tracker-goal-field" for="tracker-goal-rank">
        <span>{translate("tracker.goalTargetRank")}</span>
        <select
          bind:this={goalTargetRankControl}
          id="tracker-goal-rank"
          class="select select-sm min-h-11 w-full min-w-0"
          required
          value={goalTargetRank ?? ""}
          onchange={handleGoalTargetRankChange}
        >
          <option value="" disabled>{translate("tracker.goalChooseRank")}</option>
          {#each goalRankOptions as row (row.ladderRank)}
            <option value={row.ladderRank}
              >#{formatNumber(row.ladderRank)} · {formatNumber(row.score)}</option
            >
          {:else}
            <option value="" disabled>{translate("tracker.goalRankUnavailable")}</option>
          {/each}
        </select>
      </label>
      <label class="tracker-goal-field" for="tracker-goal-safety-margin">
        <span>{translate("tracker.goalSafetyMargin")}</span>
        <input
          id="tracker-goal-safety-margin"
          class="input input-sm min-h-11 w-full min-w-0"
          type="number"
          min="0"
          step="1"
          required
          bind:value={goalSafetyMarginPoints}
          oninput={resetGoalResult}
        />
      </label>
      <label class="tracker-goal-field" for="tracker-goal-play-hours">
        <span>{translate("tracker.goalAvailablePlayHours")}</span>
        <input
          id="tracker-goal-play-hours"
          class="input input-sm min-h-11 w-full min-w-0"
          type="number"
          min="0"
          step="0.25"
          bind:value={goalAvailablePlayHours}
          oninput={resetGoalResult}
        />
      </label>
      <label class="tracker-goal-field" for="tracker-goal-deadline">
        <span>{translate("tracker.goalDeadline")}</span>
        <input
          id="tracker-goal-deadline"
          class="input input-sm min-h-11 w-full min-w-0"
          type="text"
          readonly
          value={goalDeadlineAt === null
            ? translate("tracker.unavailable")
            : formatTimestamp(goalDeadlineAt)}
        />
      </label>
    </div>
    {#if !goalCanUseLiveData}
      <p class="alert alert-warning alert-soft" role="alert">
        {translate("tracker.goalLiveDataUnavailable")}
      </p>
    {:else if !goalHasTargetRate}
      <p class="tracker-goal-rate-note" role="alert">
        {translate("tracker.goalRateUnavailable")}
      </p>
    {/if}
    {#if goalResult}
      <section class="tracker-goal-result" aria-live="polite">
        {#if goalResult.status === "unavailable"}
          <p class="alert alert-warning alert-soft" role="alert">
            {translate("tracker.goalUnavailable")}
          </p>
        {:else if goalResult.status === "invalid"}
          <p class="alert alert-error alert-soft" role="alert">
            {translate("tracker.goalInvalid")}
          </p>
        {:else if goalPlan}
          <output class="tracker-goal-output">
            <dl class="tracker-goal-result-grid">
              <div>
                <dt>{translate("tracker.goalTargetRate")}</dt>
                <dd>{formatGoalRate(goalPlan.targetRate)}</dd>
              </div>
              <div>
                <dt>{translate("tracker.goalTargetFinal")}</dt>
                <dd>{formatGoalApproxNumber(goalPlan.targetProjectedFinalScore, 0)}</dd>
              </div>
              <div>
                <dt>{translate("tracker.goalRequiredFinal")}</dt>
                <dd>{formatGoalApproxNumber(goalPlan.requiredFinalScore, 0)}</dd>
              </div>
              <div>
                <dt>{translate("tracker.goalRequiredRate")}</dt>
                <dd>{formatGoalRate(goalPlan.requiredRate)}</dd>
              </div>
              {#if goalPlan.dailyRequiredScore !== undefined}
                <div>
                  <dt>{translate("tracker.goalDailyTarget")}</dt>
                  <dd>{formatGoalDaily(goalPlan.dailyRequiredScore)}</dd>
                </div>
              {/if}
            </dl>
            <GoalProjectionChart
              user={goalPlan.user}
              target={goalPlan.target}
              deadlineAt={goalPlan.deadlineAt}
              locale={data.uiLocale}
              userLabel={translate("tracker.goalUserLine")}
              targetLabel={translate("tracker.goalTargetLine")}
              ariaLabel={translate("tracker.goalProjectionChart")}
            />
          </output>
        {/if}
      </section>
    {/if}
    <div class="tracker-goal-dialog-actions">
      <button class="btn btn-primary min-h-11" type="submit" disabled={!goalCanSubmit}>
        {translate("tracker.calculateGoal")}
      </button>
    </div>
  </form>
  <form method="dialog" class="modal-backdrop">
    <button type="submit" aria-label={translate("tracker.goalClose")}></button>
  </form>
</dialog>

<dialog
  bind:this={detailsDialog}
  class="modal tracker-dialog"
  aria-labelledby="tracker-details-title"
  oncancel={(event) => {
    event.preventDefault();
    closeDetails();
  }}
  onclose={handleDetailsClosed}
>
  {#if selectedRow}
    <div bind:this={detailsModalBox} class="modal-box">
      <div class="tracker-workspace-heading">
        <h2 id="tracker-details-title">
          {selectedRow
            ? `${selectedRankingContext ? `${interpolate("tracker.chapter", { number: selectedRankingContext.chapterNo })} · ` : ""}${interpolate("tracker.detailRank", { rank: selectedRow.ladderRank })}`
            : translate("tracker.playerDetails")}
        </h2>
        <button
          class="btn btn-square btn-sm btn-ghost touch-target"
          type="button"
          onclick={closeDetails}
          aria-label={translate("tracker.detailsClose")}
          ><Icon icon="mdi:close" aria-hidden="true" /></button
        >
      </div>
      <div
        class:is-visible={isDetailsIdentityVisible}
        class="tracker-identity-strip"
        aria-hidden={!isDetailsIdentityVisible}
      >
        <strong
          >{activeGraphPoint?.userName ??
            selectedRow.ranking?.userName ??
            selectedRow.ranking?.userId ??
            translate("tracker.unavailable")}</strong
        >
        <span>#{formatNumber(selectedRow.ladderRank)}</span>
        <span
          >{translate("tracker.score")}: {formatNumber(
            activeGraphPoint?.score ?? selectedRow.score
          )}</span
        >
      </div>
      <dl class="tracker-detail-grid">
        <div class="tracker-detail-wide" bind:this={detailsPlayerEntry}>
          <dt>{translate("tracker.player")}</dt>
          <dd class="tracker-profile-player">
            {#if selectedRow.ranking?.leaderCard}
              {@const leaderCard = selectedRow.ranking.leaderCard}
              {@const art = getCardArt(leaderCard)}
              {@const stats = [
                leaderCard.level === null
                  ? null
                  : interpolate("tracker.cardLevel", { level: leaderCard.level }),
                leaderCard.masterRank > 0
                  ? interpolate("tracker.masterRank", { rank: leaderCard.masterRank })
                  : null
              ].filter((label) => label !== null)}
              <span class="tracker-profile-art">
                {#if art}
                  <CardThumbnail
                    src={getLeaderCardAssetURL(
                      "member-small",
                      art.assetBundleName,
                      leaderCard.trained,
                      "jp"
                    )}
                    fallbackSrc={getLeaderCardFallbackURL(
                      "member-small",
                      art.assetBundleName,
                      leaderCard.trained
                    )}
                    alt={art.prefix ?? ""}
                    trained={leaderCard.trained}
                    showFrame={false}
                    showIcons={false}
                    loadMode="immediate"
                    maxSize={null}
                    containerClass="tracker-profile-card"
                    imageClass="size-full object-cover"
                  />
                  <!-- The game's profile card overlays in the art's own 940×530 frame. -->
                  <svg
                    class="tracker-profile-stats"
                    viewBox="0 0 940 530"
                    role={stats.length > 0 ? "img" : undefined}
                    aria-label={stats.length > 0 ? stats.join(", ") : undefined}
                    aria-hidden={stats.length > 0 ? undefined : "true"}
                  >
                    {#if leaderCard.level !== null}
                      <!-- Not part of the game's profile card: a level bar, drawn under the frame. -->
                      <rect x="0" y="448" width="940" height="82" fill="black" fill-opacity="0.6" />
                      <text x="100" y="506" font-size="50" font-weight="600" fill="white"
                        >{interpolate("tracker.cardLevel", { level: leaderCard.level })}</text
                      >
                    {/if}
                    {#each getProfileCardLayers(art, leaderCard) as layer (layer.name)}
                      <image
                        href={layer.href}
                        x={layer.x}
                        y={layer.y}
                        width={layer.width}
                        height={layer.height}
                        preserveAspectRatio="none"
                      />
                    {/each}
                  </svg>
                {:else}
                  <span class="tracker-profile-card" aria-hidden="true"></span>
                {/if}
              </span>
            {/if}
            <span class="tracker-profile-identity">
              <span class="tracker-profile-name"
                >{activeGraphPoint?.userName ??
                  selectedRow.ranking?.userName ??
                  selectedRow.ranking?.userId ??
                  translate("tracker.unavailable")}</span
              >
              {#if (selectedRow.ranking?.profileHonors?.length ?? 0) > 0}
                <span
                  class="tracker-profile-titles"
                  role="group"
                  aria-label={translate("tracker.playerTitles")}
                >
                  {#if profileHonorStatus === "error"}
                    <span role="alert">{translate("tracker.playerTitlesError")}</span>
                    <button
                      class="btn btn-xs btn-outline touch-target"
                      type="button"
                      onclick={() => loadProfileHonors()}
                    >
                      <Icon icon="mdi:refresh" class="size-4 shrink-0" aria-hidden="true" />
                      {translate("tracker.retry")}
                    </button>
                  {:else if profileHonorStatus === "available"}
                    {#each profileHonorDegrees as title (title.seq)}
                      <span class="tracker-profile-title" class:is-main={title.slot === "main"}>
                        <HonorDegree
                          honor={title.degree}
                          resolveAsset={resolveHonorAsset}
                          slot={title.slot}
                          size="M"
                          label={title.name ?? translate("tracker.playerTitle")}
                          class="block h-auto! w-full!"
                        />
                      </span>
                    {/each}
                  {:else}
                    {#each selectedRow.ranking?.profileHonors ?? [] as title (title.seq)}
                      <span
                        class="tracker-profile-title is-placeholder"
                        class:is-main={title.seq === 1}
                        aria-hidden="true"
                      ></span>
                    {/each}
                  {/if}
                </span>
              {/if}
            </span>
          </dd>
        </div>
        <div>
          <dt>{translate("tracker.degree")}</dt>
          <dd class="grid gap-1">
            {@render rewardHonorMedia(selectedRow.reward)}
            <span class:sr-only={hasRewardHonorMedia(selectedRow.reward)}
              >{formatRewardRange(selectedRow.reward)}</span
            >
          </dd>
        </div>
        <div>
          <dt>{translate("tracker.score")}</dt>
          <dd>{formatNumber(activeGraphPoint?.score ?? selectedRow.score)}</dd>
        </div>
        <div>
          <dt>{translate("tracker.speed")}</dt>
          <dd>
            {formatSpeed(
              activeGraphPoint?.timestamp
                ? (() => {
                    const start = parseTrackerTimestamp(selectedEvent?.startAt);
                    const captured = parseTrackerTimestamp(activeGraphPoint.timestamp);
                    return start !== null && captured !== null && captured > start
                      ? (activeGraphPoint.score - 0) / ((captured - start) / 3_600_000)
                      : null;
                  })()
                : selectedRow.speedPerHour
            )}
          </dd>
        </div>
        <div>
          <dt>{translate("tracker.recentRate1h")}</dt>
          <dd>{formatSpeed(recentRates.oneHour)}</dd>
        </div>
        <div>
          <dt>{translate("tracker.recentRate3h")}</dt>
          <dd>{formatSpeed(recentRates.threeHours)}</dd>
        </div>
        <div>
          <dt>{translate("tracker.capturedAt")}</dt>
          <dd>{formatTimestamp(activeGraphPoint?.timestamp ?? selectedRow.ranking?.timestamp)}</dd>
        </div>
      </dl>
      <div class="tracker-graph-region" aria-live="polite">
        {#if graphStatus === "loading"}
          <div class="tracker-graph-loading" role="status">
            <span class="sr-only">{translate("tracker.graphLoading")}</span>
            <div class="tracker-graph-skeleton" aria-hidden="true">
              <span class="tracker-graph-skeleton-heading"></span>
              <span class="tracker-graph-skeleton-plot"></span>
              <span class="tracker-graph-skeleton-axis"></span>
            </div>
          </div>
        {:else if graphStatus === "available"}
          <section class="tracker-graph-panel">
            <h3>
              {translate("tracker.graph")} · {graphMode === "trend"
                ? translate("tracker.graphTrend")
                : translate("tracker.graphSnapshot")}
            </h3>
            <RankingHistoryChart
              points={graphPoints}
              rank={selectedRow.ladderRank}
              bind:activePoint={activeGraphPoint}
              locale={data.uiLocale}
              scoreLabel={translate("tracker.score")}
              timeLabel={translate("tracker.capturedAt")}
              nameChangeLabel={translate("tracker.nameChange")}
              nameChangeLegend={translate("tracker.nameChangeLegend")}
              ariaLabel={interpolate("tracker.graphAriaLabel", { rank: selectedRow.ladderRank })}
            />
          </section>
        {:else if graphStatus === "error"}
          <div class="tracker-graph-message">
            <p role="alert">{translate("tracker.graphError")}</p>
            <button
              class="btn btn-sm btn-outline touch-target"
              type="button"
              onclick={() => openGraph()}
            >
              <Icon icon="mdi:refresh" class="size-4 shrink-0" aria-hidden="true" />
              {translate("tracker.retry")}
            </button>
          </div>
        {:else if graphStatus === "empty"}
          <p class="tracker-graph-message">{translate("tracker.graphUnavailable")}</p>
        {/if}
      </div>
    </div>
  {/if}
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeDetails} aria-label={translate("tracker.detailsClose")}
      >{translate("tracker.detailsClose")}</button
    >
  </form>
</dialog>

<style>
  .tracker-canvas {
    max-width: 82rem;
    width: 100%;
    min-width: 0;
    overflow-x: clip;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2rem);
    display: grid;
    gap: 1rem;
  }
  .tracker-context {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr);
    align-items: end;
    gap: 1rem;
    padding: 1.25rem 0 1rem;
  }
  .tracker-title-block h1 {
    font-size: clamp(1.75rem, 4vw, 2.6rem);
    font-weight: 800;
    letter-spacing: -0.04em;
  }
  .tracker-status-panel,
  .tracker-workspace-heading,
  .tracker-snapshot-banner {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .tracker-kicker {
    color: var(--color-primary);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .tracker-time-note {
    color: var(--archive-text-muted);
  }
  .tracker-time-travel-content {
    display: grid;
    min-height: 4.75rem;
    align-items: end;
    opacity: 1;
    transition: opacity 160ms ease-out;
  }
  .tracker-time-select-skeleton {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
    gap: 0.25rem 0.75rem;
  }
  .tracker-time-status {
    display: grid;
    min-height: 4.75rem;
    place-items: center start;
    margin: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-time-travel-content {
      transition-duration: 1ms;
    }
  }
  .tracker-snapshot-status-region {
    position: relative;
    height: 0;
    min-width: 0;
    opacity: 0;
    transition: opacity 160ms ease-out;
  }
  .tracker-snapshot-status-region p {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 0;
    right: 0;
    margin: 0;
    transform: translateY(-50%);
    pointer-events: none;
  }
  .tracker-snapshot-status-region.tracker-status-visible {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-snapshot-status-region {
      transition-duration: 1ms;
    }
  }
  .tracker-status-panel {
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    min-height: 4.75rem;
    min-width: 0;
  }
  .tracker-primary-status,
  .tracker-freshness-action,
  .tracker-freshness {
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .tracker-status-skeleton {
    display: grid;
    justify-items: end;
    gap: 0.5rem;
  }
  .tracker-primary-status {
    flex: 1 1 100%;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .tracker-freshness-action {
    gap: 0.75rem;
  }
  .tracker-freshness {
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.25rem 0.75rem;
    color: var(--archive-text-muted);
    font-size: 0.78rem;
    text-align: right;
  }
  .tracker-refresh-action {
    flex: none;
  }
  .tracker-countdown,
  .tracker-countdown-values {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem;
  }
  .tracker-countdown {
    color: var(--color-primary);
    font-weight: 700;
  }
  .tracker-countdown-label {
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tracker-countdown-values {
    font-variant-numeric: tabular-nums;
  }
  .tracker-countdown-values small {
    margin-left: 0;
    font-family: inherit;
    font-size: 0.65em;
  }
  .tracker-control-deck {
    display: grid;
    min-width: 0;
    gap: 0.75rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-default);
    padding: 1rem;
  }
  .tracker-event-picker,
  .tracker-control-row {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }
  .tracker-event-picker {
    min-width: 0;
  }
  .tracker-control-row {
    align-items: stretch;
    border-top: 1px solid var(--archive-border-subtle);
    padding-top: 0.75rem;
  }
  .tracker-ladder-control {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .tracker-tool-action-region {
    position: relative;
    min-width: 0;
    margin-inline-start: auto;
  }
  .tracker-tool-actions {
    display: flex;
    margin-inline-start: auto;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  @media (min-width: 48rem) {
    .tracker-control-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
    .tracker-ladder-control {
      grid-column: 1;
    }
    .tracker-tool-action-region {
      grid-column: 2;
      justify-self: end;
      align-self: center;
    }
  }
  .tracker-share-message {
    display: flex;
    max-width: 100%;
    min-height: 2.75rem;
    align-items: center;
    margin-block-start: 0.5rem;
    margin-inline-start: auto;
    justify-content: flex-end;
    color: color-mix(in srgb, var(--color-success) 78%, var(--color-base-content));
    font-size: 0.8rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
    text-align: right;
  }
  .tracker-goal-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .tracker-goal-field {
    display: grid;
    min-width: 0;
    gap: 0.25rem;
    font-size: 0.78rem;
    font-weight: 700;
  }
  .tracker-goal-field input,
  .tracker-goal-field select {
    min-width: 0;
  }
  .tracker-goal-field input[readonly] {
    color: var(--archive-text-muted);
  }
  .tracker-goal-rate-note {
    margin: 0;
    color: var(--archive-text-muted);
    font-size: 0.78rem;
    line-height: 1.4;
  }
  .tracker-goal-result {
    display: grid;
    min-width: 0;
    gap: 0.75rem;
  }
  .tracker-goal-output {
    display: grid;
    min-width: 0;
    gap: 0.75rem;
    color: var(--color-primary);
    font-size: 0.9rem;
    font-weight: 700;
  }
  .tracker-goal-result-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem 1rem;
    margin: 0;
  }
  .tracker-goal-result-grid div {
    min-width: 0;
  }
  .tracker-goal-result-grid dt {
    color: var(--archive-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
  }
  .tracker-goal-result-grid dd {
    margin: 0.25rem 0 0;
    overflow-wrap: anywhere;
  }
  @media (max-width: 47.999rem), (pointer: coarse) {
    .tracker-control-row {
      display: flex;
      align-items: stretch;
    }
    .tracker-tool-action-region {
      width: 100%;
      margin-inline-start: 0;
    }
    .tracker-tool-actions {
      width: 100%;
      margin-inline-start: 0;
    }
  }
  .tracker-goal-dialog-box {
    display: grid;
    width: min(92vw, 32rem);
    max-width: 32rem;
    max-height: calc(100dvh - 2rem);
    min-width: 0;
    overflow-y: auto;
    overflow-wrap: anywhere;
    gap: 1.25rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-overlay);
    color: var(--archive-text-strong);
    padding: 1.25rem;
  }
  .tracker-goal-dialog::backdrop {
    background: color-mix(in srgb, var(--color-base-content) 38%, transparent);
  }
  :global(html.dark) .tracker-goal-dialog::backdrop {
    background: color-mix(in srgb, var(--archive-surface-canvas) 78%, transparent);
  }
  .tracker-goal-dialog-heading,
  .tracker-goal-dialog-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .tracker-goal-dialog-heading h2,
  .tracker-goal-dialog-heading p {
    margin: 0;
  }
  .tracker-goal-dialog-heading h2 {
    font-size: 1.05rem;
    font-weight: 800;
  }
  .tracker-goal-dialog-heading p {
    margin-top: 0.25rem;
    color: var(--archive-text-muted);
    font-size: 0.8rem;
  }
  .tracker-goal-dialog-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
    padding-top: 1rem;
  }
  @media (max-width: 47.999rem) {
    .tracker-goal-fields {
      grid-template-columns: 1fr;
    }
    .tracker-goal-result-grid {
      grid-template-columns: 1fr;
    }
    .tracker-goal-output {
      min-width: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-tool-actions *,
    .tracker-goal-dialog * {
      transition-duration: 1ms !important;
    }
  }
  .tracker-ladder-switcher {
    position: relative;
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 0.25rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: 9999px;
    background: var(--archive-surface-sunken);
    isolation: isolate;
  }
  .tracker-ladder-indicator {
    position: absolute;
    z-index: -1;
    inset: 0.25rem 50% 0.25rem 0.25rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color-primary) 16%, var(--archive-surface-raised));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 22%, transparent);
    transition:
      transform 180ms ease-out,
      background-color 180ms ease-out;
  }
  .tracker-ladder-indicator-full {
    transform: translateX(100%);
  }
  .tracker-ladder-option {
    position: relative;
    z-index: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-ladder-indicator {
      transition-duration: 1ms;
    }
  }
  .tracker-control-label {
    display: block;
    color: var(--archive-text-muted);
    font-size: 0.72rem;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .tracker-event-combobox {
    position: relative;
    min-width: 0;
    width: min(100%, 38rem);
  }
  .tracker-event-combobox > input {
    width: 100%;
    padding-right: 2.75rem;
    font-variant-numeric: tabular-nums;
  }
  .tracker-event-clear {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
  }
  .tracker-event-suggestions {
    position: absolute;
    z-index: 2;
    top: calc(100% + 0.35rem);
    left: 0;
    display: grid;
    width: 100%;
    max-height: 17rem;
    margin: 0;
    padding: 0.25rem;
    overflow-y: auto;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-overlay);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-base-content) 10%, transparent);
    list-style: none;
  }
  .tracker-event-suggestions li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-radius: var(--radius-field);
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition:
      background-color 160ms ease,
      color 160ms ease;
  }
  .tracker-event-suggestions li:hover,
  .tracker-event-suggestions li[aria-selected="true"] {
    background: color-mix(in srgb, var(--color-primary) 13%, transparent);
    color: var(--color-base-content);
  }
  .tracker-time-travel-panel {
    display: grid;
    grid-template-columns: minmax(14rem, 0.8fr) minmax(18rem, 1.2fr);
    align-items: end;
    gap: 1rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--archive-border-subtle));
    border-radius: var(--radius-box);
    background: color-mix(in srgb, var(--color-primary) 4%, var(--archive-surface-sunken));
    padding: 1rem;
  }
  .tracker-time-travel-copy h2 {
    font-size: 1rem;
    font-weight: 800;
  }
  .tracker-time-control {
    display: grid;
    min-width: 0;
    gap: 0.25rem;
  }
  .tracker-time-selects {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    min-width: min(100%, 32rem);
  }
  .tracker-ranking-workspace {
    display: grid;
    min-width: 0;
    gap: 1rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 30%, var(--archive-border-subtle));
    border-radius: var(--radius-box);
    background: var(--archive-surface-default);
    padding: clamp(1rem, 2.5vw, 1.5rem);
  }
  .tracker-ranking-skeleton {
    display: grid;
    gap: 1rem;
  }
  .tracker-ranking-result-region {
    display: grid;
    min-height: 28rem;
    align-content: start;
  }
  .tracker-ranking-result-message {
    display: grid;
    min-height: 28rem;
    place-items: center;
    align-content: center;
    gap: 1rem;
    margin: 0;
    padding: 2rem;
    color: var(--archive-text-muted);
    text-align: center;
  }
  .tracker-ranking-result-message p {
    margin: 0;
  }
  .tracker-skeleton-heading {
    display: grid;
    gap: 0.5rem;
  }
  .tracker-skeleton-table {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-sunken);
  }
  .tracker-skeleton-row {
    display: grid;
    grid-template-columns: 3.5rem minmax(8rem, 1.5fr) 5rem 4rem 7rem;
    align-items: center;
    gap: 1rem;
    min-height: 4.2rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--archive-border-subtle);
  }
  .tracker-skeleton-row:last-child {
    border-bottom: 0;
  }
  .tracker-skeleton-cards {
    display: none;
  }
  .tracker-skeleton-card {
    display: grid;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-default);
  }
  .tracker-skeleton-card-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tracker-workspace-heading h2 {
    font-size: 1.35rem;
    font-weight: 800;
  }
  .tracker-table-wrap {
    position: relative;
    overflow-x: auto;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-sunken);
    box-shadow: inset 0 1px color-mix(in srgb, var(--color-base-content) 4%, transparent);
  }
  .tracker-table {
    min-width: 48rem;
  }
  .tracker-table th,
  .tracker-table td {
    vertical-align: middle;
  }
  .tracker-table th:first-child,
  .tracker-table td:first-child {
    border-left: 3px solid transparent;
  }
  .tracker-table .tier-top th:first-child {
    border-left-color: var(--color-error);
  }
  .tracker-table .tier-elite th:first-child {
    border-left-color: var(--color-warning);
  }
  .tracker-table .tier-high th:first-child {
    border-left-color: var(--color-info);
  }
  .tracker-table .tier-mid th:first-child {
    border-left-color: var(--color-success);
  }
  .tracker-rank-number,
  .tracker-score {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }
  .tracker-tier {
    display: block;
    margin-top: 0.25rem;
    color: var(--archive-text-muted);
    font-size: 0.62rem;
    font-weight: 750;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .tracker-player-name {
    overflow-wrap: anywhere;
  }
  .tracker-player-cell {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.625rem;
  }
  :global(.tracker-avatar) {
    position: relative;
    display: block;
    flex: 0 0 auto;
    width: 2.5rem;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 0.5rem;
    background: var(--archive-surface-sunken);
  }
  .tracker-detail-wide {
    grid-column: 1 / -1;
  }
  .tracker-profile-player {
    display: grid;
    gap: 0.75rem;
  }
  .tracker-profile-identity {
    display: grid;
    min-width: 0;
    align-content: center;
    gap: 0.5rem;
  }
  .tracker-profile-name {
    color: var(--archive-text-strong);
    font-size: 1.05rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  @media (min-width: 40rem) {
    .tracker-profile-player {
      grid-template-columns: 14rem minmax(0, 1fr);
      align-items: center;
    }
  }
  .tracker-profile-art {
    position: relative;
    display: block;
    flex: 0 0 auto;
    width: min(100%, 14rem);
  }
  .tracker-profile-stats {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 0.75rem;
    pointer-events: none;
  }
  :global(.tracker-profile-card) {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 940 / 530;
    overflow: hidden;
    border-radius: 0.75rem;
    background: var(--archive-surface-sunken);
  }
  .tracker-profile-titles {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .tracker-profile-title {
    display: block;
    width: min(9rem, calc(50% - 0.25rem));
    aspect-ratio: 9 / 4;
  }
  .tracker-profile-title.is-main {
    width: min(100%, 19rem);
    aspect-ratio: 19 / 4;
  }
  .tracker-profile-title.is-placeholder {
    border-radius: 0.5rem;
    background: var(--archive-surface-sunken);
  }
  .tracker-speed {
    color: var(--archive-text-muted);
    font-variant-numeric: tabular-nums;
    font-size: 0.82rem;
  }
  .tracker-ranking-cards {
    display: none;
  }
  .tracker-ranking-tabs {
    display: flex;
    gap: 0.25rem;
    flex-wrap: nowrap;
  }
  .tracker-ranking-tabs-loading {
    display: flex;
    gap: 0.25rem;
  }
  .tracker-ranking-tabs-scroll {
    position: relative;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    padding: 0.25rem 0.75rem;
    mask-image: linear-gradient(
      to right,
      transparent,
      black 0.65rem,
      black calc(100% - 0.65rem),
      transparent
    );
  }
  .tracker-ranking-tabs-shell {
    min-width: 0;
    max-width: 100%;
    min-height: 3.25rem;
  }
  .tracker-chapter-countdown-slot {
    min-width: 0;
    min-height: 0;
  }
  .tracker-current-tab {
    box-shadow: inset 0 -2px var(--color-secondary);
  }
  .tracker-current-tab:not(.btn-primary) {
    border-color: color-mix(in srgb, var(--color-accent) 58%, var(--archive-border-subtle));
    background: color-mix(in srgb, var(--color-accent) 12%, var(--archive-surface-default));
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--color-accent) 24%, transparent),
      inset 0 -2px var(--color-accent);
  }
  .tracker-current-tab.btn-primary {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--color-primary-content) 34%, transparent),
      inset 0 -2px var(--color-primary-content);
  }
  .tracker-current-marker {
    margin-inline-start: 0.25rem;
    color: var(--color-secondary);
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
  }
  .tracker-current-tab.btn-primary .tracker-current-marker {
    color: var(--color-primary-content);
  }
  .tracker-chapter-countdown {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    color: var(--color-primary);
  }
  .tracker-ranking-card {
    display: grid;
    width: 100%;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-default);
    color: inherit;
    text-align: left;
  }
  .tracker-ranking-card:hover,
  .tracker-ranking-card:focus-visible {
    border-color: color-mix(in srgb, var(--color-primary) 45%, var(--archive-border-subtle));
    background: color-mix(in srgb, var(--color-primary) 7%, var(--archive-surface-default));
  }
  .tracker-card-heading {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }
  .tracker-ranking-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: absolute;
    z-index: 1;
    top: 0.5rem;
    right: 0.75rem;
    min-height: 2rem;
    padding: 0.75rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--archive-border-subtle));
    border-radius: 9999px;
    background: color-mix(in srgb, var(--archive-surface-sunken) 92%, transparent);
    color: color-mix(in srgb, var(--color-primary) 80%, var(--color-base-content));
    font-size: 0.85rem;
    font-weight: 700;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-base-content) 10%, transparent);
    opacity: 0;
    animation: tracker-ranking-loading-fade-in 160ms ease-out forwards;
  }
  @keyframes tracker-ranking-loading-fade-in {
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-ranking-loading {
      animation: none;
      opacity: 1;
    }
  }
  .tracker-ranking-row {
    cursor: pointer;
    transition:
      background-color 160ms ease,
      box-shadow 160ms ease;
  }
  .tracker-ranking-row:hover,
  .tracker-ranking-row:focus-visible {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    box-shadow: inset 3px 0 var(--color-primary);
    outline: none;
  }
  .tracker-row-icon {
    width: 2.5rem;
    color: var(--color-primary);
    text-align: center;
  }
  .tracker-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  dt {
    color: var(--archive-text-muted);
    font-size: 0.72rem;
    font-weight: 750;
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .tracker-graph-region {
    display: grid;
    height: clamp(18rem, 52vw, 24.5rem);
    min-height: 18rem;
    margin-top: 1rem;
    overflow: hidden;
  }
  .tracker-graph-loading,
  .tracker-graph-message {
    display: grid;
    min-height: 0;
    place-items: center;
  }
  .tracker-graph-skeleton {
    display: grid;
    width: 100%;
    height: 100%;
    grid-template-rows: 1.25rem minmax(0, 1fr) 0.75rem;
    gap: 0.75rem;
    padding: 0.25rem 0;
  }
  .tracker-graph-skeleton-heading,
  .tracker-graph-skeleton-plot,
  .tracker-graph-skeleton-axis {
    display: block;
    border-radius: var(--radius-box);
    background: color-mix(in srgb, var(--color-base-content) 10%, transparent);
    animation: tracker-graph-skeleton-pulse 1.6s ease-in-out infinite;
  }
  .tracker-graph-skeleton-heading {
    width: 42%;
  }
  .tracker-graph-skeleton-plot {
    border: 1px solid color-mix(in srgb, var(--color-base-content) 10%, transparent);
    background:
      linear-gradient(
        color-mix(in srgb, var(--color-base-content) 8%, transparent) 1px,
        transparent 1px
      ),
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--color-base-content) 8%, transparent) 1px,
        transparent 1px
      ),
      color-mix(in srgb, var(--color-base-content) 4%, transparent);
    background-size:
      100% 25%,
      20% 100%,
      auto;
    animation-delay: 100ms;
  }
  .tracker-graph-skeleton-axis {
    width: 68%;
    animation-delay: 200ms;
  }
  .tracker-graph-panel {
    min-height: 0;
    opacity: 0;
    animation: tracker-graph-fade-in 180ms ease-out forwards;
  }
  .tracker-graph-panel :global(.history-chart) {
    height: calc(100% - 2rem);
    min-height: 0;
  }
  .tracker-graph-message {
    align-content: center;
    gap: 1rem;
    color: var(--archive-text-muted);
    text-align: center;
  }
  .tracker-graph-message p {
    margin: 0;
  }
  @keyframes tracker-graph-fade-in {
    to {
      opacity: 1;
    }
  }
  @keyframes tracker-graph-skeleton-pulse {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-graph-panel {
      animation: none;
      opacity: 1;
    }
    .tracker-graph-skeleton-heading,
    .tracker-graph-skeleton-plot,
    .tracker-graph-skeleton-axis {
      animation: none;
    }
  }
  @media (max-width: 47.999rem) {
    .tracker-context,
    .tracker-event-picker,
    .tracker-control-row {
      align-items: stretch;
    }
    .tracker-status-panel {
      align-items: stretch;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 6.25rem;
    }
    .tracker-status-skeleton {
      justify-items: start;
    }
    .tracker-primary-status {
      align-items: flex-start;
      flex-direction: column;
      flex-basis: auto;
      gap: 0.5rem;
      justify-content: flex-start;
      width: auto;
    }
    .tracker-freshness-action {
      align-items: flex-end;
      justify-content: space-between;
      gap: 0.75rem;
      border-top: 1px solid var(--archive-border-subtle);
      padding-top: 0.75rem;
    }
    .tracker-freshness {
      justify-content: flex-start;
      text-align: left;
    }
    .tracker-refresh-action {
      min-width: 2.75rem;
      min-height: 2.75rem;
    }
    .tracker-event-combobox {
      width: 100%;
    }
    .tracker-time-travel-panel {
      grid-template-columns: 1fr;
    }
    .tracker-time-selects {
      grid-template-columns: 1fr;
      width: 100%;
    }
    .tracker-time-select-skeleton {
      grid-template-columns: 1fr;
    }
    .tracker-time-control {
      min-width: 100%;
    }
    .tracker-table-wrap {
      display: none;
    }
    .tracker-ranking-skeleton .tracker-skeleton-table {
      display: none;
    }
    .tracker-ranking-skeleton .tracker-skeleton-cards {
      display: grid;
      gap: 0.75rem;
    }
    .tracker-ranking-cards {
      display: grid;
      gap: 0.75rem;
    }
    .tracker-skeleton-row {
      grid-template-columns: 3.25rem minmax(0, 1fr) 4.5rem;
      gap: 0.75rem;
    }
    .tracker-skeleton-row > :nth-child(4),
    .tracker-skeleton-row > :nth-child(5) {
      display: none;
    }
    .tracker-detail-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (min-width: 48rem) {
    .tracker-context {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
    .tracker-status-panel {
      display: grid;
      grid-template-columns: auto auto;
      align-items: center;
      gap: 0.75rem 1.25rem;
    }
    .tracker-primary-status {
      grid-column: 1 / -1;
      grid-row: 1;
    }
    .tracker-freshness-action {
      grid-row: 2;
      grid-column: 1 / -1;
      justify-content: flex-end;
    }
  }
  .tracker-time-travel-panel {
    align-items: start;
  }
  .tracker-time-control {
    position: relative;
    justify-self: end;
  }
  @media (max-width: 47.999rem) {
    .tracker-time-control {
      width: 100%;
      justify-self: stretch;
    }
  }
  .tracker-dialog .modal-box {
    width: min(92vw, 64rem);
    max-width: 64rem;
    max-height: min(85vh, 64rem);
    overflow-y: auto;
  }
  .tracker-identity-strip {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.25rem;
    margin: 0 -0.75rem 0.75rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--archive-border-default);
    background: var(--archive-surface-overlay);
    color: var(--archive-text-strong);
    font-size: 0.75rem;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-100%);
    transition:
      opacity 140ms ease-out,
      transform 140ms ease-out;
  }
  .tracker-identity-strip strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tracker-identity-strip span {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .tracker-identity-strip.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-identity-strip {
      transition-duration: 1ms;
    }
  }
  .tracker-graph-panel {
    margin-top: 1rem;
  }
  .tracker-graph-panel h3 {
    margin-bottom: 0.5rem;
    font-size: 1rem;
    font-weight: 800;
  }
  @media (max-width: 47.999rem) {
    .tracker-graph-region {
      height: 18rem;
    }
    .tracker-dialog .modal-box {
      width: calc(100vw - 2rem);
      max-width: none;
    }
  }
</style>
