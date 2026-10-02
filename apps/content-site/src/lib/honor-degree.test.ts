import { describe, expect, it, vi } from "vitest";
import {
  bondsHonorLocalAssetResources,
  buildHonorDegreeLayout,
  liveMasterLocalAssetResources
} from "@platform/ui-shell";
import {
  createHonorDegreeAssetResolver,
  getBondsHonorPartnerUnit,
  hasBondsHonorOutfitOption,
  toCatalogueBondsHonorDegree,
  toCatalogueHonorDegree
} from "./honor-degree";
import type { BondsHonor, Honor, HonorGroupMetadata } from "./domain/honor";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));
const group: HonorGroupMetadata = {
  id: 1,
  name: null,
  honorType: "normal",
  backgroundAssetBundleName: "background",
  frameName: "frame"
};
const honor: Honor = {
  id: 1,
  name: null,
  assetBundleName: "master",
  group: null,
  groupId: 1,
  honorMissionType: null,
  honorRarity: "high",
  honorType: null,
  honorTypeId: null,
  seq: null,
  levels: [
    {
      level: 1,
      honorRarity: "low",
      assetBundleName: "level-low",
      honorId: 1,
      bonus: null,
      description: null
    },
    {
      level: 6,
      honorRarity: "high",
      assetBundleName: "level-high",
      honorId: 1,
      bonus: null,
      description: null
    }
  ]
};
const resolveAsset = createHonorDegreeAssetResolver("tw");

describe("catalogue honor adapter", () => {
  it("prefers the group background bundle for an ordinary honor core", () => {
    const degree = toCatalogueHonorDegree(honor, group);
    expect(degree.main).toMatchObject({ kind: "normal", assetBundleName: "background" });
    expect(
      buildHonorDegreeLayout(degree.main, resolveAsset).layers.find(
        (layer) => layer.name === "body"
      )?.href
    ).toBe("https://assets.test/sekai-tc-assets/honor/background/degree_main.webp");
  });
  it("uses the MasterHonor bundle for grouped event rank overlays while preserving background priority", () => {
    const degree = toCatalogueHonorDegree(honor, { ...group, honorType: "event" });
    for (const slot of ["main", "sub"] as const) {
      expect(degree[slot]).toMatchObject({
        kind: "normal",
        honorType: "event",
        assetBundleName: "background",
        rankAsset: { bundlePath: "honor/master", resourceName: `rank_${slot}.png` }
      });
      const layout = buildHonorDegreeLayout(
        degree[slot],
        resolveAsset,
        slot === "main" ? "main" : "sub1"
      );
      expect(layout.layers.find((layer) => layer.name === "body")?.href).toBe(
        `https://assets.test/sekai-tc-assets/honor/background/degree_${slot}.webp`
      );
      expect(layout.layers.find((layer) => layer.name === "rank")?.href).toBe(
        `https://assets.test/sekai-tc-assets/honor/master/rank_${slot}.webp`
      );
    }
  });
  it("adapts World Link chapter honors to full-root ranks while keeping standard tops ordinary", () => {
    const chapterBundle = "honor_top_000123_event_456_cp2";
    const chapter = toCatalogueHonorDegree(
      { ...honor, assetBundleName: chapterBundle },
      { ...group, honorType: "event", backgroundAssetBundleName: "chapter-body" }
    );
    for (const [slot, renderSlot] of [
      ["main", "main"],
      ["sub", "sub1"]
    ] as const) {
      expect(chapter[slot]).toMatchObject({
        honorType: "event",
        rankAsset: {
          bundlePath: `honor/${chapterBundle}`,
          resourceName: `rank_${slot}.png`
        }
      });
      expect(
        buildHonorDegreeLayout(chapter[slot], resolveAsset, renderSlot).layers.at(-1)
      ).toMatchObject({
        x: 0,
        y: 0,
        width: slot === "main" ? 380 : 180,
        height: 80
      });
    }
    const chapterWithoutBackground = toCatalogueHonorDegree(
      { ...honor, assetBundleName: chapterBundle },
      { ...group, honorType: "event", backgroundAssetBundleName: null }
    );
    expect(chapterWithoutBackground.main).toMatchObject({
      honorType: "event",
      assetBundleName: chapterBundle
    });
    expect(
      buildHonorDegreeLayout(chapterWithoutBackground.main, resolveAsset).layers.at(-1)
    ).toMatchObject({
      x: 0,
      y: 0,
      width: 380,
      height: 80
    });

    const standard = toCatalogueHonorDegree(
      { ...honor, assetBundleName: "honor_top_000001" },
      { ...group, honorType: "event", backgroundAssetBundleName: "honor_top_000001" }
    );
    expect(buildHonorDegreeLayout(standard.sub, resolveAsset, "sub1").layers.at(-1)).toMatchObject({
      x: 30,
      y: 42,
      width: 120,
      height: 38
    });
  });
  it("treats event honors without a group background as regular honors", () => {
    const degree = toCatalogueHonorDegree(honor, {
      ...group,
      honorType: "event",
      backgroundAssetBundleName: null
    });

    for (const slot of ["main", "sub"] as const) {
      expect(degree[slot]).toMatchObject({
        kind: "normal",
        honorType: "regular",
        assetBundleName: "master",
        rankAsset: null
      });
      const layout = buildHonorDegreeLayout(
        degree[slot],
        resolveAsset,
        slot === "main" ? "main" : "sub1"
      );
      expect(layout.layers.find((layer) => layer.name === "body")?.href).toBe(
        `https://assets.test/sekai-tc-assets/honor/master/degree_${slot}.webp`
      );
      expect(layout.layers.some((layer) => layer.name === "rank")).toBe(false);
      expect(
        layout.layers.some(
          (layer) => layer.name.startsWith("level-") || layer.name.startsWith("level-upgraded-")
        )
      ).toBe(true);
    }
  });
  it("does not treat event_point as an event rank overlay", () => {
    const degree = toCatalogueHonorDegree(honor, { ...group, honorType: "event_point" });
    for (const slot of ["main", "sub"] as const) {
      expect(degree[slot]).toMatchObject({
        kind: "normal",
        honorType: "regular",
        assetBundleName: "background",
        rankAsset: null
      });
      const layout = buildHonorDegreeLayout(
        degree[slot],
        resolveAsset,
        slot === "main" ? "main" : "sub1"
      );
      expect(layout.layers.some((layer) => layer.name === "rank")).toBe(false);
      expect(layout.layers.find((layer) => layer.name === "body")?.href).toBe(
        `https://assets.test/sekai-tc-assets/honor/background/degree_${slot}.webp`
      );
    }
  });
  it("does not use level bundles as the core for an ordinary honor without a master bundle", () => {
    const degree = toCatalogueHonorDegree(
      { ...honor, assetBundleName: null },
      { ...group, backgroundAssetBundleName: null, frameName: null }
    );
    expect(degree.main).toMatchObject({ kind: "normal", assetBundleName: null });
    const layers = buildHonorDegreeLayout(degree.main, resolveAsset).layers;
    expect(layers.some((layer) => layer.name === "body")).toBe(false);
    expect(
      layers.some(
        (layer) => layer.name.startsWith("level-") || layer.name.startsWith("level-upgraded-")
      )
    ).toBe(true);
  });
  it.each([
    "easy_full_combo",
    "normal_full_combo",
    "hard_full_combo",
    "expert_full_combo",
    "master_full_combo",
    "master_full_perfect",
    "append_full_combo",
    "append_full_perfect"
  ])("classifies the exact Live Master mission %s", (honorMissionType) => {
    const degree = toCatalogueHonorDegree(
      { ...honor, honorMissionType },
      { ...group, backgroundAssetBundleName: null }
    );

    expect(degree.main).toMatchObject({ kind: "normal", honorType: "live-master" });
    expect(degree.sub).toMatchObject({ kind: "normal", honorType: "live-master" });
    expect(degree.main).toMatchObject({ assetBundleName: "level-high" });
  });
  it("uses Live Master bundle priority: group background, selected level, then master", () => {
    const mission = { ...honor, honorMissionType: "master_full_combo" };
    const groupBackground = toCatalogueHonorDegree(mission, group);
    expect(groupBackground.main).toMatchObject({
      honorType: "live-master",
      assetBundleName: "background"
    });

    const selectedLevel = toCatalogueHonorDegree(mission, {
      ...group,
      backgroundAssetBundleName: "  "
    });
    expect(selectedLevel.main).toMatchObject({
      honorType: "live-master",
      assetBundleName: "level-high"
    });
    expect(
      buildHonorDegreeLayout(selectedLevel.main, resolveAsset).layers.find(
        (layer) => layer.name === "body"
      )?.href
    ).toBe("https://assets.test/sekai-tc-assets/honor/level-high/degree_main.webp");

    const masterFallback = toCatalogueHonorDegree(
      {
        ...mission,
        levels: honor.levels.map((level) => ({
          ...level,
          assetBundleName: level.level === 6 ? null : level.assetBundleName
        }))
      },
      { ...group, backgroundAssetBundleName: null }
    );
    expect(masterFallback.main).toMatchObject({
      honorType: "live-master",
      assetBundleName: "master"
    });
  });
  it("keeps non-Live-Master mission names on the ordinary honor path", () => {
    const degree = toCatalogueHonorDegree(
      { ...honor, honorMissionType: "master_full_combo_extra" },
      { ...group, backgroundAssetBundleName: null }
    );

    expect(degree.main).toMatchObject({
      kind: "normal",
      honorType: "regular",
      assetBundleName: "master"
    });
    expect(
      buildHonorDegreeLayout(degree.main, resolveAsset).layers.some((layer) =>
        layer.name.startsWith("level-")
      )
    ).toBe(true);
  });
  it("does not render an event honor without its master bundle even when group art exists", () => {
    const degree = toCatalogueHonorDegree(
      { ...honor, assetBundleName: null },
      { ...group, honorType: "event" }
    );
    expect(degree).toEqual({ main: { kind: "empty" }, sub: { kind: "empty" } });
  });
  it("selects a matching positive level and uses a safe local frame instead of a remote custom frame", () => {
    const degree = toCatalogueHonorDegree(honor, group);
    expect(degree.main).toMatchObject({ level: 6, rarity: 2 });
    const layers = buildHonorDegreeLayout(degree.main, resolveAsset).layers;
    expect(layers.find((layer) => layer.name === "frame")?.href).toBe(
      "/degree/frame_degree_m_3.png"
    );
    expect(layers.find((layer) => layer.name === "level-upgraded-0")?.href).toBe(
      "/degree/icon_degreeLv6.png"
    );
  });
  it.each(["normal", "event", "event_point", "birthday"])(
    "always selects generic m/s frames with normalized rarity for %s without frameName",
    (honorType) => {
      for (const [rarity, index] of ["low", "middle", "high", "highest"].map(
        (rarity, index) => [rarity, index] as const
      )) {
        const degree = toCatalogueHonorDegree(
          { ...honor, honorRarity: rarity },
          { ...group, honorType, frameName: null }
        );
        for (const slot of ["main", "sub1", "sub2"] as const) {
          const input = slot === "main" ? degree.main : degree.sub;
          expect(input).toMatchObject({ frameBundlePath: "local/honor", rarity: index });
          const layers = buildHonorDegreeLayout(input, resolveAsset, slot, "S").layers;
          expect(layers.slice(0, 2).map((layer) => layer.name)).toEqual(["body", "frame"]);
          expect(layers[1].href).toBe(
            `/degree/frame_degree_${slot === "main" ? "m" : "s"}_${index + 1}.png`
          );
        }
      }
    }
  );
  it("falls back to level rarity and then low rarity rather than omitting the frame", () => {
    const fromLevel = toCatalogueHonorDegree({ ...honor, honorRarity: null }, group);
    expect(fromLevel.main).toMatchObject({ rarity: 0, frameBundlePath: "local/honor" });
    const unknown = toCatalogueHonorDegree(
      { ...honor, honorRarity: "unknown", levels: [] },
      { ...group, frameName: null }
    );
    expect(unknown.main).toMatchObject({ rarity: 0, frameBundlePath: "local/honor" });
    expect(buildHonorDegreeLayout(unknown.main, resolveAsset).layers[1]?.href).toBe(
      "/degree/frame_degree_m_1.png"
    );
  });
  it("uses rank-match body, tier and local generic frame", () => {
    const degree = toCatalogueHonorDegree(honor, { ...group, honorType: "rank_match" });
    const layers = buildHonorDegreeLayout(degree.sub, resolveAsset, "sub1").layers;
    expect(layers.map((layer) => layer.href)).toEqual([
      "https://assets.test/sekai-tc-assets/rank_live/honor/background/degree_sub.webp",
      "/degree/frame_degree_s_3.png",
      "https://assets.test/sekai-tc-assets/rank_live/honor/master/sub.webp"
    ]);
  });
  it("uses birthday frame levels, suppresses invalid levels and keeps unknown types regular", () => {
    const birthday = toCatalogueHonorDegree(honor, { ...group, honorType: "birthday" });
    const birthdayLayout = buildHonorDegreeLayout(birthday.main, resolveAsset);
    const birthdayLevels = birthdayLayout.layers.filter((layer) =>
      layer.name.startsWith("birthday-level-")
    );
    expect(birthdayLevels).toHaveLength(5);
    expect(birthday.main).toMatchObject({
      frameBundlePath: "local/honor",
      group: { frameName: "frame" }
    });
    expect(birthdayLayout.layers.find((layer) => layer.name === "frame")?.href).toBe(
      "https://assets.test/sekai-tc-assets/honor_frame/frame/frame_degree_m_3.webp"
    );
    expect(
      birthdayLevels.every(
        (layer) =>
          layer.href ===
          "https://assets.test/sekai-tc-assets/honor_frame/frame/frame_degree_level_3.webp"
      )
    ).toBe(true);

    const birthdayLow = toCatalogueHonorDegree(
      { ...honor, honorRarity: "low" },
      { ...group, honorType: "birthday" }
    );
    expect(birthdayLow.main).toMatchObject({ frameBundlePath: "local/honor" });
    expect(buildHonorDegreeLayout(birthdayLow.main, resolveAsset).layers[1]?.href).toBe(
      "https://assets.test/sekai-tc-assets/honor_frame/frame/frame_degree_m_1.webp"
    );

    const birthdayWithoutGroupFrame = toCatalogueHonorDegree(honor, {
      ...group,
      honorType: "birthday",
      frameName: null
    });
    const fallbackLayers = buildHonorDegreeLayout(
      birthdayWithoutGroupFrame.main,
      resolveAsset
    ).layers;
    expect(fallbackLayers.find((layer) => layer.name === "birthday-level-0")?.href).toBe(
      "/degree/frame_degree_level_3.png"
    );

    const invalid = toCatalogueHonorDegree(
      { ...honor, levels: honor.levels.map((level) => ({ ...level, level: 0 })) },
      { ...group, honorType: "future" }
    );
    expect(invalid.main).toMatchObject({ honorType: "regular", level: null });
    expect(buildHonorDegreeLayout(invalid.main, resolveAsset).layers).toHaveLength(2);
  });
  it("maps extensionless sprites and png resources without changing local formats", () => {
    expect(resolveAsset("local/honor", "icon_degreeLv")).toBe("/degree/icon_degreeLv.png");
    expect(resolveAsset("local/honor", "icon_degreeLv.png")).toBe("/degree/icon_degreeLv.png");
    expect(resolveAsset("unsupported", "body.png")).toBeNull();
  });
  it("maps verified Bonds and Live Master resources to their local asset paths", () => {
    const bondsResources = [
      bondsHonorLocalAssetResources.backgroundBase,
      bondsHonorLocalAssetResources.backgroundColor,
      bondsHonorLocalAssetResources.backgroundTextureMain,
      bondsHonorLocalAssetResources.backgroundTextureSub,
      bondsHonorLocalAssetResources.maskMain,
      bondsHonorLocalAssetResources.maskSub
    ];
    const liveMasterResources = [
      liveMasterLocalAssetResources.star1,
      liveMasterLocalAssetResources.star2
    ];

    for (const resource of bondsResources) {
      expect(resolveAsset(bondsHonorLocalAssetResources.bundlePath, resource)).toBe(
        `/degree/bonds/${resource}.png`
      );
    }
    for (const resource of liveMasterResources) {
      expect(resolveAsset(liveMasterLocalAssetResources.bundlePath, resource)).toBe(
        `/degree/live-master/${resource}.png`
      );
    }
  });
  it("does not infer Bonds selection or orientation from unrelated profile state", () => {
    const honorWithProfileState = {
      ...honor,
      profile: { selectedWord: "profile-value", orientation: "reverse" }
    };
    const degree = toCatalogueHonorDegree(honorWithProfileState, group);

    expect(degree.main).toMatchObject({ kind: "normal", honorType: "regular" });
    expect(degree.main).not.toHaveProperty("reverse");
    expect(degree.main).not.toHaveProperty("characters");
    expect(degree.main).not.toHaveProperty("word");
  });
});

describe("Bonds honor degrees", () => {
  const bondsHonor: BondsHonor = {
    id: 1212603,
    bondsGroupId: 12126,
    name: "Miku and KAITO",
    honorRarity: "high",
    levels: [
      { level: 1, description: "Reach bond rank 5" },
      { level: 2, description: "Reach bond rank 10" }
    ],
    words: [
      {
        id: 12126001,
        seq: 1,
        assetBundleName: "honorname_2126_default_2126",
        name: "Default",
        description: null
      },
      {
        id: 12126010,
        seq: 10,
        assetBundleName: "honorname_2126_01",
        name: "Cool Singers",
        description: "Reach bond rank 26"
      }
    ],
    units: [
      { id: 21, gameCharacterId: 21, unit: "piapro", colorCode: "#33ccbb" },
      { id: 26, gameCharacterId: 26, unit: "piapro", colorCode: "#3366cc" }
    ],
    configurableUnitVirtualSinger: false
  };

  it("uses unit art, unit colours, and the default word with the rarity suffix", () => {
    const degree = toCatalogueBondsHonorDegree(bondsHonor);

    expect(degree.main).toEqual({
      kind: "bonds",
      rarity: 2,
      level: 1,
      colors: ["#33ccbb", "#3366cc"],
      characters: [
        { bundlePath: "bonds_honor/character", resourceName: "chr_sd_21_01" },
        { bundlePath: "bonds_honor/character", resourceName: "chr_sd_26_01" }
      ],
      word: { bundlePath: "bonds_honor/word", resourceName: "honorname_2126_default_2126_03" },
      reverse: false
    });
    expect(degree.sub).toBe(degree.main);
  });

  it("shows the chosen word and swaps sides", () => {
    const degree = toCatalogueBondsHonorDegree(bondsHonor, {
      wordId: 12126010,
      reverse: true,
      unitVirtualSinger: false
    }).main;

    expect(degree).toMatchObject({
      word: { resourceName: "honorname_2126_01_03" },
      reverse: true
    });
  });

  it("falls back to the default word for an unknown word", () => {
    const degree = toCatalogueBondsHonorDegree(bondsHonor, {
      wordId: 999,
      reverse: false,
      unitVirtualSinger: false
    }).main;

    expect(degree).toMatchObject({ word: { resourceName: "honorname_2126_default_2126_03" } });
  });

  describe("Virtual Singer outfit", () => {
    // Shiho (Leo/need) and Miku: Miku can wear the Leo/need outfit (character unit 27).
    const shihoAndMiku: BondsHonor = {
      ...bondsHonor,
      id: 1042101,
      bondsGroupId: 10421,
      name: "Shiho and Miku",
      honorRarity: "low",
      units: [
        { id: 4, gameCharacterId: 4, unit: "light_sound", colorCode: "#bbdd22" },
        { id: 21, gameCharacterId: 21, unit: "piapro", colorCode: "#33ccbb" }
      ],
      configurableUnitVirtualSinger: true
    };
    const viewData = {
      characterUnitIds: { "21:light_sound": 27, "21:idol": 28, "26:light_sound": 52 },
      unitNames: {}
    };
    const unitView = { wordId: null, reverse: false, unitVirtualSinger: true };
    const characterArt = (
      honor: BondsHonor,
      view = unitView,
      data: typeof viewData | null = viewData
    ) => {
      const degree = toCatalogueBondsHonorDegree(honor, view, data).main;
      return degree.kind === "bonds"
        ? degree.characters.map((character) => character?.resourceName)
        : [];
    };

    it("dresses the Virtual Singer in the partner's unit outfit", () => {
      expect(getBondsHonorPartnerUnit(shihoAndMiku)).toBe("light_sound");
      expect(hasBondsHonorOutfitOption(shihoAndMiku)).toBe(true);
      expect(characterArt(shihoAndMiku)).toEqual(["chr_sd_04_01", "chr_sd_27_01"]);
    });

    it("keeps the unit colours, which the game takes from the pair's own units", () => {
      const degree = toCatalogueBondsHonorDegree(shihoAndMiku, unitView, viewData).main;
      expect(degree).toMatchObject({ colors: ["#bbdd22", "#33ccbb"] });
    });

    it("keeps the Virtual Singer's own outfit otherwise", () => {
      expect(characterArt(shihoAndMiku, { ...unitView, unitVirtualSinger: false })).toEqual([
        "chr_sd_04_01",
        "chr_sd_21_01"
      ]);
      // Without unit data the option cannot resolve an outfit.
      expect(characterArt(shihoAndMiku, unitView, null)).toEqual(["chr_sd_04_01", "chr_sd_21_01"]);
      // Two Virtual Singers have no partner unit.
      expect(getBondsHonorPartnerUnit(bondsHonor)).toBeNull();
      expect(hasBondsHonorOutfitOption(bondsHonor)).toBe(false);
      expect(characterArt({ ...bondsHonor, configurableUnitVirtualSinger: true })).toEqual([
        "chr_sd_21_01",
        "chr_sd_26_01"
      ]);
      // A pair the game does not let the player dress keeps the Virtual Singer's outfit.
      expect(characterArt({ ...shihoAndMiku, configurableUnitVirtualSinger: false })).toEqual([
        "chr_sd_04_01",
        "chr_sd_21_01"
      ]);
    });
  });

  it("resolves re-exported Bonds art past cached trimmed copies", () => {
    const resolve = createHonorDegreeAssetResolver("jp");

    expect(resolve("bonds_honor/character", "chr_sd_21_01")).toMatch(
      /^https:\/\/assets\.test\/.+\/bonds_honor\/character\/chr_sd_21_01\.webp\?v=2$/
    );
    expect(resolve("bonds_honor/word", "honorname_2126_01_03")).toMatch(
      /\/bonds_honor\/word\/honorname_2126_01_03\.webp\?v=2$/
    );
    expect(resolve("bonds_honor/other", "x")).toBeNull();
  });
});
