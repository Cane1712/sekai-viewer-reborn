import { getBondsHonorsByRegionById, getHonorsByRegionById } from "@platform/sekai-master-api-sdk";
import type { TitlePreview, TitlePreviewKind } from "$lib/domain/title-preview";
import { toCatalogueBondsHonorDegree, toCatalogueHonorDegree } from "$lib/honor-degree";
import { getMasterApiV1BaseUrl } from "./catalogue-data";
import { parseBondsHonor, parseHonor } from "./honor-list";

const withLevel = <T extends { level?: number | null }>(degree: T, level: number | null): T =>
  level !== null && Number.isSafeInteger(level) && level > 0 ? { ...degree, level } : degree;

/**
 * Loads one rewarded title for the preview dialog, rendered at the rewarded level.
 * Returns null when the title does not exist in the region.
 */
export const fetchTitlePreview = async (
  baseUrl: string,
  region: string,
  kind: TitlePreviewKind,
  id: number,
  level: number | null
): Promise<TitlePreview | null> => {
  const options = { baseUrl: getMasterApiV1BaseUrl(baseUrl), path: { region, id } };

  if (kind === "bonds") {
    const response = await getBondsHonorsByRegionById(options);
    const honor = response.error ? null : parseBondsHonor(response.data);
    if (!honor) return null;
    const degree = toCatalogueBondsHonorDegree(honor).main;
    return {
      kind,
      id,
      name: honor.name,
      rarity: honor.honorRarity,
      subtitle: honor.words[0]?.name ?? null,
      degree: degree.kind === "bonds" ? withLevel(degree, level) : degree,
      levels: honor.levels
    };
  }

  const response = await getHonorsByRegionById(options);
  const honor = response.error ? null : parseHonor(response.data);
  if (!honor) return null;
  const group = honor.group ?? {
    id: honor.groupId,
    name: null,
    honorType: honor.honorType,
    backgroundAssetBundleName: null,
    frameName: null
  };
  const degree = toCatalogueHonorDegree(honor, group).main;
  return {
    kind,
    id,
    name: honor.name,
    rarity:
      honor.honorRarity ?? honor.levels.find((entry) => entry.honorRarity)?.honorRarity ?? null,
    subtitle: group.name,
    degree: degree.kind === "normal" ? withLevel(degree, level) : degree,
    levels: honor.levels.map((entry) => ({ level: entry.level, description: entry.description }))
  };
};
