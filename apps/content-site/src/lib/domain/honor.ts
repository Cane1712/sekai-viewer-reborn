import type {
  Honor,
  HonorGroupMetadata,
  BondsHonor
} from "@platform/ui-shell/honor-degree-adapter";

export {
  defaultBondsHonorView,
  type BondsHonor,
  type BondsHonorUnit,
  type BondsHonorView,
  type BondsHonorViewData,
  type BondsHonorWord,
  type Honor,
  type HonorGroupMetadata,
  type HonorLevel
} from "@platform/ui-shell/honor-degree-adapter";

export type HonorGroup = HonorGroupMetadata & {
  id: number;
  honors: Honor[];
};

/** One character pair (bonds group) and its honors, one per rarity. */
export type BondsHonorGroup = {
  id: number;
  name: string | null;
  honors: BondsHonor[];
};
