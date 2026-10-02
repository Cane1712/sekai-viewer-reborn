import type { HonorDegreeAssetResolver } from "@platform/ui-shell";
import { getRemoteAssetEndpointURL } from "$lib/assets/index";
import type { SupportedRegion } from "$lib/domain/regions";

export {
  getBondsHonorPartnerUnit,
  hasBondsHonorOutfitOption,
  toCatalogueBondsHonorDegree,
  toCatalogueHonorDegree,
  type CatalogueHonorDegree
} from "@platform/ui-shell/honor-degree-adapter";

export function createHonorDegreeAssetResolver(region: SupportedRegion): HonorDegreeAssetResolver {
  return (bundle, resource) => {
    const name = resource.replace(/\.png$/, "");
    if (bundle === "local/honor") return `/degree/${name}.png`;
    if (bundle === "local/bonds-honor") return `/degree/bonds/${name}.png`;
    if (bundle === "local/live-master") return `/degree/live-master/${name}.png`;
    // Bonds art was re-exported untrimmed (160×136 and 380×80) on 2026-09-27; the
    // query skips trimmed copies still in Cloudflare and browser caches (14 days).
    if (/^bonds_honor\/(character|word)$/.test(bundle)) {
      return `${getRemoteAssetEndpointURL(`${bundle}/${name}.webp`, region)}?v=2`;
    }
    if (!/^(honor|honor_frame|rank_live\/honor)\//.test(bundle)) return null;
    return getRemoteAssetEndpointURL(`${bundle}/${name}.webp`, region);
  };
}
