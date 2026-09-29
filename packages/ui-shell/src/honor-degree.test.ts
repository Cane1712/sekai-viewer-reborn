import { render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import HonorDegree from "./honor-degree.svelte";
import {
  bondsHonorLocalAssetResources,
  buildHonorDegreeLayout,
  getHonorDegreeLevelIconCounts,
  liveMasterLocalAssetResources,
  normalizeHonorDegreeRarity
} from "./honor-degree";
import type {
  HonorDegreeAssetResolver,
  HonorDegreeInput,
  HonorDegreeSlot
} from "./honor-degree.types";

const resolveAsset: HonorDegreeAssetResolver = (bundle, resource) => `/${bundle}/${resource}`;
const normal = {
  kind: "normal",
  assetBundleName: "achievement",
  group: { frameName: "standard" },
  rarity: "high",
  level: 7
} satisfies HonorDegreeInput;

describe("HonorDegree", () => {
  it.each<HonorDegreeSlot>(["main", "sub1", "sub2"])(
    "uses independent %s geometry and resources",
    (slot) => {
      const { getByRole, container } = render(HonorDegree, {
        honor: normal,
        resolveAsset,
        slot,
        label: "Achievement"
      });
      const main = slot === "main";
      expect(getByRole("img", { name: "Achievement" }).getAttribute("viewBox")).toBe(
        `0 0 ${main ? 380 : 180} 80`
      );
      const images = [...container.querySelectorAll("image")];
      expect(images.map((image) => image.getAttribute("data-layer"))).toEqual([
        "body",
        "frame",
        "level-0",
        "level-1",
        "level-2",
        "level-3",
        "level-4",
        "level-upgraded-0",
        "level-upgraded-1"
      ]);
      expect(images.map((image) => image.getAttribute("href"))).toEqual([
        `/honor/achievement/degree_${main ? "main" : "sub"}.png`,
        `/local/honor/frame_degree_${main ? "m" : "s"}_3`,
        ...Array.from({ length: 5 }, () => "/local/honor/icon_degreeLv"),
        ...Array.from({ length: 2 }, () => "/local/honor/icon_degreeLv6")
      ]);
      expect(
        images
          .slice(0, 2)
          .map((image) => [
            image.getAttribute("x"),
            image.getAttribute("y"),
            image.getAttribute("width"),
            image.getAttribute("height")
          ])
      ).toEqual(Array.from({ length: 2 }, () => ["0", "0", main ? "380" : "180", "80"]));
      // Frames keep their aspect ratio so trimmed textures (164×80, 364×80) sit centred.
      expect(images.map((image) => image.getAttribute("preserveAspectRatio"))).toEqual([
        "none",
        "xMidYMid meet",
        ...Array.from({ length: 7 }, () => "none")
      ]);
      expect(images.slice(2, 7).map((image) => image.getAttribute("x"))).toEqual(
        Array.from({ length: 5 }, (_, i) => String(51 + 16 * i))
      );
      expect(images.slice(7).map((image) => image.getAttribute("x"))).toEqual(["51", "67"]);
      expect(
        images
          .slice(2)
          .every(
            (image) =>
              image.getAttribute("y") === "64" &&
              image.getAttribute("width") === "16" &&
              image.getAttribute("height") === "16"
          )
      ).toBe(true);
    }
  );

  it.each<HonorDegreeSlot>(["main", "sub1"])(
    "uses a local default frame for %s despite group frameName",
    (slot) => {
      const { container } = render(HonorDegree, {
        honor: {
          kind: "normal",
          group: { frameName: "remote-theme" },
          rarity: "high"
        },
        resolveAsset,
        slot
      });
      const frame = container.querySelector('[data-layer="frame"]');
      expect(frame?.getAttribute("href")).toBe(
        `/local/honor/frame_degree_${slot === "main" ? "m" : "s"}_3`
      );
    }
  );

  it.each<HonorDegreeSlot>(["main", "sub1", "sub2"])(
    "renders event ranks without levels for %s",
    (slot) => {
      const { container } = render(HonorDegree, {
        honor: {
          ...normal,
          honorType: "event",
          rankAsset: { bundlePath: "honor/ranking", resourceName: "rank.png" }
        },
        resolveAsset,
        slot
      });
      expect(
        [...container.querySelectorAll("image")].map((image) => image.getAttribute("data-layer"))
      ).toEqual(["body", "frame", "rank"]);
      const rank = container.querySelector('[data-layer="rank"]');
      expect(["x", "y", "width", "height"].map((key) => rank?.getAttribute(key))).toEqual(
        slot === "main" ? ["190", "1", "150", "78"] : ["60", "0", "120", "38"]
      );
    }
  );

  it.each([
    ["main", "rank_main.png"],
    ["sub1", "rank_sub.png"]
  ] as const)("renders World Link chapter ranks full-root in %s", (slot, resourceName) => {
    const main = slot === "main";
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "event",
        assetBundleName: "honor_top_123456_event_123_cp2",
        rankAsset: {
          bundlePath: "honor/honor_top_123456_event_123_cp2",
          resourceName
        }
      },
      resolveAsset,
      slot
    );

    expect(layout.layers.map((layer) => layer.name)).toEqual(["body", "frame", "rank"]);
    expect(
      layout.layers.slice(0, 2).map(({ x, y, width, height }) => ({ x, y, width, height }))
    ).toEqual(
      Array.from({ length: 2 }, () => ({ x: 0, y: 0, width: main ? 380 : 180, height: 80 }))
    );
    expect(layout.layers[1]?.href).toBe(`/honor_frame/standard/frame_degree_${main ? "m" : "s"}_3`);
    expect(layout.layers[2]).toMatchObject({
      href: `/honor/honor_top_123456_event_123_cp2/${resourceName}`,
      x: 0,
      y: 0,
      width: main ? 380 : 180,
      height: 80
    });
  });

  it("keeps standard World Link event honors on the ordinary rank template", () => {
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "event",
        assetBundleName: "honor_top_000001",
        rankAsset: { bundlePath: "honor/honor_top_000001", resourceName: "rank_sub.png" }
      },
      resolveAsset,
      "sub1"
    );

    expect(layout.layers[2]).toMatchObject({
      x: 60,
      y: 0,
      width: 120,
      height: 38
    });
  });

  it.each([
    ["low", 0, "local/honor"],
    ["middle", 1, "local/honor"],
    ["high", 2, "honor_frame/world-link"],
    ["highest", 3, "honor_frame/world-link"]
  ] as const)("selects chapter %s frame from its bundle", (rarity, suffix, bundle) => {
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "regular",
        assetBundleName: "honor_top_000001_event_123_cp2",
        group: { frameName: "world-link" },
        rarity
      },
      resolveAsset
    );
    expect(layout.layers[1]?.href).toBe(`/${bundle}/frame_degree_m_${suffix + 1}`);
  });

  it("does not invent a missing event rank or show an event rank for regular honors", () => {
    expect(
      buildHonorDegreeLayout({ ...normal, honorType: "event" }, resolveAsset).layers.map(
        (layer) => layer.name
      )
    ).toEqual(["body", "frame"]);
    expect(
      buildHonorDegreeLayout(
        { ...normal, rankAsset: { bundlePath: "rank", resourceName: "rank" } },
        resolveAsset
      ).layers.some((layer) => layer.name === "rank")
    ).toBe(false);
  });

  it.each<HonorDegreeSlot>(["main", "sub1"])(
    "renders bounded birthday copies at %s coordinates",
    (slot) => {
      const { container } = render(HonorDegree, {
        honor: { ...normal, honorType: "birthday", level: 99 },
        resolveAsset,
        slot
      });
      const copies = [...container.querySelectorAll('image[data-layer^="birthday-level-"]')];
      expect(copies).toHaveLength(5);
      copies.forEach((copy, i) => {
        expect(copy.getAttribute("href")).toBe("/honor_frame/standard/frame_degree_level_3");
        expect(copy.getAttribute("x")).toBe(String((slot === "main" ? 150 : 50) + i * 16));
        expect(copy.getAttribute("y")).toBe("64");
        expect(copy.getAttribute("width")).toBe("16");
        expect(copy.getAttribute("height")).toBe("16");
      });
      expect(container.querySelector('[data-layer="level-0"]')).toBeNull();
    }
  );

  it("resolves birthday level sprites from the group frame", () => {
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "birthday",
        frameBundlePath: "local/honor"
      },
      resolveAsset
    );

    expect(layout.layers.find((layer) => layer.name === "frame")?.href).toBe(
      "/honor_frame/standard/frame_degree_m_3"
    );
    expect(layout.layers.find((layer) => layer.name === "birthday-level-0")?.href).toBe(
      "/honor_frame/standard/frame_degree_level_3"
    );
  });

  it.each([
    ["low", 0, "honor_frame/standard"],
    ["middle", 1, "honor_frame/standard"],
    ["high", 2, "honor_frame/standard"],
    ["highest", 3, "honor_frame/standard"]
  ] as const)("uses Birthday %s frame and level resources", (rarity, suffix, bundle) => {
    const layout = buildHonorDegreeLayout(
      {
        ...normal,
        honorType: "birthday",
        rarity,
        frameBundlePath: "local/honor"
      },
      resolveAsset
    );

    expect(layout.layers.find((layer) => layer.name === "frame")?.href).toBe(
      `/${bundle}/frame_degree_m_${suffix + 1}`
    );
    expect(layout.layers.find((layer) => layer.name === "birthday-level-0")?.href).toBe(
      `/honor_frame/standard/frame_degree_level_${suffix + 1}`
    );
    expect(layout.layers.some((layer) => layer.name === "rank")).toBe(false);
  });

  it("uses the effective frame bundle for birthday level sprites when no group frameName exists", () => {
    const layout = buildHonorDegreeLayout(
      {
        kind: "normal",
        honorType: "birthday",
        frameBundlePath: "local/honor",
        rarity: "low",
        level: 1
      },
      resolveAsset
    );

    expect(layout.layers.find((layer) => layer.name === "frame")?.href).toBe(
      "/local/honor/frame_degree_m_1"
    );
    expect(layout.layers.find((layer) => layer.name === "birthday-level-0")?.href).toBe(
      "/local/honor/frame_degree_level_1"
    );
  });

  it.each<HonorDegreeSlot>(["main", "sub1"])(
    "renders rank-match body, frame, and tier for %s",
    (slot) => {
      const layout = buildHonorDegreeLayout(
        {
          kind: "rank-match",
          assetBundleName: "tier",
          backgroundAssetBundleName: "season",
          rarity: "high",
          frameBundlePath: "degree"
        },
        resolveAsset,
        slot
      );
      expect(layout.layers.map((layer) => layer.name)).toEqual(["body", "frame", "rank"]);
      expect(layout.layers.map((layer) => layer.href)).toEqual([
        `/rank_live/honor/season/degree_${slot === "main" ? "main" : "sub"}.png`,
        `/degree/frame_degree_${slot === "main" ? "m" : "s"}_3`,
        `/rank_live/honor/tier/${slot === "main" ? "main" : "sub"}.png`
      ]);
      expect(layout.layers[2]).toMatchObject(
        slot === "main"
          ? { x: 200, y: 1, width: 180, height: 78 }
          : { x: 11, y: 0, width: 158, height: 40 }
      );
      expect(
        buildHonorDegreeLayout({ kind: "rank-match", assetBundleName: "tier" }, resolveAsset)
          .layers[0]?.href
      ).toBe("/rank_live/honor/tier/degree_main.png");
    }
  );

  it("omits a rank-match frame when its rarity or frame bundle is unavailable", () => {
    expect(
      buildHonorDegreeLayout(
        { kind: "rank-match", assetBundleName: "tier", rarity: "high" },
        resolveAsset
      ).layers.map((layer) => layer.name)
    ).toEqual(["body", "rank"]);
    expect(
      buildHonorDegreeLayout(
        { kind: "rank-match", assetBundleName: "tier", frameBundlePath: "degree" },
        resolveAsset
      ).layers.map((layer) => layer.name)
    ).toEqual(["body", "rank"]);
    expect(
      buildHonorDegreeLayout(
        {
          kind: "rank-match",
          assetBundleName: "tier",
          rarity: "high",
          frameBundlePath: "degree"
        },
        (bundle, resource) =>
          resource.startsWith("frame_degree") ? null : resolveAsset(bundle, resource)
      ).layers.map((layer) => layer.name)
    ).toEqual(["body", "rank"]);
  });

  it.each([1, 5, 6, 10, 11, 20, 21])(
    "cycles regular and upgraded level icons for level %i",
    (level) => {
      const icons = buildHonorDegreeLayout({ kind: "normal", level }, resolveAsset).layers;
      const counts = getHonorDegreeLevelIconCounts(level);
      expect(counts).not.toBeNull();
      expect(icons).toHaveLength((counts?.regular ?? 0) + (counts?.upgraded ?? 0));
      expect(icons.filter((icon) => icon.href.endsWith("icon_degreeLv6"))).toHaveLength(
        counts?.upgraded ?? 0
      );
      expect(icons.filter((icon) => icon.href.endsWith("icon_degreeLv"))).toHaveLength(
        counts?.regular ?? 0
      );
    }
  );

  it.each([0, -1, 1.5, NaN, Infinity, null])("suppresses invalid level %s", (level) => {
    expect(buildHonorDegreeLayout({ kind: "normal", level }, resolveAsset).layers).toEqual([]);
  });

  it("normalizes rarity safely without defaulting unavailable frames", () => {
    expect(
      ["low", "middle", "high", "highest", 0, 1, 2, 3].map(normalizeHonorDegreeRarity)
    ).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
    expect([null, undefined, "unknown", "1", -1, 4, NaN].map(normalizeHonorDegreeRarity)).toEqual(
      Array(7).fill(null)
    );
    expect(
      buildHonorDegreeLayout(
        { ...normal, rarity: null, honorType: "birthday" },
        resolveAsset
      ).layers.map((layer) => layer.name)
    ).toEqual(["body"]);
  });

  it("exports only the verified local Bonds and Live Master resource names", () => {
    expect(bondsHonorLocalAssetResources).toEqual({
      bundlePath: "local/bonds-honor",
      backgroundBase: "degree_bgBase",
      backgroundColor: "degree_bgColor",
      backgroundTextureMain: "degree_bgTexture_main",
      backgroundTextureSub: "degree_bgTexture_sub",
      maskMain: "mask_degree_main",
      maskSub: "mask_degree_sub"
    });
    expect(liveMasterLocalAssetResources).toEqual({
      bundlePath: "local/live-master",
      star1: "live_master_honor_star_1",
      star2: "live_master_honor_star_2"
    });
  });

  const bondsHonor = {
    kind: "bonds",
    rarity: "high",
    level: 3,
    colors: ["#33ccbb", "#3366cc"],
    characters: [
      { bundlePath: "bonds_honor/character", resourceName: "chr_sd_21_01" },
      { bundlePath: "bonds_honor/character", resourceName: "chr_sd_26_01" }
    ],
    word: { bundlePath: "bonds_honor/word", resourceName: "honorname_2126_01_03" }
  } satisfies HonorDegreeInput;

  it("lays out a main Bonds honor as the game's UIPartsBondsHonorImage", () => {
    const layout = buildHonorDegreeLayout(bondsHonor, resolveAsset, "main");

    // Right half: degree_bgBase (52/52 borders, zero-width centre) across the root,
    // tinted with the second unit; left half: degree_bgColor (59/7) over 193.
    expect(layout.bonds?.backgrounds).toEqual([
      {
        color: "#3366cc",
        image: {
          href: "/local/bonds-honor/degree_bgBase",
          sourceWidth: 104,
          sourceHeight: 80,
          y: 0,
          height: 80,
          columns: [
            { x: 0, width: 52, sourceX: 0, sourceWidth: 52 },
            { x: 52, width: 276, sourceX: 51.5, sourceWidth: 1 },
            { x: 328, width: 52, sourceX: 52, sourceWidth: 52 }
          ]
        }
      },
      {
        color: "#33ccbb",
        image: {
          href: "/local/bonds-honor/degree_bgColor",
          sourceWidth: 72,
          sourceHeight: 80,
          y: 0,
          height: 80,
          columns: [
            { x: 0, width: 59, sourceX: 0, sourceWidth: 59 },
            { x: 59, width: 127, sourceX: 59, sourceWidth: 6 },
            { x: 186, width: 7, sourceX: 65, sourceWidth: 7 }
          ]
        }
      }
    ]);
    expect(layout.bonds?.pattern).toBe("/local/bonds-honor/degree_bgTexture_main");
    expect(layout.bonds?.characterMask?.columns).toEqual([
      { x: 0, width: 187, sourceX: 0, sourceWidth: 187 },
      { x: 187, width: 6, sourceX: 187, sourceWidth: 6 },
      { x: 193, width: 187, sourceX: 193, sourceWidth: 187 }
    ]);
    // 160×136 canvases drawn 1:1, 12 below the bottom edge, flush to each side.
    expect(layout.bonds?.characters).toEqual([
      {
        href: "/bonds_honor/character/chr_sd_21_01",
        x: 0,
        y: -44,
        width: 160,
        height: 136,
        window: null
      },
      {
        href: "/bonds_honor/character/chr_sd_26_01",
        x: 220,
        y: -44,
        width: 160,
        height: 136,
        window: null
      }
    ]);
    expect(layout.layers.map((layer) => [layer.name, layer.href, layer.x, layer.fit])).toEqual([
      ["frame", "/local/honor/frame_degree_m_3", 0, "contain"],
      ["word", "/bonds_honor/word/honorname_2126_01_03", 0, "contain"],
      ["level-0", "/local/honor/icon_degreeLv", 50, undefined],
      ["level-1", "/local/honor/icon_degreeLv", 66, undefined],
      ["level-2", "/local/honor/icon_degreeLv", 82, undefined]
    ]);
  });

  it("swaps the units for the reverse view instead of mirroring", () => {
    const layout = buildHonorDegreeLayout({ ...bondsHonor, reverse: true }, resolveAsset);

    expect(layout.bonds?.backgrounds.map((background) => background.color)).toEqual([
      "#33ccbb",
      "#3366cc"
    ]);
    expect(layout.bonds?.characters.map((character) => [character.href, character.x])).toEqual([
      ["/bonds_honor/character/chr_sd_26_01", 0],
      ["/bonds_honor/character/chr_sd_21_01", 220]
    ]);
    const { container } = render(HonorDegree, {
      honor: { ...bondsHonor, reverse: true },
      resolveAsset
    });
    expect(container.querySelector("g")?.getAttribute("transform")).toBeNull();
  });

  it("scales characters into per-side windows and drops the word in a sub slot", () => {
    const layout = buildHonorDegreeLayout(bondsHonor, resolveAsset, "sub1");
    const [left, right] = layout.bonds?.characters ?? [];

    expect(layout.width).toBe(180);
    expect(layout.bonds?.backgrounds[1]?.image.columns).toEqual([
      { x: 0, width: 59, sourceX: 0, sourceWidth: 59 },
      { x: 59, width: 27, sourceX: 59, sourceWidth: 6 },
      { x: 86, width: 7, sourceX: 65, sourceWidth: 7 }
    ]);
    expect(layout.bonds?.pattern).toBe("/local/bonds-honor/degree_bgTexture_sub");
    // mask_degree_main's 187/187 borders exceed 180, so Unity scales them to 90 each.
    expect(layout.bonds?.characterMask?.columns).toEqual([
      { x: 0, width: 90, sourceX: 0, sourceWidth: 187 },
      { x: 90, width: 90, sourceX: 193, sourceWidth: 187 }
    ]);
    expect(left?.x).toBeCloseTo(0.05);
    expect(right?.x).toBeCloseTo(56.8);
    for (const character of [left, right]) {
      expect(character?.width).toBeCloseTo(123.2);
      expect(character?.height).toBeCloseTo(104.72);
      expect(character?.y).toBeCloseTo(-24.72);
    }
    expect(left?.window?.columns[0]?.x).toBeCloseTo(0.05);
    expect(left?.window?.rotate).toBeUndefined();
    expect(right?.window?.columns[0]?.x).toBeCloseTo(76.5);
    expect(right?.window?.rotate).toBe(180);
    expect(layout.layers.map((layer) => layer.name)).toEqual([
      "frame",
      "level-0",
      "level-1",
      "level-2"
    ]);
    expect(layout.layers[0]?.href).toBe("/local/honor/frame_degree_s_3");
  });

  it("paints the Bonds body beneath the frame, word, and levels with unique alpha masks", () => {
    const first = render(HonorDegree, { honor: bondsHonor, resolveAsset });
    const second = render(HonorDegree, { honor: bondsHonor, resolveAsset });

    expect(
      [...first.container.querySelectorAll("[data-layer]")].map((node) =>
        node.getAttribute("data-layer")
      )
    ).toEqual([
      "bonds-background-0",
      "bonds-background-1",
      "bonds-pattern",
      "bonds-character-0",
      "bonds-character-1",
      "frame",
      "word",
      "level-0",
      "level-1",
      "level-2"
    ]);
    const masks = [...first.container.querySelectorAll("mask")];
    expect(masks).toHaveLength(3);
    for (const mask of masks) expect(mask.getAttribute("mask-type")).toBe("alpha");
    const background = first.container.querySelector('[data-layer="bonds-background-0"]');
    expect(background?.getAttribute("fill")).toBe("#3366cc");
    expect(background?.getAttribute("mask")).toBe(`url(#${masks[0]?.id})`);
    // Each 9-slice column crops its source span through a nested viewBox.
    expect(masks[0]?.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 52 80");
    const characters = first.container.querySelector('[data-layer="bonds-character-0"]');
    expect(characters?.parentElement?.parentElement?.getAttribute("mask")).toBe(
      `url(#${masks[2]?.id})`
    );
    const secondIds = [...second.container.querySelectorAll("mask")].map((mask) => mask.id);
    expect(secondIds).not.toContain(masks[0]?.id);
  });

  it("omits unresolved Bonds assets and falls back to white halves", () => {
    const layout = buildHonorDegreeLayout(
      {
        kind: "bonds",
        colors: [null, undefined],
        characters: [{ bundlePath: "bonds_honor/character", resourceName: "chr_sd_01_01" }, null]
      },
      (bundle, resource) => (bundle === "bonds_honor/character" ? null : `/${bundle}/${resource}`)
    );

    expect(layout.bonds?.backgrounds.map((background) => background.color)).toEqual([
      "#ffffff",
      "#ffffff"
    ]);
    expect(layout.bonds?.characters).toEqual([]);
    expect(layout.layers).toEqual([]);

    const bare = buildHonorDegreeLayout(bondsHonor, () => null);
    expect(bare.bonds).toEqual({
      backgrounds: [],
      pattern: null,
      characterMask: null,
      characters: []
    });
    expect(bare.layers).toEqual([]);
  });

  it("draws valid live-master parts last and omits unresolved assets", () => {
    const part = { bundlePath: "live", resourceName: "part", x: 0, y: 0, width: 30, height: 20 };
    const layout = buildHonorDegreeLayout(
      { ...normal, honorType: "live-master", liveMasterParts: [part, { ...part, width: NaN }] },
      (bundle, resource) =>
        bundle.startsWith("honor_frame") ? null : resolveAsset(bundle, resource)
    );
    expect(layout.layers.at(-1)).toMatchObject({ name: "live-master-0", href: "/live/part" });
    expect(layout.layers.find((layer) => layer.name === "frame")?.href).toBe(
      "/local/honor/frame_degree_m_3"
    );
    expect(layout.layers.some((layer) => layer.name === "live-master-1")).toBe(false);
  });

  it.each<HonorDegreeSlot>(["main", "sub1"])(
    "uses the local normalized frame before Live Master parts in %s despite group frameName",
    (slot) => {
      const layout = buildHonorDegreeLayout(
        {
          ...normal,
          assetBundleName: "honor_top_000001",
          group: { frameName: "remote-theme" },
          honorType: "live-master",
          rarity: "high",
          liveMasterParts: [
            {
              bundlePath: liveMasterLocalAssetResources.bundlePath,
              resourceName: liveMasterLocalAssetResources.star1,
              x: 10,
              y: 5,
              width: 20,
              height: 20
            }
          ]
        },
        resolveAsset,
        slot
      );
      const main = slot === "main";

      expect(layout.layers.map((layer) => layer.name)).toEqual(["body", "frame", "live-master-0"]);
      expect(layout.layers[1]?.href).toBe(`/local/honor/frame_degree_${main ? "m" : "s"}_3`);
      expect(layout.layers[2]?.href).toBe(
        `/local/live-master/${liveMasterLocalAssetResources.star1}`
      );
    }
  );

  it("does not add generic level icons to Live Master honors", () => {
    const layers = buildHonorDegreeLayout(
      { ...normal, honorType: "live-master" },
      resolveAsset
    ).layers;

    expect(layers.map((layer) => layer.name)).toEqual(["body", "frame"]);
    expect(
      layers.some(
        (layer) => layer.name.startsWith("level-") || layer.name.startsWith("level-upgraded-")
      )
    ).toBe(false);
  });

  it("renders explicitly supplied local Live Master star parts in caller order", () => {
    const part = (resourceName: string, x: number) => ({
      bundlePath: liveMasterLocalAssetResources.bundlePath,
      resourceName,
      x,
      y: 5,
      width: 20,
      height: 20
    });
    const layout = buildHonorDegreeLayout(
      {
        kind: "normal",
        honorType: "live-master",
        liveMasterParts: [
          part(liveMasterLocalAssetResources.star1, 10),
          part(liveMasterLocalAssetResources.star2, 30)
        ]
      },
      resolveAsset
    );

    expect(layout.layers.map((layer) => layer.name)).toEqual(["live-master-0", "live-master-1"]);
    expect(layout.layers.map((layer) => layer.href)).toEqual([
      `/local/live-master/${liveMasterLocalAssetResources.star1}`,
      `/local/live-master/${liveMasterLocalAssetResources.star2}`
    ]);
  });

  it.each([
    ["S", 0.7],
    ["M", 0.8],
    ["L", 1],
    ["LL", 1.2]
  ] as const)("scales %s without changing the root", (size, scale) => {
    const { getByRole } = render(HonorDegree, { honor: normal, resolveAsset, size });
    const svg = getByRole("img");
    expect(svg.getAttribute("viewBox")).toBe("0 0 380 80");
    expect(svg.style.width).toBe(`${380 * scale}px`);
    expect(svg.style.height).toBe(`${80 * scale}px`);
  });

  it("provides accessible empty, unavailable, and decorative states and reacts to updates", async () => {
    const resolver = vi.fn<HonorDegreeAssetResolver>(() => null);
    const { container, getByRole, queryByRole, rerender } = render(HonorDegree, {
      honor: null,
      resolveAsset: resolver,
      slot: "sub1",
      label: "No honor",
      title: "Empty slot"
    });
    expect(getByRole("img", { name: "No honor" }).getAttribute("viewBox")).toBe("0 0 180 80");
    expect(container.querySelector("text")?.textContent).toBe("No honor");
    expect(container.querySelector("title")?.textContent).toBe("Empty slot");
    expect(resolver).not.toHaveBeenCalled();
    await rerender({ honor: normal });
    expect(container.querySelector("image")).toBeNull();
    await rerender({ resolveAsset, decorative: true });
    expect(container.querySelector("image")).not.toBeNull();
    expect(queryByRole("img")).toBeNull();
    expect(container.querySelector("title")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps an empty small sub slot at 126x56 CSS pixels", () => {
    const { getByRole, container } = render(HonorDegree, {
      honor: { kind: "empty" },
      resolveAsset,
      slot: "sub2",
      size: "S"
    });
    expect(getByRole("img", { name: "Title" }).style.width).toBe("126px");
    expect(getByRole("img").style.height).toBe("56px");
    expect(container.querySelector("text")?.textContent).toBe("Title");
  });
});
