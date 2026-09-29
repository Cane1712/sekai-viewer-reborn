import {
  normalizeHonorDegreeRarity,
  type HonorDegreeInput,
  type HonorDegreeAssetResolver
} from "@platform/ui-shell";
import { getRemoteAssetEndpointURL } from "$lib/assets/index";
import {
  defaultBondsHonorView,
  type BondsHonor,
  type BondsHonorView,
  type BondsHonorViewData,
  type Honor,
  type HonorGroupMetadata,
  type HonorLevel
} from "$lib/domain/honor";
import type { SupportedRegion } from "$lib/domain/regions";

export type CatalogueHonorDegree = { main: HonorDegreeInput; sub: HonorDegreeInput };

const LIVE_MASTER_MISSION_TYPES = new Set([
  "easy_full_combo",
  "normal_full_combo",
  "hard_full_combo",
  "expert_full_combo",
  "master_full_combo",
  "master_full_perfect",
  "append_full_combo",
  "append_full_perfect"
]);

const normalizeAssetBundleName = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized || null;
};

type HonorDegreeRarity = ReturnType<typeof normalizeHonorDegreeRarity>;

type HonorDegreeAdapterContext = {
  type: string | null;
  liveMaster: boolean;
  event: boolean;
  background: string | null;
  masterBundle: string | null;
  bundle: string | null;
  frameName: string | null;
  rarity: HonorDegreeRarity;
  level: number | null;
};

function getEffectiveHonorLevel(honor: Honor): HonorLevel | undefined {
  const levels = honor.levels.filter(
    (level) => Number.isSafeInteger(level.level) && (level.level ?? 0) > 0
  );
  return levels.find((level) => level.honorRarity === honor.honorRarity) ?? levels[0];
}

function getHonorDegreeBundle(
  background: string | null,
  liveMaster: boolean,
  selectedLevelBundle: string | null,
  masterBundle: string | null
): string | null {
  if (background !== null) return background;
  if (liveMaster && selectedLevelBundle !== null) return selectedLevelBundle;
  return masterBundle;
}

function getNormalHonorType(
  type: string | null,
  liveMaster: boolean,
  event: boolean
): "event" | "birthday" | "live-master" | "regular" {
  if (liveMaster) return "live-master";
  if (event) return "event";
  if (type === "birthday") return "birthday";
  return "regular";
}

function createRankMatchHonorInput(
  background: string | null,
  masterBundle: string | null,
  rarity: HonorDegreeRarity
): HonorDegreeInput {
  if (background === null && masterBundle === null) return { kind: "empty" };

  return {
    kind: "rank-match",
    assetBundleName: masterBundle,
    backgroundAssetBundleName: background,
    rarity,
    frameBundlePath: "local/honor"
  };
}

function createEventRankAsset(
  event: boolean,
  masterBundle: string | null,
  main: boolean
): { bundlePath: string; resourceName: string } | null {
  if (!event || masterBundle === null) return null;

  let slot: "main" | "sub";
  if (main) {
    slot = "main";
  } else {
    slot = "sub";
  }

  return {
    bundlePath: `honor/${masterBundle}`,
    resourceName: `rank_${slot}.png`
  };
}

function resolveHonorDegreeInput(
  context: HonorDegreeAdapterContext,
  main: boolean
): HonorDegreeInput {
  if (context.type === "rank_match" && !context.liveMaster) {
    return createRankMatchHonorInput(context.background, context.masterBundle, context.rarity);
  }
  if (context.event && context.masterBundle === null) return { kind: "empty" };

  return {
    kind: "normal",
    honorType: getNormalHonorType(context.type, context.liveMaster, context.event),
    assetBundleName: context.bundle,
    group: { frameName: context.frameName },
    frameBundlePath: "local/honor",
    rarity: context.rarity ?? 0,
    level: context.level,
    rankAsset: createEventRankAsset(context.event, context.masterBundle, main)
  };
}

export function toCatalogueHonorDegree(
  honor: Honor,
  group: HonorGroupMetadata
): CatalogueHonorDegree {
  const effective = getEffectiveHonorLevel(honor);
  const rarity =
    normalizeHonorDegreeRarity(honor.honorRarity) ??
    normalizeHonorDegreeRarity(effective?.honorRarity);
  const type = group.honorType ?? honor.group?.honorType ?? honor.honorType;
  const liveMaster = LIVE_MASTER_MISSION_TYPES.has(honor.honorMissionType ?? "");
  const background =
    normalizeAssetBundleName(group.backgroundAssetBundleName) ??
    normalizeAssetBundleName(honor.group?.backgroundAssetBundleName);
  const masterBundle = normalizeAssetBundleName(honor.assetBundleName);
  const selectedLevelBundle = normalizeAssetBundleName(effective?.assetBundleName);
  const frameName =
    normalizeAssetBundleName(group.frameName) ?? normalizeAssetBundleName(honor.group?.frameName);
  const chapterRank = masterBundle !== null && /_cp\d+$/.test(masterBundle);
  const event = !liveMaster && type === "event" && (background !== null || chapterRank);
  const context: HonorDegreeAdapterContext = {
    type,
    liveMaster,
    event,
    background,
    masterBundle,
    bundle: getHonorDegreeBundle(background, liveMaster, selectedLevelBundle, masterBundle),
    frameName,
    rarity,
    level: effective?.level ?? null
  };

  return {
    main: resolveHonorDegreeInput(context, true),
    sub: resolveHonorDegreeInput(context, false)
  };
}

export function createHonorDegreeAssetResolver(region: SupportedRegion): HonorDegreeAssetResolver {
  return (bundle, resource) => {
    const name = resource.replace(/\.png$/, "");
    if (bundle === "local/honor") return `/degree/${name}.png`;
    if (bundle === "local/bonds-honor") return `/degree/bonds/${name}.png`;
    if (bundle === "local/live-master") return `/degree/live-master/${name}.png`;
    // Bonds art was re-exported untrimmed (160×136 and 380×80) on 2026-09-27; the
    // query skips trimmed copies still in Cloudflare and browser caches (14 days).
    if (/^bonds_honor\/(character|word)$/.test(bundle)) {
      return `${getRemoteAssetEndpointURL(`${bundle}/${name}.webp`, region)}?v=2`;
    }
    if (!/^(honor|honor_frame|rank_live\/honor)\//.test(bundle)) return null;
    return getRemoteAssetEndpointURL(`${bundle}/${name}.webp`, region);
  };
}

const twoDigits = (value: number): string => String(value).padStart(2, "0");

const VIRTUAL_SINGER_UNIT = "piapro";

/**
 * The unit whose outfit a Virtual Singer wears in the unit view: the other side's unit
 * when it is a unit member, as the game resolves `*_unit_virtual_singer` view types. Null
 * when both sides are Virtual Singers, which keep their own outfit.
 */
export const getBondsHonorPartnerUnit = (honor: BondsHonor): string | null =>
  honor.units.find((unit) => unit?.unit && unit.unit !== VIRTUAL_SINGER_UNIT)?.unit ?? null;

/** Whether the Virtual Singer outfit option applies: a unit member with a Virtual Singer. */
export const hasBondsHonorOutfitOption = (honor: BondsHonor): boolean =>
  honor.configurableUnitVirtualSinger && getBondsHonorPartnerUnit(honor) !== null;

/**
 * A Bonds honor as a player shows it: the chosen word (the pair's default word, the
 * lowest seq, otherwise), at its first level, optionally with the sides swapped and a
 * Virtual Singer in the partner's unit outfit. Character art is keyed by character unit;
 * word textures carry the rarity + 1.
 */
export function toCatalogueBondsHonorDegree(
  honor: BondsHonor,
  view: BondsHonorView = defaultBondsHonorView,
  viewData: BondsHonorViewData | null = null
): CatalogueHonorDegree {
  const rarity = normalizeHonorDegreeRarity(honor.honorRarity);
  const word = (
    (view.wordId === null ? undefined : honor.words.find((entry) => entry.id === view.wordId)) ??
    honor.words[0]
  )?.assetBundleName;
  const level = honor.levels.find((entry) => (entry.level ?? 0) > 0)?.level ?? null;
  const partnerUnit =
    view.unitVirtualSinger && hasBondsHonorOutfitOption(honor)
      ? getBondsHonorPartnerUnit(honor)
      : null;
  // A Virtual Singer in the unit view uses the character unit of their partner's unit.
  const artUnitId = (unit: BondsHonor["units"][number]): number | undefined =>
    partnerUnit && unit?.unit === VIRTUAL_SINGER_UNIT && unit.gameCharacterId !== null
      ? (viewData?.characterUnitIds[`${unit.gameCharacterId}:${partnerUnit}`] ?? unit.id)
      : unit?.id;
  const character = (unitId: number | undefined) =>
    unitId === undefined
      ? null
      : { bundlePath: "bonds_honor/character", resourceName: `chr_sd_${twoDigits(unitId)}_01` };
  const degree: HonorDegreeInput = {
    kind: "bonds",
    rarity,
    level,
    colors: [honor.units[0]?.colorCode, honor.units[1]?.colorCode],
    characters: [character(artUnitId(honor.units[0])), character(artUnitId(honor.units[1]))],
    word:
      word && rarity !== null
        ? { bundlePath: "bonds_honor/word", resourceName: `${word}_${twoDigits(rarity + 1)}` }
        : null,
    reverse: view.reverse
  };
  return { main: degree, sub: degree };
}
