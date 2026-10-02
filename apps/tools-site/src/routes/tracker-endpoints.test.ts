import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventRankingTimePoints: vi.fn(),
  getEventRankingsByEventId: vi.fn(),
  getEventChapterRankingLive: vi.fn(),
  getEventChapterRankingsByEventIdAndCharaId: vi.fn(),
  getEventsByRegionList: vi.fn(),
  getEventsByRegionById: vi.fn()
}));

const fetchMock = vi.fn();

vi.mock("@platform/sekai-api-sdk", () => mocks);
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getEventsByRegionList: mocks.getEventsByRegionList,
  getEventsByRegionById: mocks.getEventsByRegionById
}));
vi.mock("$env/dynamic/private", () => ({
  env: {
    SEKAI_API_BASE_URL: "https://api.example.test/",
    SEKAI_MASTER_API_BASE_URL: "https://master.example.test/"
  }
}));

import { GET as graph } from "./tracker/[region]/graph/+server";
import { GET as snapshot } from "./tracker/[region]/snapshot/+server";
import { GET as time } from "./tracker/[region]/time/+server";
import { GET as chapter } from "./tracker/[region]/chapter/+server";
import { GET as eventSearch } from "./tracker/[region]/events/+server";
import { clearMetadataCache } from "$lib/server/metadata-cache";

const request = (path: string, region = "en") =>
  ({ params: { region }, url: new URL(`https://tools.example.test${path}`) }) as never;

describe("tracker time-travel endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetadataCache();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("returns deduplicated time points from the SDK", async () => {
    mocks.getEventRankingTimePoints.mockResolvedValue({
      data: {
        status: "success",
        data: { status: "success", data: ["2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"] }
      }
    });

    const response = await time(request("/tracker/en/time?eventId=42"));

    await expect(response.json()).resolves.toEqual({
      status: "available",
      timePoints: ["2026-01-01T00:00:00Z"]
    });
    expect(mocks.getEventRankingTimePoints).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://api.example.test",
        path: { id: 42 },
        query: { region: "en" }
      })
    );
  });

  it("searches event names through the bounded list query", async () => {
    mocks.getEventsByRegionList.mockResolvedValue({
      data: {
        items: Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          name: `Wonder event ${index + 1}`,
          startAt: "2020-01-01T00:00:00Z"
        }))
      }
    });

    const response = await eventSearch(request("/tracker/en/events?query=Wonder%20event"));

    const body = (await response.json()) as { status: string; events: Array<{ id: number }> };
    expect(body.status).toBe("available");
    expect(body.events).toHaveLength(10);
    expect(body.events.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mocks.getEventsByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://master.example.test",
        path: { region: "en" },
        query: {
          page: 1,
          page_size: 10,
          name: "Wonder event",
          sort_by: "startAt",
          sort_order: "desc"
        }
      })
    );
    expect(mocks.getEventsByRegionById).not.toHaveBeenCalled();
  });

  it("resolves numeric event picker queries through by-id instead of the list", async () => {
    mocks.getEventsByRegionById.mockResolvedValue({
      data: { id: 42, name: "Historical event", startAt: "2020-01-01T00:00:00Z" }
    });

    const response = await eventSearch(request("/tracker/jp/events?query=42", "jp"));

    await expect(response.json()).resolves.toMatchObject({
      status: "available",
      events: [{ id: 42, name: "Historical event" }]
    });
    expect(mocks.getEventsByRegionById).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://master.example.test",
        path: { region: "jp", id: "42" }
      })
    );
    expect(mocks.getEventsByRegionList).not.toHaveBeenCalled();
  });

  it("returns typed empty responses for invalid route and query parameters", async () => {
    await expect((await time(request("/tracker/en/time?eventId=0"))).json()).resolves.toEqual({
      status: "invalid-request",
      timePoints: []
    });
    await expect(
      (await snapshot(request("/tracker/en/snapshot?eventId=42"))).json()
    ).resolves.toEqual({ status: "invalid-request", rankings: [] });
    await expect(
      (await graph(request("/tracker/cn/graph?eventId=42&rank=1", "cn"))).json()
    ).resolves.toEqual({ status: "invalid-request", points: [] });
    await expect(
      (await graph(request("/tracker/en/graph?eventId=42&rank=1&charaId=invalid"))).json()
    ).resolves.toEqual({ status: "invalid-request", points: [] });
    await expect(
      (await graph(request("/tracker/en/graph?eventId=42&rank=1&timestamp=invalid"))).json()
    ).resolves.toEqual({ status: "invalid-request", points: [] });
    await expect(
      (await snapshot(request("/tracker/en/snapshot?eventId=42&timestamp=invalid"))).json()
    ).resolves.toEqual({ status: "invalid-request", rankings: [] });
    await expect(
      (await chapter(request("/tracker/en/chapter?charaId=0&mode=live"))).json()
    ).resolves.toEqual({ status: "invalid-request", rankings: [] });
    expect(mocks.getEventRankingTimePoints).not.toHaveBeenCalled();
    expect(mocks.getEventRankingsByEventId).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts valid ISO and Unix-second timestamps", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValueOnce({ data: { eventRankings: [] } });
    fetchMock.mockResolvedValueOnce(Response.json({ eventRankings: [] }));

    await expect(
      (
        await snapshot(request("/tracker/en/snapshot?eventId=42&timestamp=2026-01-01T00:00:00Z"))
      ).json()
    ).resolves.toEqual({ status: "available", rankings: [] });
    await expect(
      (await graph(request("/tracker/en/graph?eventId=42&rank=1&timestamp=1767225600"))).json()
    ).resolves.toEqual({ status: "available", points: [] });
  });

  it("loads a validated chapter ranking by character id", async () => {
    mocks.getEventChapterRankingLive.mockResolvedValueOnce({
      data: {
        status: "success",
        data: { eventRankings: [{ rank: 1, score: 321, userId: "7", userName: "Bloom" }] }
      }
    });

    await expect(
      (await chapter(request("/tracker/en/chapter?charaId=12&mode=live"))).json()
    ).resolves.toEqual({
      status: "available",
      rankings: [
        {
          rank: 1,
          score: 321,
          userId: "7",
          userName: "Bloom",
          eventId: null,
          timestamp: null,
          leaderCard: null,
          profileHonors: [],
          honorMissions: []
        }
      ]
    });
    expect(mocks.getEventChapterRankingLive).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://api.example.test",
        query: { charaId: 12, region: "en" }
      })
    );
  });

  it("rejects a historical event request routed through live mode", async () => {
    await expect(
      (await chapter(request("/tracker/en/chapter?charaId=12&eventId=42&mode=live"))).json()
    ).resolves.toEqual({ status: "invalid-request", rankings: [] });
    expect(mocks.getEventChapterRankingLive).not.toHaveBeenCalled();
  });

  it("converts upstream errors and rejected requests to typed responses", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValueOnce({ error: true });
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await expect(
      (await snapshot(request("/tracker/en/snapshot?eventId=42&timestamp=2026-01-01"))).json()
    ).resolves.toEqual({ status: "sdk-error", rankings: [] });
    await expect(
      (await graph(request("/tracker/en/graph?eventId=42&rank=1"))).json()
    ).resolves.toEqual({ status: "network-error", points: [] });
  });

  it("recognizes restore responses and rejects malformed payloads", async () => {
    mocks.getEventRankingTimePoints.mockResolvedValueOnce({
      response: { status: 202 },
      data: { restore: true }
    });
    fetchMock.mockResolvedValueOnce(Response.json({ eventRankings: [{ rank: "not-a-rank" }] }));

    await expect((await time(request("/tracker/en/time?eventId=42"))).json()).resolves.toEqual({
      status: "unavailable",
      timePoints: []
    });
    await expect(
      (await graph(request("/tracker/en/graph?eventId=42&rank=1"))).json()
    ).resolves.toEqual({ status: "invalid-data", points: [] });
  });

  it("unwraps production envelopes for snapshots and graph points", async () => {
    mocks.getEventRankingsByEventId.mockResolvedValueOnce({
      data: {
        status: "success",
        data: { totalCount: 1, limit: 1, page: 1, eventRankings: [{ rank: 1, score: 100 }] }
      }
    });
    fetchMock.mockResolvedValueOnce(
      Response.json({
        status: "success",
        data: { eventRankings: [{ rank: 1, score: 100, timestamp: "2026-01-01T00:00:00Z" }] }
      })
    );

    await expect(
      (await snapshot(request("/tracker/en/snapshot?eventId=42&timestamp=2026-01-01"))).json()
    ).resolves.toMatchObject({ status: "available", rankings: [{ rank: 1, score: 100 }] });
    await expect(
      (await graph(request("/tracker/en/graph?eventId=42&rank=1"))).json()
    ).resolves.toMatchObject({
      status: "available",
      points: [{ rank: 1, score: 100, timestamp: "2026-01-01T00:00:00Z" }]
    });
  });

  it("uses the legacy graph URL without a timestamp when no snapshot is selected", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ eventRankings: [] }));

    await expect(
      (await graph(request("/tracker/tw/graph?eventId=176&rank=1", "tw"))).json()
    ).resolves.toEqual({
      status: "available",
      points: []
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/event/176/rankings/graph?region=tw&rank=1",
      { signal: expect.any(AbortSignal) }
    );
  });
});
