import { describe, expect, it, vi } from "vitest";
import { calculateChapterRowSpeed, createChapterRows } from "./tracker-chapter-rows";

const ranking = (rank: number, score = rank * 100) => ({
  rank,
  score,
  userId: `user-${rank}`,
  userName: `Player ${rank}`,
  eventId: 1,
  timestamp: null,
  leaderCard: null,
  profileHonors: [],
  honorMissions: []
});

const chapterStartAt = "2026-01-01T00:00:00.000Z";

describe("tracker chapter rows", () => {
  it("uses critical ranks and keeps missing ranks unavailable", () => {
    const rows = createChapterRows([ranking(1), ranking(100), ranking(999)], "critical");
    expect(rows.map((row) => row.rank)).toEqual([
      1, 2, 3, 10, 100, 1000, 5000, 10_000, 50_000, 100_000
    ]);
    expect(rows.find((row) => row.rank === 1)).toMatchObject({ status: "available", score: 100 });
    expect(rows.find((row) => row.rank === 2)).toMatchObject({
      status: "unavailable",
      score: null
    });
  });

  it("uses every full rank and ignores off-ladder rows", () => {
    const rows = createChapterRows(
      [ranking(1, 10), ranking(1, 20), ranking(4, 40), ranking(999)],
      "full"
    );
    expect(rows).toHaveLength(30);
    expect(rows.find((row) => row.rank === 1)?.score).toBe(10);
    expect(rows.find((row) => row.rank === 2)?.status).toBe("unavailable");
    expect(rows.find((row) => row.rank === 999)).toBeUndefined();
  });

  it("uses each World Link row timestamp, returns null without one, and ignores clock advances", () => {
    vi.useFakeTimers();
    try {
      const rows = [
        { score: 600, timestamp: "2026-01-01T01:00:00.000Z" },
        { score: 600, timestamp: "2026-01-01T02:00:00.000Z" },
        { score: 600, timestamp: null }
      ];
      vi.setSystemTime(new Date("2026-01-01T02:00:00.000Z"));

      const before = rows.map((row) =>
        calculateChapterRowSpeed({ ...row, startAt: chapterStartAt })
      );
      vi.advanceTimersByTime(60 * 60_000);
      const after = rows.map((row) =>
        calculateChapterRowSpeed({ ...row, startAt: chapterStartAt })
      );

      expect(before).toEqual([600, 300, null]);
      expect(after).toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
