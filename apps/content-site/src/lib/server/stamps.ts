import {
  getStampsByRegionList,
  type GetStampsByRegionListData
} from "@platform/sekai-master-api-sdk";
import type { MysekaiPagination } from "$lib/domain/mysekai";
import type { StampItem, StampListQuery } from "$lib/domain/stamp";
import { getMasterApiV1BaseUrl } from "./catalogue-data";
import { toPagination } from "./mysekai";

// 48 fills whole rows at every stamp grid width (2, 3, 4, and 6 columns) and keeps the
// first page taller than a desktop viewport.
export const STAMP_PAGE_SIZE = 48;

export type StampListPage = { items: StampItem[]; pagination: MysekaiPagination };

export const createStampListRequestQuery = (
  query: StampListQuery,
  page: number
): NonNullable<GetStampsByRegionListData["query"]> => {
  const characterIds = [query.characterId, query.secondCharacterId].filter(
    (id): id is number => id !== null
  );
  return {
    page,
    page_size: STAMP_PAGE_SIZE,
    sort_by: "id",
    sort_order: query.sortOrder,
    ...(query.name ? { name: query.name } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(characterIds.length > 0 ? { character_id: characterIds.join(",") } : {})
  };
};

export const fetchStampListPage = async (
  baseUrl: string,
  region: string,
  query: StampListQuery,
  page = 1
): Promise<StampListPage> => {
  const response = await getStampsByRegionList({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region },
    query: createStampListRequestQuery(query, page)
  });
  if (response.error || !response.data) {
    throw new Error("Failed to load stamps.");
  }
  return {
    items: response.data.items ?? [],
    pagination: toPagination(response.data.pagination, page, STAMP_PAGE_SIZE)
  };
};
