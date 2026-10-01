import {
  getBondsHonorsByRegionById,
  getCardsByRegionBatch,
  getGameCharacterUnitsByRegionList,
  getHonorsByRegionById
} from "@platform/sekai-master-api-sdk";
import type {
  BondsHonor,
  BondsHonorViewData,
  Honor
} from "@platform/ui-shell/honor-degree-adapter";
import {
  asArray,
  asObject,
  asPositiveInteger,
  asString,
  isPresent,
  parseBondsHonor,
  parseHonor
} from "$lib/honor-master";
import type { TrackerCardArt, TrackerHonorLookup } from "$lib/tracker-player-profile";
import type { TrackerRegion } from "./event-tracker";
import { getCachedMetadata } from "./metadata-cache";
import { withRequestTimeout } from "./network";

/** Card IDs per master-api batch request (the endpoint's limit). */
export const CARD_BATCH_SIZE = 100;
/** A page lists every leader card at most once: 100 top ranks plus the border ladder. */
export const MAX_CARD_LOOKUP_IDS = 200;
/** A profile has three title slots. */
export const MAX_HONOR_LOOKUP_IDS = 3;

const MASTER_DATA_TTL_MS = 6 * 60 * 60 * 1000;
const CHARACTER_UNIT_PAGE_SIZE = 100;
const CHARACTER_UNIT_MAX_PAGES = 5;

/** Parses a comma-separated ID list; null when any part is not a positive integer. */
export const parseIdList = (value: string | null, limit: number): number[] | null => {
  if (value === null || value.trim() === "") return [];
  const ids = value.split(",").map((part) => asPositiveInteger(part.trim()));
  if (!ids.every(isPresent)) return null;
  const unique = [...new Set(ids)];
  return unique.length <= limit ? unique : null;
};

const parseCardArt = (value: unknown): TrackerCardArt | null => {
  const card = asObject(value);
  const id = asPositiveInteger(card?.id);
  const assetBundleName = asString(card?.assetbundleName);
  if (id === null || assetBundleName === null || !/^[\w-]+$/.test(assetBundleName)) return null;
  return {
    id,
    prefix: asString(card?.prefix),
    assetBundleName,
    attr: asString(card?.attr),
    rarityType: asString(card?.rarityType)
  };
};

type CardArtCacheEntry = { value: TrackerCardArt; expiresAt: number };
const cardArtCache = new Map<string, CardArtCacheEntry>();

export const clearCardArtCache = (): void => cardArtCache.clear();

const fetchCardArtBatch = async (
  baseUrl: string,
  region: TrackerRegion,
  ids: number[]
): Promise<TrackerCardArt[]> => {
  const response = await withRequestTimeout<Awaited<ReturnType<typeof getCardsByRegionBatch>>>(
    (signal) =>
      getCardsByRegionBatch({
        baseUrl,
        path: { region },
        query: { ids: ids.join(",") },
        signal
      } as Parameters<typeof getCardsByRegionBatch>[0])
  );
  if ("error" in response && response.error) throw new Error("Card batch lookup failed");
  return asArray(asObject(response.data)?.items).map(parseCardArt).filter(isPresent);
};

/**
 * Leader card art for ranking avatars. Cards are immutable master data, so each card is
 * cached on its own and only uncached IDs reach the batch endpoint. A failed batch only
 * leaves its cards out.
 */
export const getTrackerCardArt = async (
  baseUrl: string,
  region: TrackerRegion,
  ids: readonly number[],
  now = Date.now
): Promise<TrackerCardArt[]> => {
  const keyFor = (id: number) => `${baseUrl}|${region}|${id}`;
  const timestamp = now();
  const missing = ids.filter((id) => (cardArtCache.get(keyFor(id))?.expiresAt ?? 0) <= timestamp);
  const batches: number[][] = [];
  for (let start = 0; start < missing.length; start += CARD_BATCH_SIZE) {
    batches.push(missing.slice(start, start + CARD_BATCH_SIZE));
  }
  const results = await Promise.allSettled(
    batches.map((batch) => fetchCardArtBatch(baseUrl, region, batch))
  );
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const card of result.value) {
      cardArtCache.set(keyFor(card.id), { value: card, expiresAt: now() + MASTER_DATA_TTL_MS });
    }
  }
  return ids.map((id) => cardArtCache.get(keyFor(id))?.value ?? null).filter(isPresent);
};

const getHonor = (baseUrl: string, region: TrackerRegion, id: number): Promise<Honor | null> =>
  getCachedMetadata(
    `honor|${baseUrl}|${region}|${id}`,
    async () => {
      const response = await withRequestTimeout<Awaited<ReturnType<typeof getHonorsByRegionById>>>(
        (signal) =>
          getHonorsByRegionById({ baseUrl, path: { region, id }, signal } as Parameters<
            typeof getHonorsByRegionById
          >[0])
      );
      return "error" in response && response.error ? null : parseHonor(response.data);
    },
    MASTER_DATA_TTL_MS,
    isPresent
  ).catch(() => null);

const getBondsHonor = (
  baseUrl: string,
  region: TrackerRegion,
  id: number
): Promise<BondsHonor | null> =>
  getCachedMetadata(
    `bonds-honor|${baseUrl}|${region}|${id}`,
    async () => {
      const response = await withRequestTimeout<
        Awaited<ReturnType<typeof getBondsHonorsByRegionById>>
      >((signal) =>
        getBondsHonorsByRegionById({ baseUrl, path: { region, id }, signal } as Parameters<
          typeof getBondsHonorsByRegionById
        >[0])
      );
      return "error" in response && response.error ? null : parseBondsHonor(response.data);
    },
    MASTER_DATA_TTL_MS,
    isPresent
  ).catch(() => null);

/**
 * Character unit IDs by `{gameCharacterId}:{unit}`, which the Virtual Singer outfit
 * view needs. Null when the units cannot be loaded; titles then keep the default outfit.
 */
const getBondsViewData = (
  baseUrl: string,
  region: TrackerRegion
): Promise<BondsHonorViewData | null> =>
  getCachedMetadata(
    `character-units|${baseUrl}|${region}`,
    async (): Promise<BondsHonorViewData | null> => {
      const characterUnitIds: Record<string, number> = {};
      for (let page = 1; page <= CHARACTER_UNIT_MAX_PAGES; page += 1) {
        const response = await withRequestTimeout<
          Awaited<ReturnType<typeof getGameCharacterUnitsByRegionList>>
        >((signal) =>
          getGameCharacterUnitsByRegionList({
            baseUrl,
            path: { region },
            query: { page, page_size: CHARACTER_UNIT_PAGE_SIZE },
            signal
          } as Parameters<typeof getGameCharacterUnitsByRegionList>[0])
        );
        if ("error" in response && response.error) return null;
        const items = asArray(asObject(response.data)?.items);
        for (const item of items) {
          const unit = asObject(item);
          const id = asPositiveInteger(unit?.id);
          const gameCharacterId = asPositiveInteger(unit?.gameCharacterId);
          const unitName = asString(unit?.unit);
          if (id !== null && gameCharacterId !== null && unitName !== null) {
            characterUnitIds[`${gameCharacterId}:${unitName}`] = id;
          }
        }
        if (items.length < CHARACTER_UNIT_PAGE_SIZE) break;
      }
      return { characterUnitIds, unitNames: {} };
    },
    MASTER_DATA_TTL_MS,
    isPresent
  ).catch(() => null);

/** Master data for one player's titles. Unknown or failed IDs are left out. */
export const getTrackerHonorLookup = async (
  baseUrl: string,
  region: TrackerRegion,
  honorIds: readonly number[],
  bondsHonorIds: readonly number[]
): Promise<TrackerHonorLookup> => {
  const [honors, bondsHonors] = await Promise.all([
    Promise.all(honorIds.map((id) => getHonor(baseUrl, region, id))),
    Promise.all(bondsHonorIds.map((id) => getBondsHonor(baseUrl, region, id)))
  ]);
  const loadedBonds = bondsHonors.filter(isPresent);
  return {
    honors: honors.filter(isPresent),
    bondsHonors: loadedBonds,
    bondsViewData: loadedBonds.some((honor) => honor.configurableUnitVirtualSinger)
      ? await getBondsViewData(baseUrl, region)
      : null
  };
};
