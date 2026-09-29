export type HonorGroupMetadata = {
  id: number | null;
  name: string | null;
  honorType: string | null;
  backgroundAssetBundleName: string | null;
  frameName: string | null;
};

export type HonorLevel = {
  assetBundleName: string | null;
  bonus: number | null;
  description: string | null;
  honorId: number | null;
  honorRarity: string | null;
  level: number | null;
};

export type Honor = {
  id: number;
  assetBundleName: string | null;
  group: HonorGroupMetadata | null;
  groupId: number | null;
  honorMissionType: string | null;
  honorRarity: string | null;
  honorType: string | null;
  honorTypeId: number | null;
  levels: HonorLevel[];
  name: string | null;
  seq: number | null;
};

export type HonorGroup = HonorGroupMetadata & {
  id: number;
  honors: Honor[];
};

export type BondsHonorWord = {
  id: number;
  seq: number | null;
  assetBundleName: string | null;
  name: string | null;
};

export type BondsHonorUnit = {
  id: number;
  gameCharacterId: number | null;
  unit: string | null;
  colorCode: string | null;
};

export type BondsHonor = {
  id: number;
  bondsGroupId: number;
  name: string | null;
  honorRarity: string | null;
  levels: { level: number | null; description: string | null }[];
  /** Sorted by seq; the first is the pair's default word. */
  words: BondsHonorWord[];
  units: [BondsHonorUnit | null, BondsHonorUnit | null];
};

/** One character pair (bonds group) and its honors, one per rarity. */
export type BondsHonorGroup = {
  id: number;
  name: string | null;
  honors: BondsHonor[];
};
