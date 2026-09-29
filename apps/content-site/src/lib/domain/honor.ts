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
  /** How the word is unlocked, for example the Kizuna rank to reach. */
  description: string | null;
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
  /** A unit member and a Virtual Singer: the Virtual Singer can wear the member's unit outfit. */
  configurableUnitVirtualSinger: boolean;
};

/**
 * How a player shows a Bonds honor: its word, whether the pair swaps sides (the game's
 * reverse view types), and whether a Virtual Singer wears the partner's unit outfit (the
 * `*_unit_virtual_singer` view types).
 */
export type BondsHonorView = {
  wordId: number | null;
  reverse: boolean;
  unitVirtualSinger: boolean;
};

export const defaultBondsHonorView: BondsHonorView = {
  wordId: null,
  reverse: false,
  unitVirtualSinger: false
};

/** Region data for the Virtual Singer outfit option. */
export type BondsHonorViewData = {
  /** Game character unit IDs by `{gameCharacterId}:{unit}`. */
  characterUnitIds: Record<string, number>;
  /** Unit names by unit key, for example `light_sound`. */
  unitNames: Record<string, string>;
};

/** One character pair (bonds group) and its honors, one per rarity. */
export type BondsHonorGroup = {
  id: number;
  name: string | null;
  honors: BondsHonor[];
};
