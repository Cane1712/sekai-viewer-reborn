import { getTrackerRankLadder, type TrackerRankLadder } from "$lib/tracker-ladders";
import type { ChapterTrackerResult } from "$lib/server/chapter-tracker";
import { calculateRankingElapsedMs, calculateScorePerElapsedHour } from "./tracker-math";
import type { TrackerDateValue } from "$lib/tracker-phase";

export type ChapterRow = ChapterTrackerResult["rankings"][number] & {
  rank: number;
  score: number | null;
  status: "available" | "unavailable";
};

export type ChapterRowSpeedInput = Readonly<{
  score: number | null | undefined;
  startAt: TrackerDateValue;
  timestamp: TrackerDateValue;
}>;

/** Calculates a World Link row rate from that row's captured ranking timestamp. */
export const calculateChapterRowSpeed = ({
  score,
  startAt,
  timestamp
}: ChapterRowSpeedInput): number | null =>
  calculateScorePerElapsedHour({
    score,
    elapsedMs: calculateRankingElapsedMs({ startAt, timestamp })
  });

export const createChapterRows = (
  rankings: ChapterTrackerResult["rankings"],
  ladder: TrackerRankLadder
): ChapterRow[] => {
  const byRank = new Map<number, ChapterTrackerResult["rankings"][number]>();
  for (const ranking of rankings) {
    if (
      typeof ranking.rank === "number" &&
      Number.isSafeInteger(ranking.rank) &&
      typeof ranking.score === "number" &&
      Number.isFinite(ranking.score) &&
      ranking.score >= 0 &&
      !byRank.has(ranking.rank)
    )
      byRank.set(ranking.rank, ranking);
  }

  return getTrackerRankLadder(ladder).map((rank) => {
    const ranking = byRank.get(rank);
    return ranking
      ? { ...ranking, rank, score: ranking.score, status: "available" }
      : {
          rank,
          score: null,
          userId: null,
          userName: null,
          eventId: null,
          timestamp: null,
          leaderCard: null,
          profileHonors: [],
          honorMissions: [],
          status: "unavailable"
        };
  });
};
