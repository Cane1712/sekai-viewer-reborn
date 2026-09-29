import {
  getCommonMaterialThumbnailURL,
  getGachaTicketThumbnailURL,
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
  if (type === "skill_practice_ticket" && id) {
    return {
      src: getRemoteAssetEndpointURL(`thumbnail/skill_practice_ticket/ticket${id}.webp`, server),
      fallbackSrc: null
    };
  }
  if (type === "gacha_ticket" && detail.resourceAssetbundleName) {
    return {
      src: getGachaTicketThumbnailURL(detail.resourceAssetbundleName, server),
      fallbackSrc: null
    };
  }
  if (type === "boost_item" && id) {
    return {
      src: getRemoteAssetEndpointURL(`thumbnail/boost_item/boost_item${id}.webp`, server),
      fallbackSrc: null
    };
  }
  return null;
};
