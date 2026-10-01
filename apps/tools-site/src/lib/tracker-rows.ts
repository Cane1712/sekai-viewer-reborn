import {
  calculateRankingElapsedMs,
  calculateScorePerElapsedHour,
  type ScorePerElapsedHour
} from "./tracker-math";
import type { TrackerDateValue } from "$lib/tracker-phase";
import type {
  TrackerHonorMission,
  TrackerLeaderCard,
  TrackerProfileHonor
} from "$lib/tracker-player-profile";

export type TrackerRankingRecord = Readonly<{
  rank: number | null | undefined;
  score: number | null | undefined;
  userId?: string | null;
  userName?: string | null;
  timestamp?: string | null;
  leaderCard?: TrackerLeaderCard | null;
  profileHonors?: readonly TrackerProfileHonor[];
  honorMissions?: readonly TrackerHonorMission[];
}>;

export type TrackerGraphPoint = Readonly<{
  rank: number;
  score: number;
  timestamp: string | null;
}>;

export type TrackerRow<TReward = never> = Readonly<{
  ladderRank: number;
  status: "available" | "unavailable";
  ranking: TrackerRankingRecord | null;
  score: number | null;
  speedPerHour: ScorePerElapsedHour;
  reward: TReward | null;
  graphPoint: TrackerGraphPoint | null;
}>;

export type CreateTrackerRowsInput<TReward = never> = Readonly<{
  ladderRanks: readonly number[];
  rankings: readonly TrackerRankingRecord[];
  startAt?: TrackerDateValue;
  getReward?: (rank: number) => TReward | null | undefined;
}>;

const isPositiveSafeInteger = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isUsableScore = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Maps each requested ladder rank to its exact ranking record without creating predictions. */
export const createTrackerRows = <TReward = never>({
  ladderRanks,
  rankings,
  startAt,
  getReward
}: CreateTrackerRowsInput<TReward>): TrackerRow<TReward>[] => {
  const rankingsByRank = new Map<number, TrackerRankingRecord>();
  for (const ranking of rankings) {
    if (isPositiveSafeInteger(ranking.rank) && !rankingsByRank.has(ranking.rank)) {
      rankingsByRank.set(ranking.rank, ranking);
    }
  }

  return ladderRanks.map((ladderRank) => {
    const ranking = rankingsByRank.get(ladderRank) ?? null;
    const score = ranking && isUsableScore(ranking.score) ? ranking.score : null;

    return {
      ladderRank,
      status: ranking === null ? "unavailable" : "available",
      ranking,
      score,
      speedPerHour: calculateScorePerElapsedHour({
        score,
        elapsedMs: calculateRankingElapsedMs({ startAt, timestamp: ranking?.timestamp })
      }),
      reward: getReward?.(ladderRank) ?? null,
      graphPoint:
        ranking && score !== null
          ? { rank: ladderRank, score, timestamp: ranking.timestamp ?? null }
          : null
    };
  });
};
