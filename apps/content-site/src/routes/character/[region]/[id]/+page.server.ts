import {
  getCardsByRegionList,
  getGameCharactersByRegionById,
  getGameCharactersByRegionByIdProfile,
  getGameCharactersRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { normalizeRegion } from "$lib/i18n/region";
import type { CharacterRankReference, Mission } from "$lib/domain/mission";
import type { SupportedRegion } from "$lib/domain/regions";
import { supportedRegions } from "$lib/domain/regions";
import { getPositiveInteger } from "$lib/server/catalogue-data";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  normalizeCharacterAvailability,
  parseRelatedCharacterCards,
  parseRelatedCharacterCardTotal
} from "$lib/server/character-detail";
import { parseCharacter, parseCharacterUnits } from "$lib/server/character-list";
import { parseCharacterProfile } from "$lib/server/character-profile";
import { aggregateGameCharacterUnitsByRegion } from "$lib/server/character-pages";
import { fetchCharacterMissions, fetchCharacterRankReferences } from "$lib/server/mission-list";
import { fetchUnitProfiles, getUnitName, toUnitProfileMap } from "$lib/server/unit-profiles";
import type { PageServerLoad } from "./$types";

type CharacterPayload = { character: unknown; loadFailed: boolean };
export type CharacterRanksPayload = { items: CharacterRankReference[]; loadFailed: boolean };
export type CharacterMissionsPayload = { items: Mission[]; loadFailed: boolean };

const supportedRegionSet = new Set<SupportedRegion>(supportedRegions);

const characterExistsInRegion = async (
  baseUrl: string,
  region: SupportedRegion,
  characterId: string
): Promise<boolean> => {
  try {
    const response = await getGameCharactersByRegionById({
      baseUrl,
      path: { region, id: characterId }
    });
    if (response.error || response.data == null) {
      return false;
    }

    const root =
      response.data !== null && typeof response.data === "object" && !Array.isArray(response.data)
        ? (response.data as Record<string, unknown>)
        : null;
    const id = root?.id;
    return (
      (typeof id === "number" && Number.isFinite(id)) ||
      (typeof id === "string" && id.trim().length > 0)
    );
  } catch {
    return false;
  }
};

const resolveAvailableRegions = async ({
  baseUrl,
  characterId,
  region,
  payloadPromise
}: {
  baseUrl: string;
  characterId: string;
  region: SupportedRegion;
  payloadPromise: Promise<CharacterPayload>;
}): Promise<SupportedRegion[]> => {
  try {
    const [, availabilityResponse] = await Promise.all([
      payloadPromise,
      getGameCharactersRegionsByIdAvailability({
        baseUrl,
        path: { id: characterId }
      })
    ]);

    let detectedRegions = availabilityResponse.error
      ? []
      : normalizeCharacterAvailability(availabilityResponse.data).filter(
          (item): item is SupportedRegion => supportedRegionSet.has(item as SupportedRegion)
        );

    if (detectedRegions.length === 0) {
      const probes = await Promise.all(
        supportedRegions.map(async (candidate) =>
          (await characterExistsInRegion(baseUrl, candidate, characterId)) ? candidate : null
        )
      );
      detectedRegions = probes.filter((item): item is SupportedRegion => item !== null);
    }

    return detectedRegions.includes(region) ? detectedRegions : [region, ...detectedRegions];
  } catch {
    return [region];
  }
};

export const load: PageServerLoad = async ({ params }) => {
  const region = normalizeRegion(params.region);
  const characterId = params.id?.trim() ?? "";
  const baseUrl = getMasterApiBaseUrl();

  const payload = characterId
    ? Promise.all([
        getGameCharactersByRegionById({ baseUrl, path: { region, id: characterId } }),
        getGameCharactersByRegionByIdProfile({ baseUrl, path: { region, id: characterId } }),
        aggregateGameCharacterUnitsByRegion(baseUrl, region, "id", "asc"),
        fetchUnitProfiles(baseUrl, region),
        getCardsByRegionList({
          baseUrl,
          path: { region },
          query: {
            page: 1,
            page_size: 12,
            character: characterId,
            spoiler: true,
            sort_by: "releaseAt",
            sort_order: "desc"
          }
        })
      ])
        .then(([characterResponse, profileResponse, unitsResult, unitProfiles, cardsResponse]) => {
          if (characterResponse.error) return { character: null, loadFailed: false as const };
          const units = unitsResult.loadFailed ? [] : parseCharacterUnits(unitsResult.data);
          const character = parseCharacter(characterResponse.data, units);
          const unitName = character
            ? getUnitName(toUnitProfileMap(unitProfiles), character.unit)
            : null;
          return {
            character: character
              ? {
                  ...character,
                  unitName,
                  profile: profileResponse.error
                    ? null
                    : parseCharacterProfile(profileResponse.data),
                  relatedCards: cardsResponse.error
                    ? []
                    : parseRelatedCharacterCards(cardsResponse.data),
                  relatedCardTotal: cardsResponse.error
                    ? null
                    : parseRelatedCharacterCardTotal(cardsResponse.data)
                }
              : null,
            loadFailed: false as const
          };
        })
        .catch(() => ({ character: null, loadFailed: true as const }))
    : Promise.resolve({ character: null, loadFailed: false as const });

  const numericCharacterId = getPositiveInteger(characterId);
  const characterRanks: Promise<CharacterRanksPayload> =
    numericCharacterId === null
      ? Promise.resolve({ items: [], loadFailed: false })
      : fetchCharacterRankReferences(baseUrl, region, numericCharacterId)
          .then((items) => ({ items, loadFailed: false }))
          .catch(() => ({ items: [], loadFailed: true }));
  const characterMissions: Promise<CharacterMissionsPayload> =
    numericCharacterId === null
      ? Promise.resolve({ items: [], loadFailed: false })
      : fetchCharacterMissions(baseUrl, region, numericCharacterId)
          .then((items) => ({ items, loadFailed: false }))
          .catch(() => ({ items: [], loadFailed: true }));

  const availableRegions = characterId
    ? resolveAvailableRegions({
        baseUrl,
        characterId,
        region,
        payloadPromise: payload
      })
    : Promise.resolve([region]);

  payload.catch(() => {});
  characterRanks.catch(() => {});
  characterMissions.catch(() => {});
  availableRegions.catch(() => {});
  return { region, characterId, payload, characterRanks, characterMissions, availableRegions };
};
