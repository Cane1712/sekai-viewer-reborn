import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import "$lib/icons/mdi";
import type { Honor } from "$lib/domain/honor";
import type { CharacterRankReference } from "$lib/domain/mission";
import CharacterRankCard from "./CharacterRankCard.svelte";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));

afterEach(cleanup);

const t = (_key: string, fallback: string): string => fallback;

const honor: Honor = {
  id: 1,
  assetBundleName: "honor_0001",
  group: {
    id: 1,
    name: "Ichika fan",
    honorType: "character",
    backgroundAssetBundleName: null,
    frameName: null
  },
  groupId: 1,
  honorMissionType: null,
  honorRarity: "low",
  honorType: null,
  honorTypeId: null,
  levels: [1, 2].map((level) => ({
    assetBundleName: null,
    bonus: 0,
    description: null,
    honorId: 1,
    honorRarity: null,
    level
  })),
  name: "Ichika fan",
  seq: 250
};

const rank = (characterRank: number, honorLevel: number | null): CharacterRankReference => ({
  characterRank,
  powerBonusRate: 0.1,
  rewards: [
    {
      id: 1000 + characterRank,
      resourceBoxPurpose: "character_rank_reward",
      resourceBoxType: "expand",
      details: [
        {
          resourceBoxId: 1000 + characterRank,
          resourceBoxPurpose: "character_rank_reward",
          resourceId: honorLevel === null ? null : 1,
          resourceLevel: honorLevel,
          resourceQuantity: honorLevel === null ? 100 : 1,
          resourceType: honorLevel === null ? "jewel" : "honor",
          seq: 1
        }
      ]
    }
  ]
});

describe("CharacterRankCard honor rewards", () => {
  it("renders a known honor reward as its small degree at the granted level", async () => {
    render(CharacterRankCard, {
      ranks: Promise.resolve({
        items: [rank(1, null), rank(2, null), rank(3, null), rank(5, 1), rank(10, 2)],
        honors: { 1: honor },
        loadFailed: false
      }),
      region: "jp",
      locale: "en",
      t
    });

    expect(await screen.findByRole("img", { name: "Ichika fan Lv.1" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ichika fan Lv.2" })).toBeTruthy();
  });

  it("falls back to the honor label when the honor is unknown", async () => {
    render(CharacterRankCard, {
      ranks: Promise.resolve({
        items: [rank(1, null), rank(2, null), rank(5, 1)],
        loadFailed: false
      }),
      region: "jp",
      locale: "en",
      t
    });

    expect(await screen.findByText("Rank 5")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Lv\./ })).toBeNull();
    expect(screen.getByText("Rank 5").closest("li")?.textContent).toContain("Title");
  });
});
