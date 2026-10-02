import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBondsHonorsByRegionById, getHonorsByRegionById } = vi.hoisted(() => ({
  getBondsHonorsByRegionById: vi.fn(),
  getHonorsByRegionById: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getBondsHonorsByRegionById,
  getHonorsByRegionById
}));
vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));

import { fetchTitlePreview } from "./title-preview";

beforeEach(() => {
  getBondsHonorsByRegionById.mockReset();
  getHonorsByRegionById.mockReset();
});

describe("fetchTitlePreview", () => {
  it("previews a title at the rewarded level with its group and level conditions", async () => {
    getHonorsByRegionById.mockResolvedValue({
      data: {
        id: 1,
        name: "一歌ファン",
        honorRarity: "low",
        assetbundleName: "honor_0001",
        levels: [
          { honorId: 1, level: 1, description: "Rank 5" },
          { honorId: 1, level: 2, description: "Rank 10" }
        ],
        group: { id: 1, name: "一歌", honorType: "character" }
      }
    });

    const preview = await fetchTitlePreview("https://master-api.test", "jp", "honor", 1, 2);

    expect(getHonorsByRegionById).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      path: { region: "jp", id: 1 }
    });
    expect(preview).toMatchObject({
      kind: "honor",
      id: 1,
      name: "一歌ファン",
      rarity: "low",
      subtitle: "一歌",
      levels: [
        { level: 1, description: "Rank 5" },
        { level: 2, description: "Rank 10" }
      ]
    });
    expect(preview?.degree).toMatchObject({ kind: "normal", level: 2 });
  });

  it("takes a Live Master title's rarity from its levels", async () => {
    getHonorsByRegionById.mockResolvedValue({
      data: {
        id: 3009,
        name: "ライブマスター 初級",
        honorRarity: "",
        levels: [{ honorId: 3009, level: 1, honorRarity: "low" }],
        group: { id: 30, name: "ライブマスター", honorType: "achievement" }
      }
    });

    const preview = await fetchTitlePreview("https://master-api.test", "jp", "honor", 3009, null);

    expect(preview?.rarity).toBe("low");
  });

  it("previews a Kizuna title with its default word at the rewarded level", async () => {
    getBondsHonorsByRegionById.mockResolvedValue({
      data: {
        id: 1212603,
        bondsGroupId: 12126,
        name: "ミクとKAITO",
        honorRarity: "high",
        levels: [{ level: 1, description: "Bond rank 5" }],
        words: [
          {
            id: 12126001,
            seq: 1,
            assetbundleName: "honorname_2126_default_2126",
            name: "ミク＆KAITOファン"
          }
        ],
        characterUnit1: { id: 21, colorCode: "#33ccbb" },
        characterUnit2: { id: 26, colorCode: "#3366cc" }
      }
    });

    const preview = await fetchTitlePreview("https://master-api.test", "jp", "bonds", 1212603, 1);

    expect(preview).toMatchObject({
      kind: "bonds",
      name: "ミクとKAITO",
      rarity: "high",
      subtitle: "ミク＆KAITOファン",
      degree: { kind: "bonds", level: 1, colors: ["#33ccbb", "#3366cc"] }
    });
  });

  it("returns null for a title the region does not have", async () => {
    getHonorsByRegionById.mockResolvedValue({ error: { status: 404 } });

    await expect(
      fetchTitlePreview("https://master-api.test", "jp", "honor", 9, null)
    ).resolves.toBeNull();
  });
});
