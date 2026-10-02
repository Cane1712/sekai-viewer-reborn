import type {
  HonorDegreeAsset,
  HonorDegreeAssetResolver,
  HonorDegreeBondsBody,
  HonorDegreeBondsCharacter,
  HonorDegreeInput,
  HonorDegreeLayer,
  HonorDegreeLayout,
  HonorDegreePart,
  HonorDegreeSize,
  HonorDegreeSlicedImage,
  HonorDegreeSlot
} from "./honor-degree.types";

export const honorDegreeScales = { S: 0.7, M: 0.8, L: 1, LL: 1.2 } as const;

/** Verified local resource names for the six staged Bonds honor assets. */
export const bondsHonorLocalAssetResources = {
  bundlePath: "local/bonds-honor",
  backgroundBase: "degree_bgBase",
  backgroundColor: "degree_bgColor",
  backgroundTextureMain: "degree_bgTexture_main",
  backgroundTextureSub: "degree_bgTexture_sub",
  maskMain: "mask_degree_main",
  maskSub: "mask_degree_sub"
} as const;

/**
 * Verified local resource names for the staged Live Master assets: the lit (`star1`) and
 * unlit (`star2`) stars, and the clear-count digits `number_0`…`number_9` from the APK's
 * `HonorAtlas` sprite atlas.
 */
export const liveMasterLocalAssetResources = {
  bundlePath: "local/live-master",
  star1: "live_master_honor_star_1",
  star2: "live_master_honor_star_2",
  numberPrefix: "number_"
} as const;

/** Asset names used by the regular honor level indicator. */
export const honorDegreeLevelIconResources = {
  bundlePath: "local/honor",
  regular: "icon_degreeLv",
  upgraded: "icon_degreeLv6"
} as const;

export function normalizeHonorDegreeRarity(value: unknown): 0 | 1 | 2 | 3 | null {
  switch (value) {
    case "low":
    case 0:
      return 0;
    case "middle":
    case 1:
      return 1;
    case "high":
    case 2:
      return 2;
    case "highest":
    case 3:
      return 3;
    default:
      return null;
  }
}

function hasName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

type HonorDegreeRect = Pick<HonorDegreePart, "x" | "y" | "width" | "height">;
type HonorDegreeLayerAdder = (
  name: string,
  asset: HonorDegreeAsset | null | undefined,
  rect?: HonorDegreeRect
) => void;
type NormalHonorDegreeInput = Extract<HonorDegreeInput, { kind: "normal" }>;
type RankMatchHonorDegreeInput = Extract<HonorDegreeInput, { kind: "rank-match" }>;
type BondsHonorDegreeInput = Extract<HonorDegreeInput, { kind: "bonds" }>;

function validRect(rect: HonorDegreeRect): boolean {
  return (
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function addHonorDegreePart(
  add: HonorDegreeLayerAdder,
  name: string,
  part: HonorDegreePart | null | undefined
): void {
  if (part) add(name, part, part);
}

/**
 * `main_rank` (180×78) is anchored to the right edge's middle; `sub_rank` (158×40) to
 * the bottom centre of the 180×80 sub root (jp-6.7.0 UIPartsRankLiveHonorImage).
 */
function getRankMatchOverlayRect(main: boolean): HonorDegreeRect {
  if (main) return { x: 200, y: 1, width: 180, height: 78 };
  return { x: 11, y: 40, width: 158, height: 40 };
}

/**
 * `UpdateRankView` moves the centre-anchored `rank` node by sprite width: the 150×78
 * `rank_main` to (75, 0) in the 380×80 root, the 120×38 `rank_sub` to (0, −21) in the
 * 180×80 sub root (`GetSlotSize`), which puts it at the bottom centre.
 */
function getEventRankOverlayRect(main: boolean): HonorDegreeRect {
  if (main) return { x: 190, y: 1, width: 150, height: 78 };
  return { x: 30, y: 42, width: 120, height: 38 };
}

function getChapterRankAssetBundleName(honor: NormalHonorDegreeInput): string | null {
  if (hasName(honor.assetBundleName) && /_cp\d+$/.test(honor.assetBundleName)) {
    return honor.assetBundleName;
  }

  const rankBundleName = honor.rankAsset?.bundlePath.split("/").at(-1);
  return hasName(rankBundleName) && /_cp\d+$/.test(rankBundleName) ? rankBundleName : null;
}

function getFrameResourceName(main: boolean, rarity: number): string {
  return `frame_degree_${main ? "m" : "s"}_${rarity + 1}`;
}

function addRankMatchHonorDegreeLayers(
  honor: RankMatchHonorDegreeInput,
  main: boolean,
  variant: "main" | "sub",
  add: HonorDegreeLayerAdder
): void {
  const background = honor.backgroundAssetBundleName ?? honor.assetBundleName;
  if (hasName(background)) {
    add("body", {
      bundlePath: `rank_live/honor/${background}`,
      resourceName: `degree_${variant}.png`
    });
  }

  const rarity = normalizeHonorDegreeRarity(honor.rarity);
  if (hasName(honor.frameBundlePath) && rarity !== null) {
    add("frame", {
      bundlePath: honor.frameBundlePath,
      resourceName: getFrameResourceName(main, rarity)
    });
  }

  if (hasName(honor.assetBundleName)) {
    add(
      "rank",
      {
        bundlePath: `rank_live/honor/${honor.assetBundleName}`,
        resourceName: `${variant}.png`
      },
      getRankMatchOverlayRect(main)
    );
  }
}

function getNormalHonorFrameBundlePath(honor: NormalHonorDegreeInput): string | null {
  const rarity = normalizeHonorDegreeRarity(honor.rarity);
  const isChapterHonor = getChapterRankAssetBundleName(honor) !== null;

  if (honor.honorType === "birthday") {
    const frameName = honor.group?.frameName;
    if (hasName(frameName)) return `honor_frame/${frameName}`;
    return "local/honor";
  }

  const frameName = honor.group?.frameName;
  if (isChapterHonor && (rarity === 2 || rarity === 3) && hasName(frameName)) {
    return `honor_frame/${frameName}`;
  }

  return "local/honor";
}

function addBirthdayHonorDegreeLevelLayers(
  level: number,
  rarity: number | null,
  frameBundlePath: string | null,
  main: boolean,
  add: HonorDegreeLayerAdder
): void {
  if (rarity === null || !frameBundlePath) return;

  for (let index = 0; index < Math.min(5, level); index++) {
    add(
      `birthday-level-${index}`,
      {
        bundlePath: frameBundlePath,
        resourceName: `frame_degree_level_${rarity + 1}`
      },
      { x: (main ? 150 : 50) + 16 * index, y: 64, width: 16, height: 16 }
    );
  }
}

function getBirthdayHonorFrameBundlePath(
  honor: NormalHonorDegreeInput,
  frameBundlePath: string | null
): string | null {
  const frameName = honor.group?.frameName;
  if (hasName(frameName)) return `honor_frame/${frameName}`;

  return frameBundlePath;
}

function addHonorDegreeLevelIcons(
  name: string,
  resourceName: string,
  count: number,
  x: number,
  add: HonorDegreeLayerAdder
): void {
  for (let index = 0; index < count; index++) {
    add(
      `${name}-${index}`,
      { bundlePath: honorDegreeLevelIconResources.bundlePath, resourceName },
      { x: x + 16 * index, y: 64, width: 16, height: 16 }
    );
  }
}

// The star row is anchored at (59, 8) from the bottom-left in both the 380-wide main
// and the independent 180-wide sub root; star i is centred at 59 + 16i, so its
// 16×16 rect starts at 51 + 16i (jp-6.7.0 honor SVG templates, §3.1).
const REGULAR_LEVEL_X = 51;

function addRegularHonorDegreeLevelLayers(
  level: number,
  add: HonorDegreeLayerAdder,
  x = REGULAR_LEVEL_X
): void {
  const iconCounts = getHonorDegreeLevelIconCounts(level);
  if (!iconCounts) return;

  addHonorDegreeLevelIcons(
    "level",
    honorDegreeLevelIconResources.regular,
    iconCounts.regular,
    x,
    add
  );
  addHonorDegreeLevelIcons(
    "level-upgraded",
    honorDegreeLevelIconResources.upgraded,
    iconCounts.upgraded,
    x,
    add
  );
}

function addNormalHonorLevelLayers(
  honor: NormalHonorDegreeInput,
  main: boolean,
  rarity: number | null,
  frameBundlePath: string | null,
  add: HonorDegreeLayerAdder
): void {
  if (!validLevel(honor.level)) return;

  if (honor.honorType === "birthday") {
    addBirthdayHonorDegreeLevelLayers(
      honor.level,
      rarity,
      getBirthdayHonorFrameBundlePath(honor, frameBundlePath),
      main,
      add
    );
  } else if (honor.honorType !== "live-master") {
    addRegularHonorDegreeLevelLayers(honor.level, add);
  }
}

function addNormalHonorDetailLayers(
  honor: NormalHonorDegreeInput,
  main: boolean,
  rarity: number | null,
  frameBundlePath: string | null,
  add: HonorDegreeLayerAdder,
  addPart: (name: string, part: HonorDegreePart | null | undefined) => void
): void {
  if (honor.honorType === "event") {
    const chapterBundleName = getChapterRankAssetBundleName(honor);
    if (chapterBundleName) {
      add(
        "rank",
        honor.rankAsset ?? {
          bundlePath: `honor/${chapterBundleName}`,
          resourceName: `rank_${main ? "main" : "sub"}.png`
        }
      );
    } else {
      add("rank", honor.rankAsset, getEventRankOverlayRect(main));
    }
  } else {
    addNormalHonorLevelLayers(honor, main, rarity, frameBundlePath, add);
  }

  if (honor.honorType === "live-master") {
    if (honor.liveMaster) addLiveMasterLayers(honor, honor.liveMaster, main, add);
    honor.liveMasterParts?.forEach((part, index) => addPart(`live-master-${index}`, part));
  }
}

// UIPartsLiveMasterHonorLevel (jp-6.7.0 prefab 267c4c67…, SVG templates §3.5). SetSlot
// re-parents the 100×78 part group onto liveMasterMainPosition (78.2, 1) or
// liveMasterSubPosition (0, 1) and zeroes its local position, so its centre is (268.2, 39)
// in the main root and (90, 39) in the sub root.
const LIVE_MASTER_STARS: readonly (readonly [number, number])[] = [
  [41.93, -29.17],
  [34.09, -17.24],
  [26.67, -3.22],
  [34.09, 11.3],
  [41.93, 25.2],
  [113.9, -29.17],
  [121.75, -16.75],
  [129.1, -3.22],
  [121.75, 11.3],
  [113.9, 25.2]
];
const LIVE_MASTER_STAR_SIZE = 18;
// ClearCountNumbers: 57.35×17.95 at (0.5, −21.01) in the part group, scale 0.891; its
// horizontal layout centres the active digits (Hundreds, Tens, Ones), top-aligned, with
// −0.42 spacing. Digits are 16×22, except 13×22 for "1".
const LIVE_MASTER_NUMBER = { width: 57.35, height: 17.95, scale: 0.891, spacing: -0.42 };

function getLiveMasterStarCount(level: number): number {
  return level % 10 === 0 ? 10 : level % 10;
}

/** NumberView.UpdateNumber with OutOfDigitRangeView 2: the low three digits, no leading zeros. */
function getLiveMasterDigits(clearCount: number): number[] {
  const digits: number[] = [];
  let remaining = clearCount;
  for (let index = 0; index < 3; index++) {
    if (index > 0 && remaining === 0) break;
    digits.unshift(remaining % 10);
    remaining = Math.floor(remaining / 10);
  }
  return digits;
}

function addLiveMasterLayers(
  honor: NormalHonorDegreeInput,
  liveMaster: NonNullable<NormalHonorDegreeInput["liveMaster"]>,
  main: boolean,
  add: HonorDegreeLayerAdder
): void {
  const centreX = main ? 268.2 : 90;
  const centreY = 39;
  add("live-master-scroll", liveMaster.scroll, {
    x: centreX + 0.5 - 101 / 2,
    y: centreY + 1 - 75 / 2,
    width: 101,
    height: 75
  });

  // The main slot shows every unlit star and the lit ones over them; the sub slot hides both.
  if (main && validLevel(honor.level)) {
    const lit = getLiveMasterStarCount(honor.level);
    const { bundlePath, star1, star2 } = liveMasterLocalAssetResources;
    LIVE_MASTER_STARS.forEach(([x, y], index) => {
      const rect = {
        x: 190 + x - LIVE_MASTER_STAR_SIZE / 2,
        y: 40 - y - LIVE_MASTER_STAR_SIZE / 2,
        width: LIVE_MASTER_STAR_SIZE,
        height: LIVE_MASTER_STAR_SIZE
      };
      add(`live-master-star-off-${index}`, { bundlePath, resourceName: star2 }, rect);
      if (index < lit)
        add(`live-master-star-on-${index}`, { bundlePath, resourceName: star1 }, rect);
    });
  }

  const clearCount = liveMaster.clearCount;
  if (typeof clearCount !== "number" || !Number.isSafeInteger(clearCount) || clearCount < 0) {
    return;
  }
  const digits = getLiveMasterDigits(clearCount);
  const widths = digits.map((digit) => (digit === 1 ? 13 : 16));
  const { width, height, scale, spacing } = LIVE_MASTER_NUMBER;
  const contentWidth =
    widths.reduce((sum, digitWidth) => sum + digitWidth, 0) + spacing * (widths.length - 1);
  const numberCentreX = centreX + 0.5;
  const numberCentreY = centreY + 21.01;
  let localX = (width - contentWidth) / 2;
  digits.forEach((digit, index) => {
    add(
      `live-master-digit-${index}`,
      {
        bundlePath: liveMasterLocalAssetResources.bundlePath,
        resourceName: `${liveMasterLocalAssetResources.numberPrefix}${digit}`
      },
      {
        x: numberCentreX + (localX - width / 2) * scale,
        y: numberCentreY - (height / 2) * scale,
        width: widths[index] * scale,
        height: 22 * scale
      }
    );
    localX += widths[index] + spacing;
  });
}

function addNormalHonorDegreeLayers(
  honor: NormalHonorDegreeInput,
  main: boolean,
  variant: "main" | "sub",
  add: HonorDegreeLayerAdder,
  addPart: (name: string, part: HonorDegreePart | null | undefined) => void
): void {
  if (hasName(honor.assetBundleName)) {
    add("body", {
      bundlePath: `honor/${honor.assetBundleName}`,
      resourceName: `degree_${variant}.png`
    });
  }

  const rarity = normalizeHonorDegreeRarity(honor.rarity);
  const frameBundlePath = getNormalHonorFrameBundlePath(honor);
  if (rarity !== null && frameBundlePath) {
    add("frame", {
      bundlePath: frameBundlePath,
      resourceName: getFrameResourceName(main, rarity)
    });
  }

  addNormalHonorDetailLayers(honor, main, rarity, frameBundlePath, add, addPart);
}

type BondsSliceSource = {
  readonly resourceName: string;
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
};

// Serialized sprite borders of the staged local Bonds resources (UnityPy parse of
// jp-6.7.0 UIPartsBondsHonorImage, 29864637…); Image.type is Sliced for all four.
const bondsBackgroundBase: BondsSliceSource = {
  resourceName: bondsHonorLocalAssetResources.backgroundBase,
  width: 104,
  height: 80,
  left: 52,
  right: 52
};
const bondsBackgroundColor: BondsSliceSource = {
  resourceName: bondsHonorLocalAssetResources.backgroundColor,
  width: 72,
  height: 80,
  left: 59,
  right: 7
};
const bondsMaskMain: BondsSliceSource = {
  resourceName: bondsHonorLocalAssetResources.maskMain,
  width: 380,
  height: 80,
  left: 187,
  right: 187
};
const bondsMaskSub: BondsSliceSource = {
  resourceName: bondsHonorLocalAssetResources.maskSub,
  width: 104,
  height: 80,
  left: 64,
  right: 21
};

// chr_sd canvases are 160×136. SetSlot draws them 1:1 in the main slot, anchored
// 12 below the bottom edge, and at 0.77 on the bottom edge of the sub slot. The
// right image sits flush to the right edge (its window is rotated 180°, and so is
// the image, which cancels out). Verified against an in-game screenshot.
const BONDS_CHARACTER_WIDTH = 160;
const BONDS_CHARACTER_HEIGHT = 136;
const BONDS_SUB_CHARACTER_SCALE = 0.77;
const BONDS_SUB_WINDOW = { left: 0.05, width: 103.5 };
// The Bonds level row is anchored at (58, 8), one pixel left of regular honors.
const BONDS_LEVEL_X = 50;

/**
 * Unity draws a Sliced image with its left/right borders at native width and the
 * centre stretched; when the rect is narrower than both borders it scales the
 * borders down. A zero-width centre stretches the seam column.
 */
function buildSlicedImage(
  href: string,
  source: BondsSliceSource,
  rect: HonorDegreeRect
): HonorDegreeSlicedImage {
  const borderScale = Math.min(1, rect.width / (source.left + source.right));
  const left = source.left * borderScale;
  const right = source.right * borderScale;
  const centre = rect.width - left - right;
  const sourceCentre = source.width - source.left - source.right;
  const columns = [
    { x: rect.x, width: left, sourceX: 0, sourceWidth: source.left },
    ...(centre > 0
      ? [
          {
            x: rect.x + left,
            width: centre,
            sourceX: sourceCentre > 0 ? source.left : source.left - 0.5,
            sourceWidth: sourceCentre > 0 ? sourceCentre : 1
          }
        ]
      : []),
    {
      x: rect.x + rect.width - right,
      width: right,
      sourceX: source.width - source.right,
      sourceWidth: source.right
    }
  ].filter((column) => column.width > 0);
  return {
    href,
    sourceWidth: source.width,
    sourceHeight: source.height,
    y: rect.y,
    height: rect.height,
    columns
  };
}

function resolveBondsLocal(
  resolveAsset: HonorDegreeAssetResolver,
  resourceName: string
): string | null {
  const href = resolveAsset(bondsHonorLocalAssetResources.bundlePath, resourceName);
  return hasName(href) ? href : null;
}

function resolveBondsSliced(
  resolveAsset: HonorDegreeAssetResolver,
  source: BondsSliceSource,
  rect: HonorDegreeRect
): HonorDegreeSlicedImage | null {
  const href = resolveBondsLocal(resolveAsset, source.resourceName);
  return href ? buildSlicedImage(href, source, rect) : null;
}

function resolveHonorAsset(
  resolveAsset: HonorDegreeAssetResolver,
  asset: HonorDegreeAsset | null | undefined
): string | null {
  if (!asset || !hasName(asset.bundlePath) || !hasName(asset.resourceName)) return null;
  const href = resolveAsset(asset.bundlePath, asset.resourceName);
  return hasName(href) ? href : null;
}

function buildBondsCharacters(
  honor: BondsHonorDegreeInput,
  main: boolean,
  width: number,
  resolveAsset: HonorDegreeAssetResolver
): HonorDegreeBondsCharacter[] {
  const scale = main ? 1 : BONDS_SUB_CHARACTER_SCALE;
  const characterWidth = BONDS_CHARACTER_WIDTH * scale;
  const characterHeight = BONDS_CHARACTER_HEIGHT * scale;
  const y = main ? 92 - characterHeight : 80 - characterHeight;
  const [first, second] = honor.reverse
    ? [honor.characters[1], honor.characters[0]]
    : [honor.characters[0], honor.characters[1]];

  const sides = [
    { asset: first, x: main ? 0 : BONDS_SUB_WINDOW.left, windowX: BONDS_SUB_WINDOW.left },
    {
      asset: second,
      x: width - characterWidth,
      windowX: width - BONDS_SUB_WINDOW.width,
      rotate: 180 as const
    }
  ];
  return sides.flatMap((side) => {
    const href = resolveHonorAsset(resolveAsset, side.asset);
    if (!href) return [];
    const window = main
      ? null
      : resolveBondsSliced(resolveAsset, bondsMaskSub, {
          x: side.windowX,
          y: 0,
          width: BONDS_SUB_WINDOW.width,
          height: 80
        });
    return [
      {
        href,
        x: side.x,
        y,
        width: characterWidth,
        height: characterHeight,
        window: window && side.rotate ? { ...window, rotate: side.rotate } : window
      }
    ];
  });
}

function buildBondsHonorDegreeBody(
  honor: BondsHonorDegreeInput,
  main: boolean,
  resolveAsset: HonorDegreeAssetResolver
): HonorDegreeBondsBody {
  const width = main ? 380 : 180;
  const root = { x: 0, y: 0, width, height: 80 };
  const [firstColor, secondColor] = honor.reverse
    ? [honor.colors[1], honor.colors[0]]
    : [honor.colors[0], honor.colors[1]];
  const backgrounds = [
    { source: bondsBackgroundBase, rect: root, color: secondColor },
    // The left half is half the slot plus 3 (SetSlot: sizeDelta.x * 0.5 + 3).
    { source: bondsBackgroundColor, rect: { ...root, width: width / 2 + 3 }, color: firstColor }
  ].flatMap(({ source, rect, color }) => {
    const image = resolveBondsSliced(resolveAsset, source, rect);
    return image ? [{ image, color: hasName(color) ? color : "#ffffff" }] : [];
  });

  return {
    backgrounds,
    pattern: resolveBondsLocal(
      resolveAsset,
      main
        ? bondsHonorLocalAssetResources.backgroundTextureMain
        : bondsHonorLocalAssetResources.backgroundTextureSub
    ),
    characterMask: resolveBondsSliced(resolveAsset, bondsMaskMain, root),
    characters: buildBondsCharacters(honor, main, width, resolveAsset)
  };
}

/** Frame, word and level icons: drawn over the Bonds body in that order. */
function addBondsHonorDegreeLayers(
  honor: BondsHonorDegreeInput,
  main: boolean,
  add: HonorDegreeLayerAdder
): void {
  const rarity = normalizeHonorDegreeRarity(honor.rarity);
  if (rarity !== null) {
    add("frame", { bundlePath: "local/honor", resourceName: getFrameResourceName(main, rarity) });
  }
  if (main) add("word", honor.word);
  if (validLevel(honor.level)) addRegularHonorDegreeLevelLayers(honor.level, add, BONDS_LEVEL_X);
}

/**
 * Regular honors show up to five base icons. Levels 6–10 replace the first
 * slots with the upgraded icon, so the upgraded icons are emitted after the
 * base icons and paint over the matching positions. Higher levels repeat this
 * ten-level cycle.
 */
export function getHonorDegreeLevelIconCounts(
  level: number
): { readonly regular: number; readonly upgraded: number } | null {
  if (!validLevel(level)) {
    return null;
  }

  const cycleLevel = ((level - 1) % 10) + 1;
  return {
    regular: Math.min(5, cycleLevel),
    upgraded: Math.max(0, cycleLevel - 5)
  };
}

/** Pure layout builder. All asset resolution is synchronous and caller-owned. */
export function buildHonorDegreeLayout(
  honor: HonorDegreeInput | null | undefined,
  resolveAsset: HonorDegreeAssetResolver,
  slot: HonorDegreeSlot = "main",
  size: HonorDegreeSize = "L"
): HonorDegreeLayout {
  const main = slot === "main";
  const width = main ? 380 : 180;
  const layers: HonorDegreeLayer[] = [];
  const root = { x: 0, y: 0, width, height: 80 };
  const add: HonorDegreeLayerAdder = (name, asset, rect) => {
    if (!asset || !hasName(asset.bundlePath) || !hasName(asset.resourceName)) return;
    const targetRect = rect ?? root;
    if (!validRect(targetRect)) return;
    const href = resolveAsset(asset.bundlePath, asset.resourceName);
    if (!hasName(href)) return;

    layers.push({
      name,
      href,
      x: targetRect.x,
      y: targetRect.y,
      width: targetRect.width,
      height: targetRect.height,
      // Trimmed frame textures (jp-6.7.0 incoming: frame_degree_m_1 364×80,
      // s_1 164×80) belong centred in the full slot; stretching them pulls the
      // ring outside the body's edge and leaves a gap. Bonds words are full
      // 380×80 canvases, a few authored a pixel or two narrower.
      ...(name === "frame" || name === "word" ? { fit: "contain" as const } : {})
    });
  };
  const addPart = (name: string, part: HonorDegreePart | null | undefined): void =>
    addHonorDegreePart(add, name, part);
  const variant = main ? "main" : "sub";

  let bonds: HonorDegreeBondsBody | null = null;
  if (honor?.kind === "bonds") {
    bonds = buildBondsHonorDegreeBody(honor, main, resolveAsset);
    addBondsHonorDegreeLayers(honor, main, add);
  } else if (honor?.kind === "rank-match") {
    addRankMatchHonorDegreeLayers(honor, main, variant, add);
  } else if (honor?.kind === "normal") {
    addNormalHonorDegreeLayers(honor, main, variant, add, addPart);
  }
  return {
    width,
    height: 80,
    bonds,
    layers,
    scale: Object.hasOwn(honorDegreeScales, size) ? honorDegreeScales[size] : 1
  };
}

/** Every image a layout draws, once each: the Bonds masks, pattern and characters, then the layers. */
export function getHonorDegreeImageHrefs(layout: HonorDegreeLayout): string[] {
  const hrefs = new Set<string>();
  if (layout.bonds) {
    for (const background of layout.bonds.backgrounds) hrefs.add(background.image.href);
    if (layout.bonds.pattern) hrefs.add(layout.bonds.pattern);
    if (layout.bonds.characterMask) hrefs.add(layout.bonds.characterMask.href);
    for (const character of layout.bonds.characters) {
      hrefs.add(character.href);
      if (character.window) hrefs.add(character.window.href);
    }
  }
  for (const layer of layout.layers) hrefs.add(layer.href);
  return [...hrefs];
}

// Images that have already loaded or failed in this browser, so a title drawn again (a
// reopened dialog, a list scrolled back) shows at once. Only the browser writes to it.
const settledHonorDegreeImages = new Set<string>();

export function areHonorDegreeImagesSettled(hrefs: readonly string[]): boolean {
  return hrefs.every((href) => settledHonorDegreeImages.has(href));
}

function preloadHonorDegreeImage(href: string): Promise<void> {
  if (settledHonorDegreeImages.has(href)) return Promise.resolve();
  // Wait for load or error rather than decode(): decode() only settles once the page renders
  // a frame, so it can hang in a background tab.
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = image.onerror = () => {
      // A failed image settles too: the title shows what it has, and callers handle the error.
      settledHonorDegreeImages.add(href);
      resolve();
    };
    image.src = href;
  });
}

/**
 * Loads a layout's images in the browser, resolving once every one has loaded or failed.
 * The SVG's own `<image>` elements then draw them from the same cache.
 */
export function preloadHonorDegreeImages(hrefs: readonly string[]): Promise<void> {
  return Promise.all(hrefs.map(preloadHonorDegreeImage)).then(() => undefined);
}
