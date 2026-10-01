import {
  getCommonMaterialThumbnailURL,
  getGachaTicketThumbnailURL,
  getMysekaiMaterialIconURL,
  getMysekaiToolIconURL,
  getRemoteAssetEndpointURL,
  type AssetServer
} from "$lib/assets";
import type { MissionResourceBoxDetail } from "$lib/domain/mission";
import type { SupportedRegion } from "$lib/domain/regions";

export type RewardItemIcon = {
  src: string;
  /** Tried when `src` fails; set when another asset server is known to hold the icon. */
  fallbackSrc: string | null;
};

// Title rewards show `thumbnail/common_material/honor_{n}`, one icon per rarity
// (plain, laurel, flowers, sparkles). Unknown rarities fall back to the plain one.
const titleRarityIcons: Record<string, number> = { low: 1, middle: 2, high: 3, highest: 4 };

export const isTitleReward = (resourceType: string | null | undefined): boolean =>
  resourceType === "honor" || resourceType === "bonds_honor";

// Currencies whose icon is `thumbnail/common_material/{resourceType}.webp`.
const commonMaterialTypes = new Set([
  "coin",
  "ingamevoice",
  "jewel",
  "live_point",
  "slot",
  "virtual_coin"
]);

// Items whose icon is `thumbnail/{...}` named by their ID.
const idIconEndpoints: Partial<Record<string, (id: number) => string>> = {
  skill_practice_ticket: (id) => `thumbnail/skill_practice_ticket/ticket${id}.webp`,
  boost_item: (id) => `thumbnail/boost_item/boost_item${id}.webp`
};

// Items whose icon is named by the asset bundle the master API returns with them. Stamp
// bundles do not follow stamp IDs, so their path cannot be built from the ID either.
const assetBundleIcons: Partial<
  Record<string, (bundle: string, server: AssetServer) => string | null>
> = {
  gacha_ticket: (bundle, server) => getGachaTicketThumbnailURL(bundle, server),
  stamp: (bundle, server) => getRemoteAssetEndpointURL(`stamp/${bundle}/${bundle}.webp`, server),
  virtual_live_transition_item: (bundle, server) =>
    getRemoteAssetEndpointURL(`thumbnail/virtual_live_transition_item/${bundle}.webp`, server),
  // MySekai icons are hosted on the JP server only.
  mysekai_material: (bundle) => getMysekaiMaterialIconURL(bundle),
  mysekai_tool: (bundle) => getMysekaiToolIconURL(bundle)
};

/**
 * In-game icon of one reward item, following the legacy viewer's
 * CommonMaterialIcon / MaterialIcon paths. Items without a known path return null.
 */
export const getRewardItemIcon = (
  detail: Pick<
    MissionResourceBoxDetail,
    "resourceType" | "resourceId" | "resourceAssetbundleName" | "resourceRarity"
  >,
  region: SupportedRegion
): RewardItemIcon | null => {
  const server: AssetServer = region;
  const { resourceType: type, resourceId: id } = detail;
  if (!type) return null;

  if (isTitleReward(type)) {
    const icon = titleRarityIcons[detail.resourceRarity ?? ""] ?? 1;
    return { src: getCommonMaterialThumbnailURL(`honor_${icon}`, server), fallbackSrc: null };
  }
  if (commonMaterialTypes.has(type)) {
    return { src: getCommonMaterialThumbnailURL(type, server), fallbackSrc: null };
  }
  if (type === "paid_jewel") {
    return { src: getCommonMaterialThumbnailURL("jewel", server), fallbackSrc: null };
  }
  if (type === "material" && id) {
    const endpoint = `thumbnail/material/material${id}.webp`;
    // TW/KR/CN asset servers lack material thumbnails; material IDs name the same item
    // in every region, so the JP icon stands in.
    return {
      src: getRemoteAssetEndpointURL(endpoint, server),
      fallbackSrc: region === "jp" ? null : getRemoteAssetEndpointURL(endpoint, "jp")
    };
  }
  const idEndpoint = idIconEndpoints[type];
  if (idEndpoint) {
    return id
      ? { src: getRemoteAssetEndpointURL(idEndpoint(id), server), fallbackSrc: null }
      : null;
  }
  const bundleIcon = assetBundleIcons[type];
  const src =
    bundleIcon && detail.resourceAssetbundleName
      ? bundleIcon(detail.resourceAssetbundleName, server)
      : null;
  return src ? { src, fallbackSrc: null } : null;
};
