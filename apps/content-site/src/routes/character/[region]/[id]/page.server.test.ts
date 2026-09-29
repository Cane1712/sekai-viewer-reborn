import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test"),
  getGameCharactersByRegionById: vi.fn(),
  getGameCharactersByRegionByIdProfile: vi.fn(),
  getGameCharactersRegionsByIdAvailability: vi.fn(),
  getCardsByRegionList: vi.fn(),
  parseCharacter: vi.fn(),
  parseCharacterUnits: vi.fn(),
  parseCharacterProfile: vi.fn(),
  parseRelatedCharacterCards: vi.fn(),
  parseRelatedCharacterCardTotal: vi.fn(),
  normalizeCharacterAvailability: vi.fn(),
  aggregateGameCharacterUnitsByRegion: vi.fn(),
  fetchCharacterRankReferences: vi.fn(),
  fetchCharacterMissions: vi.fn(),
  fetchUnitProfiles: vi.fn(),
  getUnitName: vi.fn(),
  toUnitProfileMap: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCardsByRegionList: mocks.getCardsByRegionList,
  getGameCharactersByRegionById: mocks.getGameCharactersByRegionById,
  getGameCharactersByRegionByIdProfile: mocks.getGameCharactersByRegionByIdProfile,
  getGameCharactersRegionsByIdAvailability: mocks.getGameCharactersRegionsByIdAvailability
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl: mocks.getMasterApiBaseUrl }));
vi.mock("$lib/server/character-detail", () => ({
  normalizeCharacterAvailability: mocks.normalizeCharacterAvailability,
  parseRelatedCharacterCards: mocks.parseRelatedCharacterCards,
  parseRelatedCharacterCardTotal: mocks.parseRelatedCharacterCardTotal
}));
vi.mock("$lib/server/character-list", () => ({
  parseCharacter: mocks.parseCharacter,
  parseCharacterUnits: mocks.parseCharacterUnits
}));
vi.mock("$lib/server/character-profile", () => ({
  parseCharacterProfile: mocks.parseCharacterProfile
}));
vi.mock("$lib/server/character-pages", () => ({
  aggregateGameCharacterUnitsByRegion: mocks.aggregateGameCharacterUnitsByRegion
}));
vi.mock("$lib/server/mission-list", () => ({
  fetchCharacterRankReferences: mocks.fetchCharacterRankReferences,
  fetchCharacterMissions: mocks.fetchCharacterMissions
}));
vi.mock("$lib/server/unit-profiles", () => ({
  fetchUnitProfiles: mocks.fetchUnitProfiles,
  getUnitName: mocks.getUnitName,
  toUnitProfileMap: mocks.toUnitProfileMap
}));

import { load } from "./+page.server";

type CharacterPageData = {
  region: string;
  characterId: string;
  payload: Promise<{ character: null; loadFailed: boolean }>;
  characterRanks: Promise<{ items: unknown[]; honors: unknown; loadFailed: boolean }>;
  characterMissions: Promise<{ items: unknown[]; loadFailed: boolean }>;
  availableRegions: Promise<string[]>;
};

describe("character detail page load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGameCharactersByRegionById.mockResolvedValue({ error: true });
    mocks.getGameCharactersByRegionByIdProfile.mockResolvedValue({ error: true });
    mocks.getGameCharactersRegionsByIdAvailability.mockResolvedValue({ error: true });
    mocks.getCardsByRegionList.mockResolvedValue({ error: true });
    mocks.parseCharacterUnits.mockReturnValue([]);
    mocks.parseCharacter.mockReturnValue({ id: 7, name: "Miku", unit: null });
    mocks.parseCharacterProfile.mockReturnValue(null);
    mocks.parseRelatedCharacterCards.mockReturnValue([]);
    mocks.parseRelatedCharacterCardTotal.mockReturnValue(0);
    mocks.normalizeCharacterAvailability.mockReturnValue([]);
    mocks.aggregateGameCharacterUnitsByRegion.mockResolvedValue({ loadFailed: true, data: null });
    mocks.fetchCharacterRankReferences.mockResolvedValue([]);
    mocks.fetchCharacterMissions.mockResolvedValue([]);
    mocks.fetchUnitProfiles.mockResolvedValue([]);
    mocks.toUnitProfileMap.mockReturnValue(new Map());
    mocks.getUnitName.mockReturnValue(null);
  });

  it("returns the normalized region with empty character state without requiring layout i18n inputs", async () => {
    const result = (await load({
      params: { region: "invalid", id: "   " }
    } as Parameters<typeof load>[0])) as CharacterPageData;

    expect(result.region).toBe("jp");
    expect(result.characterId).toBe("");
    await expect(result.payload).resolves.toEqual({ character: null, loadFailed: false });
    await expect(result.characterRanks).resolves.toEqual({
      items: [],
      loadFailed: false
    });
    await expect(result.characterMissions).resolves.toEqual({ items: [], loadFailed: false });
    expect(mocks.fetchCharacterMissions).not.toHaveBeenCalled();
    await expect(result.availableRegions).resolves.toEqual(["jp"]);
    expect(mocks.getMasterApiBaseUrl).toHaveBeenCalledOnce();
  });

  it("loads Character Rank references independently from the character payload", async () => {
    mocks.getGameCharactersByRegionById.mockResolvedValue({ data: { id: 7 } });
    mocks.fetchCharacterRankReferences.mockResolvedValue([
      {
        characterRank: 1,
        rewards: [
          {
            id: 10,
            resourceBoxPurpose: null,
            resourceBoxType: null,
            details: [
              {
                resourceBoxId: 10,
                resourceBoxPurpose: null,
                resourceId: 2,
                resourceLevel: null,
                resourceQuantity: 100,
                resourceType: "coin",
                seq: 1
              },
              {
                resourceBoxId: 10,
                resourceBoxPurpose: null,
                resourceId: 4,
                resourceLevel: 2,
                resourceQuantity: 1,
                resourceType: "honor",
                seq: 2
              }
            ]
          }
        ]
      }
    ]);

    const result = (await load({
      params: { region: "jp", id: "7" }
    } as Parameters<typeof load>[0])) as CharacterPageData;

    await expect(result.payload).resolves.toMatchObject({ loadFailed: false });
    await expect(result.characterRanks).resolves.toMatchObject({
      loadFailed: false,
      items: [{ characterRank: 1 }]
    });
    expect(mocks.fetchCharacterRankReferences).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      7
    );
  });

  it("keeps the character payload available when Character Rank loading fails", async () => {
    mocks.getGameCharactersByRegionById.mockResolvedValue({ data: { id: 7 } });
    mocks.fetchCharacterRankReferences.mockRejectedValue(new Error("rank request failed"));

    const result = (await load({
      params: { region: "jp", id: "7" }
    } as Parameters<typeof load>[0])) as CharacterPageData;

    await expect(result.payload).resolves.toMatchObject({
      character: { id: 7 },
      loadFailed: false
    });
    await expect(result.characterRanks).resolves.toEqual({
      items: [],
      loadFailed: true
    });
  });

  it("loads character missions independently from the character payload", async () => {
    mocks.getGameCharactersByRegionById.mockResolvedValue({ data: { id: 7 } });
    mocks.fetchCharacterMissions.mockResolvedValue([{ id: 1001, family: "characterMissionV2s" }]);

    const result = (await load({
      params: { region: "tw", id: "7" }
    } as Parameters<typeof load>[0])) as CharacterPageData;

    await expect(result.characterMissions).resolves.toEqual({
      items: [{ id: 1001, family: "characterMissionV2s" }],
      loadFailed: false
    });
    expect(mocks.fetchCharacterMissions).toHaveBeenCalledWith("https://master-api.test", "tw", 7);
  });

  it("keeps the character payload available when character mission loading fails", async () => {
    mocks.getGameCharactersByRegionById.mockResolvedValue({ data: { id: 7 } });
    mocks.fetchCharacterMissions.mockRejectedValue(new Error("mission request failed"));

    const result = (await load({
      params: { region: "jp", id: "7" }
    } as Parameters<typeof load>[0])) as CharacterPageData;

    await expect(result.payload).resolves.toMatchObject({ loadFailed: false });
    await expect(result.characterRanks).resolves.toMatchObject({ items: [], loadFailed: false });
    await expect(result.characterMissions).resolves.toEqual({ items: [], loadFailed: true });
  });
});
