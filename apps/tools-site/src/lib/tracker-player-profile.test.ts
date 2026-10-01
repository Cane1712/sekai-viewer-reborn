import { describe, expect, it } from "vitest";
import type { BondsHonor, Honor } from "@platform/ui-shell/honor-degree-adapter";
import {
  getProfileCardLayers,
  parseHonorMissions,
  parseLeaderCard,
  parseProfileHonors,
  toProfileHonorDegrees,
  type TrackerProfileHonor
} from "./tracker-player-profile";

describe("tracker player profile", () => {
  it("picks trained art only for the special_training default image", () => {
    expect(
      parseLeaderCard({
        cardId: 670,
        level: 60,
        masterRank: 2,
        defaultImage: "special_training",
        specialTrainingStatus: "done"
      })
    ).toEqual({ cardId: 670, trained: true, level: 60, masterRank: 2 });
    expect(
      parseLeaderCard({ cardId: "12", defaultImage: "original", specialTrainingStatus: "done" })
    ).toEqual({ cardId: 12, trained: false, level: null, masterRank: 0 });
    expect(parseLeaderCard({ cardId: 1, masterRank: 9 })?.masterRank).toBe(0);
    expect(parseLeaderCard({ defaultImage: "special_training" })).toBeNull();
    expect(parseLeaderCard(null)).toBeNull();
  });

  it("keeps the three profile slots in order and drops malformed entries", () => {
    expect(
      parseProfileHonors([
        { seq: 3, honorId: 30, honorLevel: 2, profileHonorType: "normal" },
        {
          seq: 2,
          honorId: 20,
          honorLevel: 1,
          bondsHonorWordId: 0,
          profileHonorType: "bonds",
          bondsHonorViewType: "reverse_unit_virtual_singer"
        },
        { seq: 1, honorId: 10, profileHonorType: "normal" },
        { seq: 1, honorId: 11, profileHonorType: "normal" },
        { seq: 4, honorId: 40, profileHonorType: "normal" },
        { seq: 2, honorId: 0, profileHonorType: "normal" },
        { seq: 2, honorId: 21, profileHonorType: "unknown" }
      ])
    ).toEqual([
      { kind: "normal", seq: 1, honorId: 10, level: null },
      {
        kind: "bonds",
        seq: 2,
        honorId: 20,
        level: 1,
        wordId: null,
        view: "reverse_unit_virtual_singer"
      },
      { kind: "normal", seq: 3, honorId: 30, level: 2 }
    ]);
    expect(parseProfileHonors(null)).toEqual([]);
  });

  it("lays titles out in the game's slots at the player's level", () => {
    const honor: Honor = {
      id: 10,
      name: "Regular",
      assetBundleName: "honor_10",
      group: null,
      groupId: 1,
      honorMissionType: null,
      honorRarity: "middle",
      honorType: "achievement",
      honorTypeId: null,
      seq: null,
      levels: [
        {
          level: 1,
          honorRarity: "middle",
          assetBundleName: null,
          honorId: 10,
          bonus: null,
          description: null
        }
      ]
    };
    const bondsHonor: BondsHonor = {
      id: 20,
      bondsGroupId: 1,
      name: "Pair",
      honorRarity: "low",
      levels: [{ level: 1, description: null }],
      words: [{ id: 5, seq: 1, assetBundleName: "word", name: null, description: null }],
      units: [
        { id: 1, gameCharacterId: 1, unit: "light_sound", colorCode: null },
        { id: 2, gameCharacterId: 2, unit: "light_sound", colorCode: null }
      ],
      configurableUnitVirtualSinger: false
    };
    const profile: TrackerProfileHonor[] = [
      { kind: "bonds", seq: 1, honorId: 20, level: 4, wordId: 5, view: "reverse" },
      { kind: "normal", seq: 2, honorId: 10, level: 3 },
      { kind: "normal", seq: 3, honorId: 99, level: 1 }
    ];

    const degrees = toProfileHonorDegrees(profile, {
      honors: [honor],
      bondsHonors: [bondsHonor],
      bondsViewData: null
    });

    expect(degrees.map(({ seq, slot, name }) => ({ seq, slot, name }))).toEqual([
      { seq: 1, slot: "main", name: "Pair" },
      { seq: 2, slot: "sub1", name: "Regular" }
    ]);
    expect(degrees[0].degree).toMatchObject({ kind: "bonds", level: 4, reverse: true });
    expect(degrees[1].degree).toMatchObject({ kind: "normal", rarity: 1, level: 3 });
  });
});

describe("profile card layers", () => {
  it("places the L frame, attribute, stars, and Master Rank as the game's prefab does", () => {
    const layers = getProfileCardLayers(
      { attr: "cool", rarityType: "rarity_4" },
      { trained: true, masterRank: 5 }
    );
    expect(layers.map((layer) => layer.name)).toEqual([
      "frame",
      "attribute",
      "rarity-1",
      "rarity-2",
      "rarity-3",
      "rarity-4",
      "master-rank"
    ]);
    expect(layers[0]).toMatchObject({ href: "/card/cardFrame_L_4.png", width: 940, height: 530 });
    expect(layers[1]).toMatchObject({
      href: "/card/icon_attribute_cool_88.png",
      x: 812,
      y: 0,
      width: 88,
      height: 92
    });
    expect(layers[2]).toMatchObject({ href: "/card/rarity_star_afterTraining.png" });
    expect(layers[2].x).toBeCloseTo(24.57);
    expect(layers[2].y).toBeCloseTo(446.48);
    expect(layers[5].y).toBeCloseTo(302.28);
    expect(layers[6]).toMatchObject({ href: "/card/masterRank_L_5.png", x: 812, y: 402 });
  });

  it("uses the birthday frame and icon, and hides Master Rank 0", () => {
    const layers = getProfileCardLayers(
      { attr: "unknown", rarityType: "rarity_birthday" },
      { trained: false, masterRank: 0 }
    );
    expect(layers.map((layer) => layer.href)).toEqual([
      "/card/cardFrame_L_bd.png",
      "/card/rarity_birthday.png"
    ]);
  });
});

describe("Live MASTER clear counts", () => {
  it("keeps well-formed honor missions", () => {
    expect(
      parseHonorMissions([
        { progress: 499, honorMissionType: "expert_full_combo" },
        { progress: -1, honorMissionType: "master_full_combo" },
        { progress: 3 },
        null
      ])
    ).toEqual([{ type: "expert_full_combo", progress: 499 }]);
    expect(parseHonorMissions(null)).toEqual([]);
  });

  it("puts the matching mission's progress on a Live MASTER title", () => {
    const honor: Honor = {
      id: 3009,
      name: "Live MASTER",
      assetBundleName: "honor_3009",
      group: null,
      groupId: 30,
      honorMissionType: "expert_full_combo",
      honorRarity: null,
      honorType: "achievement",
      honorTypeId: null,
      seq: null,
      levels: [
        {
          level: 1,
          honorRarity: "low",
          assetBundleName: "honor_3009_100",
          honorId: 3009,
          bonus: null,
          description: null
        }
      ]
    };
    const [title] = toProfileHonorDegrees(
      [{ kind: "normal", seq: 1, honorId: 3009, level: 1 }],
      { honors: [honor], bondsHonors: [], bondsViewData: null },
      [{ type: "expert_full_combo", progress: 499 }]
    );
    expect(title.degree).toMatchObject({
      honorType: "live-master",
      liveMaster: {
        scroll: { bundlePath: "honor/honor_3009_100", resourceName: "scroll.png" },
        clearCount: 499
      }
    });
  });
});
