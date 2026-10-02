import { describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));
import type { MissionResourceBoxDetail } from "./mission";
import { getRewardItemIcon } from "./reward-item";
import { summarizeRewardLadder } from "./reward-ladder";

const item = (
  resourceType: string,
  resourceId: number | null = null,
  resourceAssetbundleName: string | null = null
) => ({ resourceType, resourceId, resourceAssetbundleName });

describe("getRewardItemIcon", () => {
  it("builds the in-game icon path for each supported item type", () => {
    expect(getRewardItemIcon(item("jewel"), "jp")?.src).toMatch(
      /sekai-jp-assets\/thumbnail\/common_material\/jewel\.webp$/
    );
    expect(getRewardItemIcon(item("paid_jewel"), "tw")?.src).toMatch(
      /sekai-tc-assets\/thumbnail\/common_material\/jewel\.webp$/
    );
    expect(getRewardItemIcon(item("skill_practice_ticket", 2), "kr")?.src).toMatch(
      /sekai-kr-assets\/thumbnail\/skill_practice_ticket\/ticket2\.webp$/
    );
    expect(getRewardItemIcon(item("boost_item", 3), "jp")?.src).toMatch(
      /thumbnail\/boost_item\/boost_item3\.webp$/
    );
  });

  it("names gacha ticket icons by asset bundle and skips tickets without one", () => {
    expect(getRewardItemIcon(item("gacha_ticket", 17, "mission_gacha_ticket"), "jp")?.src).toMatch(
      /thumbnail\/gacha_ticket\/mission_gacha_ticket\.webp$/
    );
    expect(getRewardItemIcon(item("gacha_ticket", 17), "jp")).toBeNull();
  });

  it("reads MySekai material and tool icons from the JP server by asset bundle", () => {
    expect(getRewardItemIcon(item("mysekai_material", 35, "item_memoria_1"), "tw")?.src).toMatch(
      /sekai-jp-assets\/mysekai\/thumbnail\/material\/item_memoria_1\.webp$/
    );
    expect(getRewardItemIcon(item("mysekai_tool", 10, "ax0005"), "jp")?.src).toMatch(
      /sekai-jp-assets\/mysekai\/thumbnail\/tool\/ax0005\.webp$/
    );
    expect(getRewardItemIcon(item("mysekai_material", 35), "jp")).toBeNull();
  });

  it("names stamp and virtual live archive item icons by asset bundle", () => {
    expect(getRewardItemIcon(item("stamp", 33, "stamp0038"), "tw")?.src).toMatch(
      /sekai-tc-assets\/stamp\/stamp0038\/stamp0038\.webp$/
    );
    expect(
      getRewardItemIcon(item("virtual_live_transition_item", 1, "memory_peace_5th_01"), "jp")?.src
    ).toMatch(/thumbnail\/virtual_live_transition_item\/memory_peace_5th_01\.webp$/);
    expect(getRewardItemIcon(item("stamp", 33), "jp")).toBeNull();
  });

  it("falls back to the JP material icon outside JP", () => {
    const tw = getRewardItemIcon(item("material", 13), "tw");
    expect(tw?.src).toMatch(/sekai-tc-assets\/thumbnail\/material\/material13\.webp$/);
    expect(tw?.fallbackSrc).toMatch(/sekai-jp-assets\/thumbnail\/material\/material13\.webp$/);
    expect(getRewardItemIcon(item("material", 13), "jp")?.fallbackSrc).toBeNull();
  });

  it("shows a title reward as the common_material icon of its rarity", () => {
    const title = (resourceType: string, resourceRarity: string | null) => ({
      ...item(resourceType, 1),
      resourceRarity
    });
    expect(getRewardItemIcon(title("honor", "low"), "jp")?.src).toMatch(
      /sekai-jp-assets\/thumbnail\/common_material\/honor_1\.webp$/
    );
    expect(getRewardItemIcon(title("honor", "highest"), "en")?.src).toMatch(
      /sekai-en-assets\/thumbnail\/common_material\/honor_4\.webp$/
    );
    expect(getRewardItemIcon(title("bonds_honor", "high"), "jp")?.src).toMatch(
      /thumbnail\/common_material\/honor_3\.webp$/
    );
    // An unknown rarity falls back to the plain icon.
    expect(getRewardItemIcon(title("honor", null), "jp")?.src).toMatch(/honor_1\.webp$/);
  });

  it("returns null for items without a known icon path", () => {
    expect(getRewardItemIcon(item("material"), "jp")).toBeNull();
    expect(getRewardItemIcon({ resourceType: null, resourceId: null }, "jp")).toBeNull();
  });
});

describe("summarizeRewardLadder totals", () => {
  const detail = (resourceType: string, resourceId: number | null, quantity: number) =>
    ({
      resourceBoxId: 1,
      resourceBoxPurpose: "character_rank_reward",
      resourceId,
      resourceLevel: null,
      resourceQuantity: quantity,
      resourceType,
      seq: 1
    }) satisfies MissionResourceBoxDetail;

  it("totals each named item separately and currencies by type", () => {
    const steps = [
      [detail("material", 13, 10), detail("jewel", null, 100)],
      [detail("material", 15, 5), detail("jewel", null, 100)],
      [detail("material", 13, 10), detail("stamp", 1, 1), detail("stamp", 2, 1)]
    ];
    const { totals } = summarizeRewardLadder(steps, (step) => step);

    expect(
      totals.map(({ resourceType, quantity, detail }) => [
        resourceType,
        detail.resourceId,
        quantity
      ])
    ).toEqual([
      ["jewel", null, 200],
      ["material", 13, 20],
      ["material", 15, 5],
      ["stamp", 1, 2]
    ]);
  });
});
