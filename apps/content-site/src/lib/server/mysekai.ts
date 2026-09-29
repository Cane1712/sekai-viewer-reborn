import {
  getMysekaiFixturesByRegionById,
  getMysekaiFixturesByRegionFilters,
  getMysekaiFixturesByRegionList,
  getMysekaiMaterialsByRegionById,
  getMysekaiMaterialsByRegionList,
  getMysekaiMusicRecordsByRegionFilters,
  getMysekaiMusicRecordsByRegionList,
  type GetMysekaiFixturesByRegionListData,
  type GetMysekaiMusicRecordsByRegionListData
} from "@platform/sekai-master-api-sdk";
import type {
  MysekaiFixtureDetail,
  MysekaiFixtureFilters,
  MysekaiFixtureListPage,
  MysekaiFixtureListQuery,
  MysekaiMaterial,
  MysekaiMaterialDetail,
  MysekaiMusicRecordFilters,
  MysekaiMusicRecordListPage,
  MysekaiSoundtrackListQuery,
  MysekaiPagination
} from "$lib/domain/mysekai";
import { getMasterApiV1BaseUrl } from "./catalogue-data";

// 48 fills whole rows at every fixture grid width (2, 3, 4, and 6 columns) and keeps the
// first page taller than a desktop viewport.
export const MYSEKAI_FIXTURE_PAGE_SIZE = 48;
export const MYSEKAI_SOUNDTRACK_PAGE_SIZE = 48;
// The master API's page size limit; every region has fewer materials than this.
const MYSEKAI_MATERIAL_PAGE_SIZE = 100;
const MAX_MATERIAL_PAGES = 5;

type MasterApiPagination = {
  page?: number;
  page_size?: number;
  total?: number;
  total_pages?: number;
  has_next?: boolean;
};

const toPagination = (
  pagination: MasterApiPagination | undefined,
  page: number,
  pageSize: number
): MysekaiPagination => ({
  page: pagination?.page ?? page,
  pageSize: pagination?.page_size ?? pageSize,
  total: pagination?.total ?? null,
  hasNext: pagination?.has_next ?? false
});

export const createMysekaiFixtureListRequestQuery = (
  query: MysekaiFixtureListQuery,
  page: number
): NonNullable<GetMysekaiFixturesByRegionListData["query"]> => {
  const tagIds = [query.seriesTagId, query.unitTagId, query.characterTagId].filter(
    (id): id is number => id !== null
  );
  return {
    page,
    page_size: MYSEKAI_FIXTURE_PAGE_SIZE,
    sort_by: "id",
    sort_order: query.sortOrder,
    ...(query.name ? { name: query.name } : {}),
    ...(query.mainGenreId === null ? {} : { main_genre_id: String(query.mainGenreId) }),
    ...(query.mainGenreId === null || query.subGenreId === null
      ? {}
      : { sub_genre_id: String(query.subGenreId) }),
    ...(tagIds.length > 0 ? { tag_id: tagIds.join(",") } : {})
  };
};

export const fetchMysekaiFixtureListPage = async (
  baseUrl: string,
  region: string,
  query: MysekaiFixtureListQuery,
  page = 1
): Promise<MysekaiFixtureListPage> => {
  const response = await getMysekaiFixturesByRegionList({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region },
    query: createMysekaiFixtureListRequestQuery(query, page)
  });
  if (response.error || !response.data) {
    throw new Error("Failed to load MySekai fixtures.");
  }
  return {
    items: response.data.items ?? [],
    pagination: toPagination(response.data.pagination, page, MYSEKAI_FIXTURE_PAGE_SIZE)
  };
};

export const fetchMysekaiFixtureFilters = async (
  baseUrl: string,
  region: string
): Promise<MysekaiFixtureFilters> => {
  const response = await getMysekaiFixturesByRegionFilters({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region }
  });
  if (response.error || !response.data) {
    throw new Error("Failed to load MySekai fixture filters.");
  }
  return {
    mainGenres: (response.data.mainGenres ?? []).map((genre) => ({
      ...genre,
      subGenres: genre.subGenres ?? []
    })),
    tags: response.data.tags ?? []
  };
};

export const fetchMysekaiFixtureDetail = async (
  baseUrl: string,
  region: string,
  id: number
): Promise<MysekaiFixtureDetail | null> => {
  const response = await getMysekaiFixturesByRegionById({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region, id }
  });
  if (response.response?.status === 404) return null;
  if (response.error || !response.data) {
    throw new Error("Failed to load MySekai fixture.");
  }
  return response.data;
};

/** Every material of the region, in stored order. */
export const fetchMysekaiMaterials = async (
  baseUrl: string,
  region: string
): Promise<MysekaiMaterial[]> => {
  const materials: MysekaiMaterial[] = [];
  for (let page = 1; page <= MAX_MATERIAL_PAGES; page += 1) {
    const response = await getMysekaiMaterialsByRegionList({
      baseUrl: getMasterApiV1BaseUrl(baseUrl),
      path: { region },
      query: { page, page_size: MYSEKAI_MATERIAL_PAGE_SIZE }
    });
    if (response.error || !response.data) {
      throw new Error("Failed to load MySekai materials.");
    }
    materials.push(...(response.data.items ?? []));
    if (!response.data.pagination?.has_next) break;
  }
  return materials;
};

export const fetchMysekaiMaterialDetail = async (
  baseUrl: string,
  region: string,
  id: number
): Promise<MysekaiMaterialDetail | null> => {
  const response = await getMysekaiMaterialsByRegionById({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region, id }
  });
  if (response.response?.status === 404) return null;
  if (response.error || !response.data) {
    throw new Error("Failed to load MySekai material.");
  }
  return response.data;
};

/** Soundtracks are the music records of the `music_sound_track` type. */
export const createMysekaiSoundtrackListRequestQuery = (
  query: MysekaiSoundtrackListQuery,
  page: number
): NonNullable<GetMysekaiMusicRecordsByRegionListData["query"]> => ({
  page,
  page_size: MYSEKAI_SOUNDTRACK_PAGE_SIZE,
  track_type: "music_sound_track",
  ...(query.name ? { name: query.name } : {}),
  ...(query.categoryId === null ? {} : { sound_track_category_id: String(query.categoryId) })
});

export const fetchMysekaiSoundtrackListPage = async (
  baseUrl: string,
  region: string,
  query: MysekaiSoundtrackListQuery,
  page = 1
): Promise<MysekaiMusicRecordListPage> => {
  const response = await getMysekaiMusicRecordsByRegionList({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region },
    query: createMysekaiSoundtrackListRequestQuery(query, page)
  });
  if (response.error || !response.data) {
    throw new Error("Failed to load MySekai soundtracks.");
  }
  return {
    items: response.data.items ?? [],
    pagination: toPagination(response.data.pagination, page, MYSEKAI_SOUNDTRACK_PAGE_SIZE)
  };
};

export const fetchMysekaiSoundtrackFilters = async (
  baseUrl: string,
  region: string
): Promise<MysekaiMusicRecordFilters> => {
  const response = await getMysekaiMusicRecordsByRegionFilters({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region }
  });
  if (response.error || !response.data) {
    throw new Error("Failed to load MySekai soundtrack categories.");
  }
  return { soundTrackCategories: response.data.soundTrackCategories ?? [] };
};
