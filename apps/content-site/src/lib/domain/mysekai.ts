import type {
  SharedMusicSoundTrackCategoryResponse,
  SharedMysekaiFixtureDetailResponse,
  SharedMysekaiFixtureGenreResponse,
  SharedMysekaiFixtureListItemResponse,
  SharedMysekaiFixtureMainGenreResponse,
  SharedMysekaiFixtureTagResponse,
  SharedMysekaiMaterialDetailResponse,
  SharedMysekaiMaterialResponse,
  SharedMysekaiMusicRecordResponse
} from "@platform/sekai-master-api-sdk";

export type MysekaiFixture = SharedMysekaiFixtureListItemResponse;
export type MysekaiFixtureDetail = SharedMysekaiFixtureDetailResponse;
export type MysekaiFixtureGenre = SharedMysekaiFixtureGenreResponse;
export type MysekaiFixtureMainGenre = Omit<SharedMysekaiFixtureMainGenreResponse, "subGenres"> & {
  subGenres: MysekaiFixtureGenre[];
};
export type MysekaiFixtureTag = SharedMysekaiFixtureTagResponse;
export type MysekaiMaterial = SharedMysekaiMaterialResponse;
export type MysekaiMaterialDetail = SharedMysekaiMaterialDetailResponse;
export type MysekaiMusicRecord = SharedMysekaiMusicRecordResponse;
export type MusicSoundTrackCategory = SharedMusicSoundTrackCategoryResponse;

export type MysekaiPagination = {
  page: number;
  pageSize: number;
  total: number | null;
  hasNext: boolean;
};

export type MysekaiFixtureListQuery = {
  name: string;
  mainGenreId: number | null;
  subGenreId: number | null;
  seriesTagId: number | null;
  unitTagId: number | null;
  characterTagId: number | null;
  sortOrder: "asc" | "desc";
};

export type MysekaiFixtureListPage = {
  items: MysekaiFixture[];
  pagination: MysekaiPagination;
};

export type MysekaiFixtureFilters = {
  mainGenres: MysekaiFixtureMainGenre[];
  tags: MysekaiFixtureTag[];
};

/** The MySekai soundtrack list: music records of the `music_sound_track` type. */
export type MysekaiSoundtrackListQuery = {
  name: string;
  categoryId: number | null;
};

export type MysekaiMusicRecordListPage = {
  items: MysekaiMusicRecord[];
  pagination: MysekaiPagination;
};

export type MysekaiMusicRecordFilters = {
  soundTrackCategories: MusicSoundTrackCategory[];
};

/** The material filter tabs, as in the game: every type other than these is "other". */
export const mysekaiMaterialTabs = ["wood", "mineral", "plant", "other"] as const;
export type MysekaiMaterialTab = (typeof mysekaiMaterialTabs)[number];

export const getMysekaiMaterialTab = (
  materialType: string | null | undefined
): MysekaiMaterialTab =>
  materialType === "wood" || materialType === "mineral" || materialType === "plant"
    ? materialType
    : "other";

/** The rarity number of `rarity_{n}`, or null. */
export const getMysekaiMaterialRarity = (rarityType: string | null | undefined): number | null => {
  const match = /^rarity_(\d+)$/.exec(rarityType ?? "");
  return match ? Number(match[1]) : null;
};

export const mysekaiFixtureTagTypes = ["series", "unit", "game_character"] as const;

export const getMysekaiFixtureTagsOfType = (
  tags: MysekaiFixtureTag[],
  type: (typeof mysekaiFixtureTagTypes)[number]
): MysekaiFixtureTag[] => tags.filter((tag) => tag.mysekaiFixtureTagType === type);

const parsePositiveId = (value: string | null): number | null => {
  const normalized = value?.trim() ?? "";
  if (!/^\d+$/.test(normalized)) return null;
  const id = Number(normalized);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const trimmed = (value: string | null): string => value?.trim() ?? "";

export const parseMysekaiFixtureListQuery = (
  searchParams: URLSearchParams
): MysekaiFixtureListQuery => {
  const mainGenreId = parsePositiveId(searchParams.get("main_genre_id"));
  return {
    name: trimmed(searchParams.get("name")),
    mainGenreId,
    // A sub-genre only narrows its main genre.
    subGenreId: mainGenreId === null ? null : parsePositiveId(searchParams.get("sub_genre_id")),
    seriesTagId: parsePositiveId(searchParams.get("series")),
    unitTagId: parsePositiveId(searchParams.get("unit")),
    characterTagId: parsePositiveId(searchParams.get("character")),
    sortOrder: searchParams.get("sort_order") === "desc" ? "desc" : "asc"
  };
};

/** The page URL's query for a fixture list query, without defaults. */
export const toMysekaiFixtureSearchParams = (
  query: MysekaiFixtureListQuery,
  page?: number
): URLSearchParams => {
  const params = new URLSearchParams();
  if (page !== undefined) params.set("page", String(page));
  if (query.name) params.set("name", query.name);
  if (query.mainGenreId !== null) params.set("main_genre_id", String(query.mainGenreId));
  if (query.mainGenreId !== null && query.subGenreId !== null) {
    params.set("sub_genre_id", String(query.subGenreId));
  }
  if (query.seriesTagId !== null) params.set("series", String(query.seriesTagId));
  if (query.unitTagId !== null) params.set("unit", String(query.unitTagId));
  if (query.characterTagId !== null) params.set("character", String(query.characterTagId));
  if (query.sortOrder === "desc") params.set("sort_order", "desc");
  return params;
};

export const parseMysekaiSoundtrackListQuery = (
  searchParams: URLSearchParams
): MysekaiSoundtrackListQuery => ({
  name: trimmed(searchParams.get("name")),
  categoryId: parsePositiveId(searchParams.get("category"))
});

export const toMysekaiSoundtrackSearchParams = (
  query: MysekaiSoundtrackListQuery,
  page?: number
): URLSearchParams => {
  const params = new URLSearchParams();
  if (page !== undefined) params.set("page", String(page));
  if (query.name) params.set("name", query.name);
  if (query.categoryId !== null) params.set("category", String(query.categoryId));
  return params;
};

/** A detail page's streamed record: found, missing in the region, or failed to load. */
export type MysekaiDetailPayload<T> =
  { status: "ready"; item: T } | { status: "notFound" | "error"; item: null };

/** Loads a detail record by its route ID, resolving (never rejecting) to its payload. */
export const loadMysekaiDetail = <T>(
  rawId: string,
  fetchById: (id: number) => Promise<T | null>
): Promise<MysekaiDetailPayload<T>> => {
  const id = /^\d+$/.test(rawId) ? Number(rawId) : 0;
  if (!Number.isSafeInteger(id) || id <= 0) {
    return Promise.resolve({ status: "notFound", item: null });
  }
  return fetchById(id).then(
    (item): MysekaiDetailPayload<T> =>
      item === null ? { status: "notFound", item: null } : { status: "ready", item },
    (): MysekaiDetailPayload<T> => ({ status: "error", item: null })
  );
};
