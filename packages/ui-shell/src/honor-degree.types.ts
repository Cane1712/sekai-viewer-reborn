export type HonorDegreeSlot = "main" | "sub1" | "sub2";
export type HonorDegreeSize = "S" | "M" | "L" | "LL";
export type HonorDegreeRarity = "low" | "middle" | "high" | "highest" | 0 | 1 | 2 | 3;

/** Return null for unavailable resources. No fetching or asset discovery is performed here.
 * Remote body/tier resources include .png; frame and local icon resources are sprite names
 * without an extension. The resolver owns any extension/path mapping.
 * Local level icons use bundlePath "local/honor" and resourceName "icon_degreeLv"
 * or "icon_degreeLv6" (the upgraded icon for levels 6–10 in each cycle).
 */
export type HonorDegreeAssetResolver = (bundlePath: string, resourceName: string) => string | null;

export interface HonorDegreeAsset {
  readonly bundlePath: string;
  readonly resourceName: string;
}

/** Explicit top-left geometry in root pixels; never infer unknown sprite geometry. */
export interface HonorDegreePart extends HonorDegreeAsset {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface NormalHonorDegree {
  readonly kind: "normal";
  readonly honorType?: "regular" | "event" | "birthday" | "live-master";
  readonly assetBundleName?: string | null;
  readonly group?: { readonly frameName?: string | null } | null;
  /** Resolver bundle path for the canonical frame; takes precedence over group.frameName. */
  readonly frameBundlePath?: string | null;
  readonly rarity?: HonorDegreeRarity | null;
  readonly level?: number | null;
  /** Slot-specific event overlay resource, rendered only for honorType event. */
  readonly rankAsset?: HonorDegreeAsset | null;
  /** Drawn last, in supplied order. Caller supplies the selected slot's geometry. */
  readonly liveMasterParts?: readonly HonorDegreePart[];
}

export interface RankMatchHonorDegree {
  readonly kind: "rank-match";
  readonly assetBundleName?: string | null;
  readonly backgroundAssetBundleName?: string | null;
  readonly rarity?: HonorDegreeRarity | null;
  /** Resolver bundle path for the canonical frame; the resource name is derived. */
  readonly frameBundlePath?: string | null;
}

/**
 * A Bonds honor, laid out as the game's UIPartsBondsHonorImage (jp-6.7.0).
 * The builder owns all geometry; callers supply only data and assets.
 */
export interface BondsHonorDegree {
  readonly kind: "bonds";
  readonly rarity?: HonorDegreeRarity | null;
  readonly level?: number | null;
  /** Character unit colours (`colorCode`) that tint each half: first unit, then second. */
  readonly colors: readonly [string | null | undefined, string | null | undefined];
  /** Full 160×136 `bonds_honor/character/chr_sd_*` canvases: first unit, then second. */
  readonly characters: readonly [
    HonorDegreeAsset | null | undefined,
    HonorDegreeAsset | null | undefined
  ];
  /** Full 380×80 `bonds_honor/word/*` canvas. The game shows it in the main slot only. */
  readonly word?: HonorDegreeAsset | null;
  /** The reverse view swaps which unit sits on which side; it does not mirror. */
  readonly reverse?: boolean;
}

export type HonorDegreeInput =
  NormalHonorDegree | RankMatchHonorDegree | BondsHonorDegree | { readonly kind: "empty" };

export interface HonorDegreeProps {
  readonly honor?: HonorDegreeInput | null;
  readonly resolveAsset: HonorDegreeAssetResolver;
  readonly slot?: HonorDegreeSlot;
  readonly size?: HonorDegreeSize;
  /** Localized accessible name and empty placeholder text; defaults to Title. */
  readonly label?: string;
  /** Optional SVG tooltip; defaults to label. Omitted in decorative mode. */
  readonly title?: string;
  readonly decorative?: boolean;
  readonly class?: string;
}

export interface HonorDegreeLayer {
  readonly name: string;
  readonly href: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /**
   * `contain` keeps the texture's aspect ratio centred in the rect instead of
   * stretching it. Frames use it: some frame textures ship with their
   * transparent side margins trimmed (for example 164×80 for a 180×80 slot).
   */
  readonly fit?: "fill" | "contain";
}

/** Source columns of a 9-slice image drawn into one destination column. */
export interface HonorDegreeSliceColumn {
  readonly x: number;
  readonly width: number;
  readonly sourceX: number;
  readonly sourceWidth: number;
}

/** A horizontally 9-sliced image (Unity Image.Type.Sliced with left/right borders). */
export interface HonorDegreeSlicedImage {
  readonly href: string;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly y: number;
  readonly height: number;
  readonly columns: readonly HonorDegreeSliceColumn[];
  /** Rotation in degrees about the centre of the columns' extent. */
  readonly rotate?: 180;
}

export interface HonorDegreeBondsCharacter {
  readonly href: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The sub slot's per-side window mask. */
  readonly window: HonorDegreeSlicedImage | null;
}

/** Tinted halves, pattern and masked characters, drawn beneath the frame layers. */
export interface HonorDegreeBondsBody {
  /** Paint order: the full-width base, then the left colour. */
  readonly backgrounds: readonly {
    readonly image: HonorDegreeSlicedImage;
    readonly color: string;
  }[];
  readonly pattern: string | null;
  readonly characterMask: HonorDegreeSlicedImage | null;
  readonly characters: readonly HonorDegreeBondsCharacter[];
}

export interface HonorDegreeLayout {
  readonly width: 180 | 380;
  readonly height: 80;
  readonly scale: number;
  readonly bonds: HonorDegreeBondsBody | null;
  readonly layers: readonly HonorDegreeLayer[];
}
