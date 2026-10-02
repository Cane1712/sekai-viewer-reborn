import { describe, expect, it } from "vitest";
import {
  toCatalogueBondsHonorDegree,
  toCatalogueHonorDegree,
  type BondsHonor,
  type Honor,
  type HonorGroupMetadata
} from "./honor-degree-adapter";

const group: HonorGroupMetadata = {
  id: 1,
  name: null,
  honorType: "achievement",
  backgroundAssetBundleName: null,
  frameName: null
};

const level = (value: number, honorRarity: string, assetBundleName: string) => ({
  level: value,
  honorRarity,
  assetBundleName,
  honorId: 1,
  bonus: null,
  description: null
});

const liveMasterHonor: Honor = {
  id: 1,
  name: "Full Combo",
  assetBundleName: "master",
  group: null,
  groupId: 1,
  honorMissionType: "master_full_combo",
  honorRarity: null,
  honorType: null,
  honorTypeId: null,
  seq: null,
  levels: [level(1, "low", "fc_low"), level(3, "high", "fc_high")]
};

describe("honor degree adapter", () => {
  it("shows the catalogue's first level when no player level is given", () => {
    expect(toCatalogueHonorDegree(liveMasterHonor, group).main).toMatchObject({
      kind: "normal",
      honorType: "live-master",
      assetBundleName: "fc_low",
      rarity: 0,
      level: 1
    });
  });

  it("uses a player's level for its rarity and Live Master art", () => {
    expect(toCatalogueHonorDegree(liveMasterHonor, group, 3, 42).main).toMatchObject({
      assetBundleName: "fc_high",
      rarity: 2,
      level: 3,
      liveMaster: {
        scroll: { bundlePath: "honor/fc_high", resourceName: "scroll.png" },
        clearCount: 42
      }
    });
  });

  it("keeps a held level that has no level entry without inventing its art", () => {
    expect(toCatalogueHonorDegree(liveMasterHonor, group, 9).main).toMatchObject({
      assetBundleName: "fc_low",
      level: 9
    });
  });

  it("applies the chosen word and side swap to a Bonds honor", () => {
    const honor: BondsHonor = {
      id: 10,
      bondsGroupId: 1,
      name: "Pair",
      honorRarity: "high",
      levels: [{ level: 1, description: null }],
      words: [
        { id: 1, seq: 1, assetBundleName: "word_a", name: null, description: null },
        { id: 2, seq: 2, assetBundleName: "word_b", name: null, description: null }
      ],
      units: [
        { id: 1, gameCharacterId: 1, unit: "light_sound", colorCode: "#111111" },
        { id: 2, gameCharacterId: 2, unit: "light_sound", colorCode: "#222222" }
      ],
      configurableUnitVirtualSinger: false
    };
    expect(
      toCatalogueBondsHonorDegree(honor, { wordId: 2, reverse: true, unitVirtualSinger: false })
        .main
    ).toMatchObject({
      kind: "bonds",
      reverse: true,
      word: { bundlePath: "bonds_honor/word", resourceName: "word_b_03" }
    });
  });
});
