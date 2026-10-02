import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventRankingLive: vi.fn(),
  getEventRankingsByEventId: vi.fn()
}));

vi.mock("@platform/sekai-api-sdk", () => mocks);

import { getEventTrackerRankings, parseEventTrackerRankings } from "./event-tracker";

describe("event tracker data layer", () => {
  beforeEach(() => vi.clearAllMocks());

  const completeLiveRows = (timestampForRank?: (rank: number) => string | undefined) => ({
    data: {
      eventRankings: [1, 2, 3, 10, 100, 1000, 5000, 10_000, 50_000, 100_000].map((rank) => {
        const timestamp = timestampForRank?.(rank);
        return timestamp === undefined ? { rank } : { rank, timestamp };
      })
    }
  });

  it("parses the live API's numeric-string ranking fields safely", () => {
    expect(
      parseEventTrackerRankings({
        data: {
          eventRankings: [
            {
              id: "155635838042374144",
              rank: "1",
              score: "44861441",
              userId: "155635838042374144",
              userName: "Player",
              eventId: "42",
              timestamp: "2026-08-08T00:00:00Z",
              userCard: { cardId: 670, defaultImage: "special_training" },
              userProfileHonors: [
                {
                  seq: 2,
                  honorId: 1192001,
                  honorLevel: 3,
                  bondsHonorWordId: 1192001,
                  profileHonorType: "bonds",
                  bondsHonorViewType: "reverse"
                },
                { seq: 1, honorId: 59, honorLevel: 1, profileHonorType: "normal" }
              ]
            }
          ]
        }
      })
    ).toEqual([
      {
        rank: 1,
        score: 44861441,
        userId: "155635838042374144",
        userName: "Player",
        eventId: 42,
        timestamp: "2026-08-08T00:00:00Z",
        leaderCard: { cardId: 670, trained: true, level: null, masterRank: 0 },
        profileHonors: [
          { kind: "normal", seq: 1, honorId: 59, level: 1 },
          {
            kind: "bonds",
            seq: 2,
            honorId: 1192001,
            level: 3,
            wordId: 1192001,
            view: "reverse"
          }
        ],
        honorMissions: []
      }
    ]);
  });

  it("accepts an omitted eventRankings array as empty data", () => {
    expect(parseEventTrackerRankings({ data: {} })).toEqual([]);
  });

  it("keeps graph snapshots for the same rank and player when their timestamps differ", () => {
    expect(
      parseEventTrackerRankings({
        data: {
          eventRankings: [
            { rank: 1, score: 100, userId: "one", timestamp: "2026-08-08T00:00:00Z" },
            { rank: 1, score: 200, userId: "one", timestamp: "2026-08-08T00:30:00Z" },
            { rank: 1, score: 200, userId: "one", timestamp: "2026-08-08T00:30:00Z" }
          ]
        }
      })
    ).toEqual([
      {
        rank: 1,
        score: 100,
        userId: "one",
        eventId: null,
        userName: null,
        timestamp: "2026-08-08T00:00:00Z",
        leaderCard: null,
        profileHonors: [],
        honorMissions: []
      },
      {
        rank: 1,
        score: 200,
        userId: "one",
        eventId: null,
        userName: null,
        timestamp: "2026-08-08T00:30:00Z",
        leaderCard: null,
        profileHonors: [],
        honorMissions: []
      }
    ]);
  });

  it("does not merge rows when both userId and score are absent", () => {
    expect(
      parseEventTrackerRankings({
        data: {
          eventRankings: [
            { rank: 1, timestamp: "2026-08-08T00:00:00Z" },
            { rank: 1, timestamp: "2026-08-08T00:00:00Z" }
          ]
        }
      })
    ).toHaveLength(2);
  });

  it("calls the SDK with the base URL and region", async () => {
    mocks.getEventRankingLive.mockResolvedValue(completeLiveRows());

    await expect(getEventTrackerRankings("https://api.example.test", "en")).resolves.toMatchObject({
      status: "available",
      selection: { mode: "live", eventId: null },
      rankings: expect.any(Array)
    });
    expect(mocks.getEventRankingLive).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://api.example.test",
        query: { region: "en" }
      })
    );
  });

  it("uses the live ranking snapshot timestamp as loadedAt", async () => {
    const timestamp = "2026-08-08T00:00:00Z";
    mocks.getEventRankingLive.mockResolvedValue(completeLiveRows(() => timestamp));

    await expect(getEventTrackerRankings("https://api.example.test", "en")).resolves.toMatchObject({
      loadedAt: timestamp
    });
  });

  it("uses the selected historical snapshot timestamp as loadedAt", async () => {
    const timestamp = "2026-08-08T00:00:00Z";
    mocks.getEventRankingsByEventId
      .mockResolvedValueOnce({ data: [{ timestamp }] })
      .mockResolvedValueOnce({ data: { eventRankings: [{ rank: 1, timestamp }] } });

    await expect(
      getEventTrackerRankings("https://api.example.test", "jp", 42)
    ).resolves.toMatchObject({ loadedAt: timestamp });
  });

  it("uses the latest valid ranking timestamp when rows differ", async () => {
    const older = "2026-08-08T00:00:00Z";
    const latest = "2026-08-08T00:30:00Z";
    mocks.getEventRankingLive.mockResolvedValue(
      completeLiveRows((rank) => (rank === 1 ? older : latest))
    );

    await expect(getEventTrackerRankings("https://api.example.test", "en")).resolves.toMatchObject({
      loadedAt: latest
    });
  });

  it("uses null loadedAt when ranking rows have no timestamp", async () => {
    mocks.getEventRankingLive.mockResolvedValue(completeLiveRows());

    await expect(getEventTrackerRankings("https://api.example.test", "en")).resolves.toMatchObject({
      loadedAt: null
    });
  });

  it("shares a concurrent live request and retry flow for the same base URL and region", async () => {
    vi.useFakeTimers();
    try {
      mocks.getEventRankingLive
        .mockResolvedValueOnce({ data: { eventRankings: [{ rank: 1 }] } })
        .mockResolvedValueOnce(completeLiveRows());

      const first = getEventTrackerRankings("https://api.example.test", "jp");
      const second = getEventTrackerRankings("https://api.example.test", "jp");

      expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(400);

      const [firstResult, secondResult] = await Promise.all([first, second]);
      expect(firstResult).toBe(secondResult);
      expect(firstResult.completeness).toMatchObject({ status: "complete", missingRanks: [] });
      expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows a new live request after the previous request rejects", async () => {
    mocks.getEventRankingLive
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(completeLiveRows());

    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "network-error"
    });
    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "available"
    });
    expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(2);
  });

  it("isolates concurrent live requests by base URL and region", async () => {
    const liveResponse = completeLiveRows();
    const pendingResolvers: Array<(value: typeof liveResponse) => void> = [];
    mocks.getEventRankingLive.mockImplementation(
      () =>
        new Promise<typeof liveResponse>((resolve) => {
          pendingResolvers.push(resolve);
        })
    );

    const requests = [
      getEventTrackerRankings("https://api.example.test", "jp"),
      getEventTrackerRankings("https://other-api.example.test", "jp"),
      getEventTrackerRankings("https://api.example.test", "en")
    ];

    expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(3);
    for (const resolve of pendingResolvers) resolve(liveResponse);
    await Promise.all(requests);
  });

  it("loads and merges historical first100 and border rankings deterministically", async () => {
    mocks.getEventRankingsByEventId
      .mockResolvedValueOnce({ data: [{ timestamp: "2026-08-08T00:00:00Z" }] })
      .mockResolvedValueOnce({
        data: {
          first100: [{ rank: 1, userId: "one", score: 100 }],
          border: [
            { rank: 1, userId: "one", score: 100 },
            { rank: 100, userId: "last", score: 1 }
          ]
        }
      });

    await expect(
      getEventTrackerRankings("https://api.example.test", "jp", 42)
    ).resolves.toMatchObject({
      selection: { mode: "history", eventId: 42 },
      status: "available",
      rankings: [
        { rank: 1, userId: "one" },
        { rank: 100, userId: "last" }
      ]
    });
    expect(mocks.getEventRankingsByEventId).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        baseUrl: "https://api.example.test",
        path: { id: 42 },
        query: { limit: 1, sort: { timestamp: "desc" }, region: "jp" },
        querySerializer: expect.any(Function)
      })
    );
    expect(mocks.getEventRankingsByEventId).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        baseUrl: "https://api.example.test",
        path: { id: 42 },
        query: { timestamp: "2026-08-08T00:00:00Z", region: "jp" }
      })
    );
  });

  it("unwraps the production SDK envelope before selecting a historical snapshot", async () => {
    mocks.getEventRankingsByEventId
      .mockResolvedValueOnce({
        data: {
          status: "success",
          data: {
            totalCount: 1,
            limit: 1,
            page: 1,
            eventRankings: [{ timestamp: "2026-08-08T00:00:00Z" }]
          }
        }
      })
      .mockResolvedValueOnce({
        data: { status: "success", data: { eventRankings: [{ rank: 1, score: 100 }] } }
      });

    await expect(
      getEventTrackerRankings("https://api.example.test", "en", 42)
    ).resolves.toMatchObject({
      status: "available",
      rankings: [{ rank: 1, score: 100 }]
    });
  });

  it.each([
    ["latest lookup", [{ error: true, response: { status: 500 } }], "upstream-error"],
    [
      "snapshot lookup",
      [
        { data: [{ timestamp: "2026-08-08T00:00:00Z" }] },
        { error: true, response: { status: 500 } }
      ],
      "upstream-error"
    ],
    ["non-500 failure", [{ error: true, response: { status: 503 } }], "sdk-error"]
  ] as const)("maps historical %s SDK failure to %s", async (_stage, responses, status) => {
    for (const response of responses)
      mocks.getEventRankingsByEventId.mockResolvedValueOnce(response);

    await expect(
      getEventTrackerRankings("https://api.example.test", "jp", 42)
    ).resolves.toMatchObject({ status });
  });

  it("converts SDK errors, network failures, and malformed data to safe states", async () => {
    mocks.getEventRankingLive.mockResolvedValueOnce({ error: true });
    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "sdk-error"
    });

    mocks.getEventRankingLive.mockRejectedValueOnce(new Error("offline"));
    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "network-error"
    });

    mocks.getEventRankingLive.mockResolvedValueOnce({
      data: { eventRankings: [{ score: "9007199254740992" }] }
    });
    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "invalid-data"
    });

    mocks.getEventRankingLive.mockResolvedValueOnce({
      data: { eventRankings: [{ score: "44.5" }] }
    });
    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "invalid-data"
    });
  });

  it.each([
    [500, "upstream-error"],
    [503, "sdk-error"]
  ] as const)(
    "maps live HTTP %s SDK failures to %s without retrying",
    async (status, expectedStatus) => {
      mocks.getEventRankingLive.mockResolvedValue({ error: true, response: { status } });

      await expect(
        getEventTrackerRankings("https://api.example.test", "jp")
      ).resolves.toMatchObject({
        status: expectedStatus
      });
      expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(1);
    }
  );

  it("retries an incomplete live snapshot and accepts the second complete response", async () => {
    vi.useFakeTimers();
    try {
      mocks.getEventRankingLive
        .mockResolvedValueOnce({ data: { eventRankings: [{ rank: 1 }] } })
        .mockResolvedValueOnce(completeLiveRows());
      const result = getEventTrackerRankings("https://api.example.test", "jp");
      await vi.advanceTimersByTimeAsync(500);
      await expect(result).resolves.toMatchObject({
        completeness: { status: "complete", missingRanks: [] }
      });
      expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves restore responses as unavailable data without retrying", async () => {
    mocks.getEventRankingLive.mockResolvedValue({
      response: { status: 202 },
      data: { restore: true }
    });

    await expect(getEventTrackerRankings("https://api.example.test", "jp")).resolves.toMatchObject({
      status: "available",
      rankings: []
    });
    expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(1);
  });

  it("stops after bounded retries and preserves rows plus missing ranks", async () => {
    vi.useFakeTimers();
    try {
      mocks.getEventRankingLive.mockResolvedValue({
        data: { eventRankings: [{ rank: 1, score: 10 }] }
      });
      const result = getEventTrackerRankings("https://api.example.test", "jp");
      await vi.advanceTimersByTimeAsync(500 + 1500);
      await expect(result).resolves.toMatchObject({
        rankings: [{ rank: 1, score: 10 }],
        completeness: { status: "incomplete", missingRanks: expect.arrayContaining([2, 100_000]) }
      });
      expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks KR missing only rank 50000 as accepted-incomplete", async () => {
    const rows = completeLiveRows();
    rows.data.eventRankings = rows.data.eventRankings.filter(({ rank }) => rank !== 50_000);
    mocks.getEventRankingLive.mockResolvedValue(rows);
    await expect(getEventTrackerRankings("https://api.example.test", "kr")).resolves.toMatchObject({
      completeness: { status: "accepted-incomplete", missingRanks: [50_000] }
    });
    expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(1);
  });

  it("retries KR when the first response misses 50000 and another critical rank, then accepts only 50000 missing", async () => {
    vi.useFakeTimers();
    try {
      const firstRows = completeLiveRows();
      firstRows.data.eventRankings = firstRows.data.eventRankings.filter(
        ({ rank }) => rank !== 50_000 && rank !== 100
      );
      const secondRows = completeLiveRows();
      secondRows.data.eventRankings = secondRows.data.eventRankings.filter(
        ({ rank }) => rank !== 50_000
      );
      mocks.getEventRankingLive.mockResolvedValueOnce(firstRows).mockResolvedValueOnce(secondRows);
      const result = getEventTrackerRankings("https://api.example.test", "kr");
      await vi.advanceTimersByTimeAsync(500);
      await expect(result).resolves.toMatchObject({
        completeness: { status: "accepted-incomplete", missingRanks: [50_000] }
      });
      expect(mocks.getEventRankingLive).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
