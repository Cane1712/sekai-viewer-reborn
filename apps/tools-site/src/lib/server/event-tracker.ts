import { getEventRankingLive, getEventRankingsByEventId } from "@platform/sekai-api-sdk";
import {
  isTrackerSupportedRegion,
  trackerSupportedRegions,
  type TrackerSupportedRegion
} from "$lib/regions";
import { isRestoreResponse, withRequestTimeout } from "./network";
import { CRITICAL_RANK_LADDER } from "$lib/tracker-ladders";
import {
  parseHonorMissions,
  parseLeaderCard,
  parseProfileHonors,
  type TrackerHonorMission,
  type TrackerLeaderCard,
  type TrackerProfileHonor
} from "$lib/tracker-player-profile";

export const trackerRegions: readonly TrackerSupportedRegion[] = [...trackerSupportedRegions];
export type TrackerRegion = TrackerSupportedRegion;

export const isTrackerRegion = (value: string): value is TrackerRegion =>
  isTrackerSupportedRegion(value);

export type EventTrackerRanking = {
  rank: number | null;
  score: number | null;
  userId: string | null;
  userName: string | null;
  eventId: number | null;
  timestamp: string | null;
  leaderCard: TrackerLeaderCard | null;
  profileHonors: TrackerProfileHonor[];
  honorMissions: TrackerHonorMission[];
};

export type EventTrackerSelection =
  { mode: "live"; eventId: null } | { mode: "history"; eventId: number };

export type EventTrackerResult = {
  selection: EventTrackerSelection;
  loadedAt: string | null;
  status: "available" | "sdk-error" | "upstream-error" | "network-error" | "invalid-data";
  rankings: EventTrackerRanking[];
  completeness?: EventTrackerCompleteness;
};

export type EventTrackerCompleteness = {
  status: "complete" | "incomplete" | "accepted-incomplete";
  missingRanks: number[];
};

const LIVE_MAX_ATTEMPTS = 3;
const LIVE_RETRY_DELAYS_MS = [400] as const;

const asObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const unwrapSekaiApiEnvelope = (value: unknown): unknown => {
  let payload = value;
  let envelope = asObject(payload);
  while (envelope && typeof envelope.status === "string" && "data" in envelope) {
    payload = envelope.data;
    envelope = asObject(payload);
  }
  return payload;
};

const getRankingRows = (value: unknown): unknown[] | null => {
  const payload = unwrapSekaiApiEnvelope(value);
  if (Array.isArray(payload)) return payload;
  const page = asObject(payload);
  return Array.isArray(page?.eventRankings) ? page.eventRankings : null;
};

const asSafeInteger = (value: unknown, minimum: number): number | null => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= minimum ? value : null;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null;
  }

  return null;
};

const asRank = (value: unknown): number | null => asSafeInteger(value, 1);
const asScore = (value: unknown): number | null => asSafeInteger(value, 0);
const asEventId = (value: unknown): number | null => asSafeInteger(value, 1);

const asUserId = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value : null;
  const userId = asSafeInteger(value, 0);
  return userId === null ? null : String(userId);
};

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const parseRanking = (value: unknown): EventTrackerRanking | null => {
  const ranking = asObject(value);
  if (!ranking) return null;

  const integerFields = [
    ["rank", asRank],
    ["score", asScore],
    ["eventId", asEventId]
  ] as const;
  if (
    integerFields.some(
      ([field, parser]) => ranking[field] !== undefined && parser(ranking[field]) === null
    )
  ) {
    return null;
  }
  if (ranking.userId !== undefined && asUserId(ranking.userId) === null) return null;
  const stringFields = ["userName", "timestamp"] as const;
  if (
    stringFields.some((field) => ranking[field] !== undefined && asString(ranking[field]) === null)
  ) {
    return null;
  }

  return {
    rank: asRank(ranking.rank),
    score: asScore(ranking.score),
    userId: asUserId(ranking.userId),
    userName: asString(ranking.userName),
    eventId: asEventId(ranking.eventId),
    timestamp: asString(ranking.timestamp),
    leaderCard: parseLeaderCard(ranking.userCard),
    profileHonors: parseProfileHonors(ranking.userProfileHonors),
    honorMissions: parseHonorMissions(ranking.userHonorMissions)
  };
};

export const parseEventTrackerRankings = (payload: unknown): EventTrackerRanking[] | null => {
  if (Array.isArray(payload)) {
    const parsed = payload.map(parseRanking);
    return parsed.every((ranking): ranking is EventTrackerRanking => ranking !== null)
      ? parsed
      : null;
  }

  const root = asObject(payload);
  const data = asObject(root?.data) ?? root;
  if (!data) {
    return null;
  }

  const sources = [data.eventRankings, data.first100, data.border].filter(
    (source): source is unknown[] => source !== undefined
  );
  if (sources.some((source) => !Array.isArray(source))) return null;

  const rankings = sources.flat();
  const parsed = rankings.map(parseRanking);
  if (!parsed.every((ranking): ranking is EventTrackerRanking => ranking !== null)) return null;

  const seen = new Set<string>();
  return parsed.filter((ranking, index) => {
    // A graph response contains many snapshots for the same rank/player. Keep
    // one row per timestamp, while still collapsing duplicate rows inside an
    // individual snapshot response.
    const identity =
      ranking.userId ?? (ranking.score !== null ? `score:${ranking.score}` : `row:${index}`);
    const key = `${ranking.timestamp ?? ""}:${ranking.rank ?? ""}:${identity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getLatestRankingTimestamp = (rankings: EventTrackerRanking[]): string | null => {
  let latest: { value: string; time: number } | null = null;
  for (const timestamp of rankings.map((ranking) => ranking.timestamp)) {
    if (timestamp === null || timestamp.trim() === "") continue;
    const time = Date.parse(timestamp);
    if (!Number.isFinite(time) || (latest !== null && time <= latest.time)) continue;
    latest = { value: timestamp, time };
  }
  return latest?.value ?? null;
};

const withResult = (
  selection: EventTrackerSelection,
  status: EventTrackerResult["status"],
  rankings: EventTrackerRanking[] = []
): EventTrackerResult => ({
  selection,
  loadedAt: getLatestRankingTimestamp(rankings),
  status,
  rankings
});

const getSdkErrorStatus = (response: {
  response?: { status?: number };
}): EventTrackerResult["status"] =>
  response.response?.status === 500 ? "upstream-error" : "sdk-error";

const getLiveCompleteness = (
  region: TrackerRegion,
  rankings: EventTrackerRanking[]
): EventTrackerCompleteness => {
  const presentRanks = new Set(
    rankings.map((ranking) => ranking.rank).filter((rank): rank is number => rank !== null)
  );
  const missingRanks = CRITICAL_RANK_LADDER.filter((rank) => !presentRanks.has(rank));
  const acceptedIncomplete =
    region === "kr" && missingRanks.length === 1 && missingRanks[0] === 50_000;
  let status: EventTrackerCompleteness["status"] = "incomplete";
  if (missingRanks.length === 0) {
    status = "complete";
  } else if (acceptedIncomplete) {
    status = "accepted-incomplete";
  }

  return { status, missingRanks: [...missingRanks] };
};

const waitForLiveRetry = (attempt: number): Promise<void> => {
  const delay = LIVE_RETRY_DELAYS_MS[attempt - 1];
  return delay === undefined
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, delay));
};

const getLiveEventTrackerRankings = async (
  baseUrl: string,
  region: TrackerRegion,
  selection: EventTrackerSelection
): Promise<EventTrackerResult> => {
  let lastRankings: EventTrackerRanking[] = [];
  for (let attempt = 0; attempt < LIVE_MAX_ATTEMPTS; attempt += 1) {
    const response = await withRequestTimeout<Awaited<ReturnType<typeof getEventRankingLive>>>(
      (signal) =>
        getEventRankingLive({ baseUrl, query: { region }, signal } as Parameters<
          typeof getEventRankingLive
        >[0])
    );
    if ("error" in response && response.error)
      return withResult(selection, getSdkErrorStatus(response));
    if (isRestoreResponse(response)) return withResult(selection, "available");

    const rankings = parseEventTrackerRankings(response.data);
    if (!rankings) return withResult(selection, "invalid-data");

    lastRankings = rankings;
    const completeness = getLiveCompleteness(region, rankings);
    if (completeness.status !== "incomplete" || attempt === LIVE_MAX_ATTEMPTS - 1) {
      return {
        ...withResult(selection, "available", rankings),
        completeness
      };
    }
    await waitForLiveRetry(attempt + 1);
  }

  return {
    ...withResult(selection, "available", lastRankings),
    completeness: getLiveCompleteness(region, lastRankings)
  };
};

type LiveInFlightEntries = Map<TrackerRegion, Promise<EventTrackerResult>>;

const liveEventTrackerRankingsInFlight = new Map<string, LiveInFlightEntries>();

const clearLiveEventTrackerRankingsInFlight = (
  baseUrl: string,
  region: TrackerRegion,
  request: Promise<EventTrackerResult>
): void => {
  const entries = liveEventTrackerRankingsInFlight.get(baseUrl);
  if (entries?.get(region) !== request) return;

  entries.delete(region);
  if (entries.size === 0) liveEventTrackerRankingsInFlight.delete(baseUrl);
};

const getLiveEventTrackerRankingsDeduplicated = (
  baseUrl: string,
  region: TrackerRegion,
  selection: EventTrackerSelection
): Promise<EventTrackerResult> => {
  const entries = liveEventTrackerRankingsInFlight.get(baseUrl);
  const existing = entries?.get(region);
  if (existing) return existing;

  const request = getLiveEventTrackerRankings(baseUrl, region, selection);
  const currentEntries = entries ?? new Map<TrackerRegion, Promise<EventTrackerResult>>();
  if (!entries) liveEventTrackerRankingsInFlight.set(baseUrl, currentEntries);
  currentEntries.set(region, request);

  void request
    .finally(() => clearLiveEventTrackerRankingsInFlight(baseUrl, region, request))
    .catch(() => undefined);

  return request;
};

const getHistoricalEventTrackerRankings = async (
  baseUrl: string,
  region: TrackerRegion,
  eventId: number,
  selection: EventTrackerSelection
): Promise<EventTrackerResult> => {
  const latest = await withRequestTimeout<Awaited<ReturnType<typeof getEventRankingsByEventId>>>(
    (signal) =>
      getEventRankingsByEventId({
        baseUrl,
        path: { id: eventId },
        query: { limit: 1, sort: { timestamp: "desc" }, region },
        querySerializer: (query) => {
          const values = query as Record<string, unknown>;
          const sort = values.sort as Record<string, unknown> | undefined;
          return new URLSearchParams({
            limit: String(values.limit),
            "sort[timestamp]": String(sort?.timestamp),
            region: String(values.region)
          }).toString();
        },
        signal
      } as Parameters<typeof getEventRankingsByEventId>[0])
  );
  if ("error" in latest && latest.error) return withResult(selection, getSdkErrorStatus(latest));

  const latestRows = getRankingRows(latest.data);
  if (!latestRows) return withResult(selection, "invalid-data");
  if (latestRows.length === 0) return withResult(selection, "available");

  const timestamp = (asObject(latestRows[0]) as { timestamp?: unknown } | null)?.timestamp;
  if (typeof timestamp !== "string" || !timestamp) return withResult(selection, "invalid-data");

  const response = await withRequestTimeout<Awaited<ReturnType<typeof getEventRankingsByEventId>>>(
    (signal) =>
      getEventRankingsByEventId({
        baseUrl,
        path: { id: eventId },
        query: { timestamp, region },
        signal
      } as Parameters<typeof getEventRankingsByEventId>[0])
  );
  if ("error" in response && response.error)
    return withResult(selection, getSdkErrorStatus(response));

  const rankings = parseEventTrackerRankings(response.data);
  return rankings
    ? withResult(selection, "available", rankings)
    : withResult(selection, "invalid-data");
};

export const getEventTrackerRankings = async (
  baseUrl: string,
  region: TrackerRegion,
  eventId?: number
): Promise<EventTrackerResult> => {
  const selection: EventTrackerSelection =
    eventId === undefined ? { mode: "live", eventId: null } : { mode: "history", eventId };

  try {
    if (eventId === undefined) {
      return await getLiveEventTrackerRankingsDeduplicated(baseUrl, region, selection);
    }

    return await getHistoricalEventTrackerRankings(baseUrl, region, eventId, selection);
  } catch {
    return withResult(selection, "network-error");
  }
};
