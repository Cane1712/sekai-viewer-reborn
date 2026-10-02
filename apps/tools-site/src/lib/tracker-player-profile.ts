import type { HonorDegreeInput } from "@platform/ui-shell";
import {
  toCatalogueBondsHonorDegree,
  toCatalogueHonorDegree,
  type BondsHonor,
  type BondsHonorViewData,
  type Honor
} from "@platform/ui-shell/honor-degree-adapter";
import { asObject, asPositiveInteger } from "$lib/honor-master";

/**
 * The card a ranked player shows as their avatar: the leader of their current deck.
 * The game picks the trained art only when `defaultImage` is `special_training`
 * (jp-6.7.0 `CardUtility.IsDefaultImage`), regardless of `specialTrainingStatus`.
 */
export type TrackerLeaderCard = {
  cardId: number;
  trained: boolean;
  level: number | null;
  /** 0 hides the Master Rank diamond, as `UIPartsMasterLevel.Setup` does. */
  masterRank: number;
};

export type TrackerBondsHonorView = "normal" | "reverse" | "reverse_unit_virtual_singer" | string;

/** One title a player set on their profile; seq 1 is the main slot, 2 and 3 the sub slots. */
export type TrackerProfileHonor =
  | { kind: "normal"; seq: number; honorId: number; level: number | null }
  | {
      kind: "bonds";
      seq: number;
      honorId: number;
      level: number | null;
      wordId: number | null;
      view: TrackerBondsHonorView;
    };

/** A title mission's progress, such as a Live MASTER full-combo count. */
export type TrackerHonorMission = { type: string; progress: number };

/** Keeps well-formed `userHonorMissions` entries; anything else only hides a clear count. */
export const parseHonorMissions = (value: unknown): TrackerHonorMission[] =>
  (Array.isArray(value) ? value : []).flatMap((entry): TrackerHonorMission[] => {
    const mission = asObject(entry);
    const type = typeof mission?.honorMissionType === "string" ? mission.honorMissionType : null;
    const progress = mission?.progress;
    return type && typeof progress === "number" && Number.isSafeInteger(progress) && progress >= 0
      ? [{ type, progress }]
      : [];
  });

/** Card metadata needed to draw an avatar, keyed by card ID in lookup responses. */
export type TrackerCardArt = {
  id: number;
  /** The card's title, used as the avatar's accessible name where it stands alone. */
  prefix: string | null;
  assetBundleName: string;
  attr: string | null;
  rarityType: string | null;
};

/** Master data for a player's titles, as returned by the tracker honor lookup. */
export type TrackerHonorLookup = {
  honors: Honor[];
  bondsHonors: BondsHonor[];
  bondsViewData: BondsHonorViewData | null;
};

const MAX_MASTER_RANK = 5;

/** Malformed or missing card data only hides the avatar; it never rejects the ranking row. */
export const parseLeaderCard = (value: unknown): TrackerLeaderCard | null => {
  const card = asObject(value);
  const cardId = asPositiveInteger(card?.cardId);
  if (cardId === null) return null;
  const masterRank = asPositiveInteger(card?.masterRank);
  return {
    cardId,
    trained: card?.defaultImage === "special_training",
    level: asPositiveInteger(card?.level),
    masterRank: masterRank !== null && masterRank <= MAX_MASTER_RANK ? masterRank : 0
  };
};

const PROFILE_HONOR_SLOTS = 3;

/** Keeps the three profile slots in seq order; malformed entries are dropped. */
export const parseProfileHonors = (value: unknown): TrackerProfileHonor[] => {
  if (!Array.isArray(value)) return [];
  const bySeq = new Map<number, TrackerProfileHonor>();
  for (const entry of value) {
    const honor = asObject(entry);
    const seq = asPositiveInteger(honor?.seq);
    const honorId = asPositiveInteger(honor?.honorId);
    if (!honor || seq === null || seq > PROFILE_HONOR_SLOTS || honorId === null) continue;
    if (bySeq.has(seq)) continue;
    const level = asPositiveInteger(honor.honorLevel);
    if (honor.profileHonorType === "bonds") {
      bySeq.set(seq, {
        kind: "bonds",
        seq,
        honorId,
        level,
        wordId: asPositiveInteger(honor.bondsHonorWordId),
        view: typeof honor.bondsHonorViewType === "string" ? honor.bondsHonorViewType : "normal"
      });
    } else if (honor.profileHonorType === undefined || honor.profileHonorType === "normal") {
      bySeq.set(seq, { kind: "normal", seq, honorId, level });
    }
  }
  return [...bySeq.values()].toSorted((a, b) => a.seq - b.seq);
};

export type TrackerProfileHonorDegree = {
  seq: number;
  slot: "main" | "sub1" | "sub2";
  name: string | null;
  degree: HonorDegreeInput;
};

const slotFor = (seq: number): TrackerProfileHonorDegree["slot"] => {
  if (seq === 1) return "main";
  return seq === 2 ? "sub1" : "sub2";
};

const withLevel = <T extends { level?: number | null }>(degree: T, level: number | null): T =>
  level === null ? degree : { ...degree, level };

/**
 * A player's titles as the game's profile lays them out. Titles missing from the lookup
 * are left out rather than drawn empty.
 */
export const toProfileHonorDegrees = (
  profileHonors: readonly TrackerProfileHonor[],
  lookup: TrackerHonorLookup,
  honorMissions: readonly TrackerHonorMission[] = []
): TrackerProfileHonorDegree[] =>
  profileHonors.flatMap((entry): TrackerProfileHonorDegree[] => {
    const slot = slotFor(entry.seq);
    const main = slot === "main";
    if (entry.kind === "bonds") {
      const honor = lookup.bondsHonors.find((candidate) => candidate.id === entry.honorId);
      if (!honor) return [];
      const view = {
        wordId: entry.wordId,
        reverse: entry.view.startsWith("reverse"),
        unitVirtualSinger: entry.view.endsWith("unit_virtual_singer")
      };
      const degrees = toCatalogueBondsHonorDegree(honor, view, lookup.bondsViewData);
      const degree = main ? degrees.main : degrees.sub;
      return [
        {
          seq: entry.seq,
          slot,
          name: honor.name,
          degree: degree.kind === "bonds" ? withLevel(degree, entry.level) : degree
        }
      ];
    }

    const honor = lookup.honors.find((candidate) => candidate.id === entry.honorId);
    if (!honor) return [];
    const group = honor.group ?? {
      id: honor.groupId,
      name: null,
      honorType: honor.honorType,
      backgroundAssetBundleName: null,
      frameName: null
    };
    // A Live MASTER title shows its mission's progress (HonorUtility.Instantiate's missionProgress).
    const clearCount =
      honorMissions.find((mission) => mission.type === honor.honorMissionType)?.progress ?? null;
    const degrees = toCatalogueHonorDegree(honor, group, entry.level, clearCount);
    return [{ seq: entry.seq, slot, name: honor.name, degree: main ? degrees.main : degrees.sub }];
  });

export type ProfileCardLayer = {
  name: string;
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const PROFILE_CARD_HEIGHT = 530;
const PROFILE_ATTRIBUTES = new Set(["cool", "cute", "happy", "mysterious", "pure"]);
/** Bottom offsets of the four 55.76² `Rarity/Img1..4` slots inside their 58×208 column. */
const PROFILE_RARITY_SLOT_BOTTOMS = [10.76, 58.82, 106.89, 154.96];
const PROFILE_RARITY_SIZE = 55.76;

const profileRarityCount = (rarityType: string | null): number => {
  if (rarityType === "rarity_birthday") return 1;
  const match = /^rarity_([1-4])$/.exec(rarityType ?? "");
  return match ? Number(match[1]) : 0;
};

/**
 * The game's profile leader card overlays (`UserProfileView` LeaderCard, jp-6.7.0 prefab
 * `a64ee6e3ef9f92240b02d1ddb40fe112`) in its 940×530 frame, top-left SVG coordinates:
 * the L rarity frame, the 88×92 attribute at the top right, rarity icons stacked
 * bottom-up in the left column, and the 104×104 Master Rank diamond at the bottom right.
 */
export const getProfileCardLayers = (
  art: Pick<TrackerCardArt, "attr" | "rarityType">,
  leaderCard: Pick<TrackerLeaderCard, "trained" | "masterRank">
): ProfileCardLayer[] => {
  const layers: ProfileCardLayer[] = [];
  const rarityCount = profileRarityCount(art.rarityType);
  const birthday = art.rarityType === "rarity_birthday";
  if (rarityCount > 0) {
    layers.push({
      name: "frame",
      href: `/card/cardFrame_L_${birthday ? "bd" : rarityCount}.png`,
      x: 0,
      y: 0,
      width: 940,
      height: PROFILE_CARD_HEIGHT
    });
  }
  if (art.attr && PROFILE_ATTRIBUTES.has(art.attr)) {
    layers.push({
      name: "attribute",
      href: `/card/icon_attribute_${art.attr}_88.png`,
      x: 940 - 40 - 88,
      y: 0,
      width: 88,
      height: 92
    });
  }
  const star = birthday
    ? "rarity_birthday"
    : `rarity_star_${leaderCard.trained ? "afterTraining" : "normal"}`;
  // The column's bottom-left sits at (24.2, 17) from the card's bottom-left.
  PROFILE_RARITY_SLOT_BOTTOMS.slice(0, rarityCount).forEach((bottom, index) => {
    layers.push({
      name: `rarity-${index + 1}`,
      href: `/card/${star}.png`,
      x: 24.2 + 0.37,
      y: PROFILE_CARD_HEIGHT - 17 - bottom - PROFILE_RARITY_SIZE,
      width: PROFILE_RARITY_SIZE,
      height: PROFILE_RARITY_SIZE
    });
  });
  if (leaderCard.masterRank > 0) {
    layers.push({
      name: "master-rank",
      href: `/card/masterRank_L_${leaderCard.masterRank}.png`,
      x: 940 - 24 - 104,
      y: PROFILE_CARD_HEIGHT - 24 - 104,
      width: 104,
      height: 104
    });
  }
  return layers;
};
