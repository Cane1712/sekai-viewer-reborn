import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCardsByRegionBatch: vi.fn(),
  getHonorsByRegionById: vi.fn(),
  getBondsHonorsByRegionById: vi.fn(),
  getGameCharacterUnitsByRegionList: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => mocks);

import { clearMetadataCache } from "./metadata-cache";
import {
  clearCardArtCache,
  getTrackerCardArt,
  getTrackerHonorLookup,
  parseIdList
} from "./tracker-profile";

const card = (id: number) => ({
  id,
  prefix: `Card ${id}`,
  assetbundleName: `res${id}`,
  attr: "cool",
  rarityType: "rarity_4"
});

describe("tracker profile lookups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCardArtCache();
    clearMetadataCache();
  });

  it("parses bounded ID lists", () => {
    expect(parseIdList("3,1,3", 3)).toEqual([3, 1]);
    expect(parseIdList("", 3)).toEqual([]);
    expect(parseIdList(null, 3)).toEqual([]);
    expect(parseIdList("1,x", 3)).toBeNull();
    expect(parseIdList("1,2,3,4", 3)).toBeNull();
  });

  it("batches uncached cards and serves repeats from the cache", async () => {
    mocks.getCardsByRegionBatch.mockResolvedValueOnce({ data: { items: [card(1), card(2)] } });
    await expect(getTrackerCardArt("https://master.test", "jp", [1, 2, 3])).resolves.toEqual([
      { id: 1, prefix: "Card 1", assetBundleName: "res1", attr: "cool", rarityType: "rarity_4" },
      { id: 2, prefix: "Card 2", assetBundleName: "res2", attr: "cool", rarityType: "rarity_4" }
    ]);
    expect(mocks.getCardsByRegionBatch).toHaveBeenCalledWith(
      expect.objectContaining({ path: { region: "jp" }, query: { ids: "1,2,3" } })
    );

    mocks.getCardsByRegionBatch.mockResolvedValueOnce({ data: { items: [card(3)] } });
    const cards = await getTrackerCardArt("https://master.test", "jp", [2, 3]);
    expect(cards.map((entry) => entry.id)).toEqual([2, 3]);
    expect(mocks.getCardsByRegionBatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: { ids: "3" } })
    );
  });

  it("splits large card lookups at the batch limit and survives a failed batch", async () => {
    const ids = Array.from({ length: 150 }, (_, index) => index + 1);
    mocks.getCardsByRegionBatch
      .mockResolvedValueOnce({ error: { message: "down" } })
      .mockResolvedValueOnce({ data: { items: [card(101)] } });
    const cards = await getTrackerCardArt("https://master.test", "en", ids);
    expect(mocks.getCardsByRegionBatch).toHaveBeenCalledTimes(2);
    expect(cards.map((entry) => entry.id)).toEqual([101]);
  });

  it("loads titles and only fetches unit data for Virtual Singer pairs", async () => {
    mocks.getHonorsByRegionById.mockResolvedValue({
      data: { id: 59, name: "Regular", groupId: 4, group: { id: 4, honorType: "event" } }
    });
    mocks.getBondsHonorsByRegionById.mockResolvedValue({
      data: {
        id: 1192001,
        bondsGroupId: 119,
        configurableUnitVirtualSinger: true,
        characterUnit1: { id: 21, gameCharacterId: 21, unit: "piapro" },
        characterUnit2: { id: 9, gameCharacterId: 9, unit: "school_refusal" }
      }
    });
    mocks.getGameCharacterUnitsByRegionList.mockResolvedValue({
      data: { items: [{ id: 33, gameCharacterId: 21, unit: "school_refusal" }] }
    });

    const lookup = await getTrackerHonorLookup("https://master.test", "jp", [59], [1192001]);

    expect(lookup.honors).toMatchObject([
      { id: 59, name: "Regular", group: { honorType: "event" } }
    ]);
    expect(lookup.bondsHonors).toMatchObject([{ id: 1192001, bondsGroupId: 119 }]);
    expect(lookup.bondsViewData).toEqual({
      characterUnitIds: { "21:school_refusal": 33 },
      unitNames: {}
    });
  });

  it("leaves out titles that fail to load", async () => {
    mocks.getHonorsByRegionById.mockResolvedValue({ error: { message: "not found" } });
    await expect(getTrackerHonorLookup("https://master.test", "jp", [1], [])).resolves.toEqual({
      honors: [],
      bondsHonors: [],
      bondsViewData: null
    });
    expect(mocks.getGameCharacterUnitsByRegionList).not.toHaveBeenCalled();
  });
});
