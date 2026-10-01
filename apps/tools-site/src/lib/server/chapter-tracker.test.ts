import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventChapterRankingLive: vi.fn(),
  getEventChapterRankingsByEventIdAndCharaId: vi.fn()
}));

vi.mock("@platform/sekai-api-sdk", () => mocks);

import { getChapterTrackerRankings } from "./chapter-tracker";

describe("chapter tracker data layer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the live endpoint only for the current event and filters malformed rows", async () => {
    mocks.getEventChapterRankingLive.mockResolvedValue({
      data: {
        eventRankings: [
          { rank: "2", score: "0", userId: "two" },
          { rank: "1", score: "100", userId: "one" },
          { rank: "1", score: "99", userId: "duplicate" },
          { rank: "bad", score: "5" }
        ]
      }
    });

    await expect(getChapterTrackerRankings("https://api.example.test", "en", 3)).resolves.toEqual({
      status: "invalid-data",
      rankings: []
    });
    expect(mocks.getEventChapterRankingLive).toHaveBeenCalledTimes(1);
  });

  it("uses historical snapshots instead of the live endpoint", async () => {
    mocks.getEventChapterRankingsByEventIdAndCharaId
      .mockResolvedValueOnce({ data: [{ timestamp: "2026-01-01T00:00:00Z" }] })
      .mockResolvedValueOnce({
        data: {
          eventRankings: [
            { rank: 2, score: 0, userId: "two" },
            { rank: 1, score: 100, userId: "one" }
          ]
        }
      });

    await expect(
      getChapterTrackerRankings("https://api.example.test", "en", 3, 42)
    ).resolves.toEqual({
      status: "available",
      rankings: [
        {
          rank: 1,
          score: 100,
          userId: "one",
          userName: null,
          timestamp: null,
          eventId: null,
          leaderCard: null,
          profileHonors: [],
          honorMissions: []
        },
        {
          rank: 2,
          score: 0,
          userId: "two",
          userName: null,
          timestamp: null,
          eventId: null,
          leaderCard: null,
          profileHonors: [],
          honorMissions: []
        }
      ]
    });
    expect(mocks.getEventChapterRankingLive).not.toHaveBeenCalled();
    expect(mocks.getEventChapterRankingsByEventIdAndCharaId).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: { id: 42 },
        query: expect.objectContaining({ charaId: 3, limit: 1 })
      })
    );
  });
});
