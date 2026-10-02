import type {
  SharedEventRewardRangeResponse,
  SharedEventRewardResourceBoxDetail
} from "@platform/sekai-master-api-sdk";
import type { HonorDegreeInput } from "@platform/ui-shell";
import { toCatalogueHonorDegree } from "@platform/ui-shell/honor-degree-adapter";
import { asString, parseHonor } from "$lib/honor-master";

export type RewardHonorInput = Extract<HonorDegreeInput, { kind: "normal" | "rank-match" }>;

const positiveLevel = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

/**
 * A rank reward title drawn by the same rules content-site uses: an event title is
 * the event's background with the rank overlay, at the rewarded level.
 */
export const adaptRewardHonor = (
  detail: SharedEventRewardResourceBoxDetail
): RewardHonorInput | null => {
  if (detail.resourceType && detail.resourceType !== "honor") return null;
  // Reward details carry no id; the parser only needs one to accept the record.
  const honor = parseHonor(detail.honor ? { id: 1, ...detail.honor } : null);
  if (!honor) return null;
  const group = honor.group ?? {
    id: honor.groupId,
    name: null,
    honorType: honor.honorType,
    backgroundAssetBundleName: null,
    frameName: null
  };
  if ((group.honorType ?? honor.honorType) === "bonds_honor") return null;

  const degree = toCatalogueHonorDegree(honor, group, positiveLevel(detail.resourceLevel)).main;
  if (degree.kind === "rank-match") return degree;
  return degree.kind === "normal" && degree.assetBundleName ? degree : null;
};

/** Select the first renderable reward honor, retaining a name-only fallback when art is absent. */
export const selectRewardHonor = (
  reward: SharedEventRewardRangeResponse | null | undefined
): { label: string | null; honor: RewardHonorInput | null } => {
  let fallbackLabel: string | null = null;
  for (const rankingReward of reward?.eventRankingRewards ?? []) {
    for (const detail of rankingReward.resourceBox?.details ?? []) {
      const label = asString(detail.honor?.name);
      fallbackLabel ??= label;
      const honor = adaptRewardHonor(detail);
      if (honor) return { label, honor };
    }
  }
  return { label: fallbackLabel, honor: null };
};
