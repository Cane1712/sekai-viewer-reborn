import type { GetVirtualLivesByRegionListData } from "@platform/sekai-master-api-sdk";
import { dev } from "$app/environment";
import {
  DEFAULT_VIRTUAL_LIVE_LIST_QUERY_STATE,
  DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE,
  deriveVirtualLiveStatus,
  type VirtualLiveListPage,
  type VirtualLiveListItem,
  type VirtualLiveListPagination,
  type VirtualLiveListQueryState,
  type VirtualLiveListSortBy,
  type VirtualLiveListSortOrder
} from "$lib/domain/virtual-live";

const DEFAULT_VIRTUAL_LIVE_LIST_QUERY_STATE_COPY: VirtualLiveListQueryState = {
  ...DEFAULT_VIRTUAL_LIVE_LIST_QUERY_STATE
};

const getTrimmedSearchParam = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
};

const parseSortBy = (value: string | null): VirtualLiveListSortBy =>
  value === "id" ? "id" : "startAt";

const parseSortOrder = (value: string | null): VirtualLiveListSortOrder =>
  value === "asc" ? "asc" : "desc";

const parseMultiValueParam = (searchParams: URLSearchParams, key: string): string[] => {
  const values = searchParams
    .getAll(key)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return [...new Set(values)]; // Remove duplicates
};

export const parseVirtualLiveListQueryState = (
  searchParams: URLSearchParams
): VirtualLiveListQueryState => ({
  name: getTrimmedSearchParam(searchParams.get("name")),
  id: getTrimmedSearchParam(searchParams.get("id")),
  virtualLiveType: parseMultiValueParam(searchParams, "virtual_live_type"),
  spoiler: searchParams.get("spoiler") === "true",
  sortBy: parseSortBy(searchParams.get("sort_by")),
  sortOrder: parseSortOrder(searchParams.get("sort_order"))
});

export const createVirtualLiveListRequestQuery = (
  queryState: VirtualLiveListQueryState,
  page: number,
  pageSize: number,
  includeSpoilerContent: boolean
): GetVirtualLivesByRegionListData["query"] => {
  const query: NonNullable<GetVirtualLivesByRegionListData["query"]> = {
    page,
    page_size: pageSize,
    spoiler: includeSpoilerContent,
    sort_by: queryState.sortBy,
    sort_order: queryState.sortOrder
  };

  if (queryState.name) {
    query.name = queryState.name;
  }

  if (queryState.id) {
    const parsedId = Number.parseInt(queryState.id, 10);
    if (Number.isFinite(parsedId)) {
      query.id = parsedId;
    }
  }

  if (queryState.virtualLiveType.length > 0) {
    query.virtual_live_type = queryState.virtualLiveType.join(",");
  }

  return query;
};

export { DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE };

export const logVirtualLiveListFilterDebug = (
  label: string,
  details: Record<string, unknown>
): void => {
  if (!dev) {
    return;
  }

  console.debug("[content-site:virtual-live-filter]", label, details);
};

export const getDefaultVirtualLiveListQueryState = (): VirtualLiveListQueryState => ({
  ...DEFAULT_VIRTUAL_LIVE_LIST_QUERY_STATE_COPY
});

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getArray = (value: unknown): unknown[] | null => (Array.isArray(value) ? value : null);

const pickFirstStringLike = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstString = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstDateValue = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | number | null => {
  for (const key of keys) {
    const value = getDateValue(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const parseVirtualLiveListItem = (payload: unknown): VirtualLiveListItem | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const id = pickFirstStringLike(root, ["id", "virtualLiveId"]);
  const name = pickFirstString(root, ["name", "virtualLiveName"]);

  if (!id || !name) {
    return null;
  }

  const startAt = pickFirstDateValue(root, ["startAt", "start_at", "startDate"]);
  const endAt = pickFirstDateValue(root, ["endAt", "end_at", "endDate"]);

  return {
    id,
    name,
    virtualLiveType: pickFirstString(root, ["virtualLiveType", "virtual_live_type"]),
    assetBundleName: pickFirstString(root, ["assetbundleName", "assetBundleName"]),
    groupAssetBundleName: pickFirstString(getObject(root["virtualLiveGroup"]) ?? {}, [
      "assetbundleName",
      "assetBundleName"
    ]),
    startAt,
    endAt,
    status: deriveVirtualLiveStatus(startAt, endAt)
  };
};

const parsePagination = (
  payload: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
  itemCount: number
): VirtualLiveListPagination => {
  const root = getObject(payload);
  const paginationNode = (root && (root["pagination"] ?? root["meta"] ?? root["data"])) ?? null;
  const paginationSource = getObject(paginationNode) ?? {};
  const page = getNumber(paginationSource["page"]) ?? fallbackPage;
  const pageSize =
    getNumber(paginationSource["page_size"] ?? paginationSource["pageSize"]) ?? fallbackPageSize;
  const total = getNumber(paginationSource["total"]);
  const totalPages = getNumber(paginationSource["total_pages"] ?? paginationSource["totalPages"]);

  const hasNextFlag =
    typeof paginationSource["has_next"] === "boolean"
      ? (paginationSource["has_next"] as boolean)
      : null;

  const hasNext =
    hasNextFlag ??
    (totalPages !== null ? page < totalPages : pageSize > 0 && itemCount >= pageSize);

  return {
    page,
    pageSize,
    hasNext,
    total,
    totalPages
  };
};

export const parseVirtualLiveListPage = (
  payload: unknown,
  page: number,
  pageSize: number
): VirtualLiveListPage => {
  const root = getObject(payload);
  const dataNode = root ? getObject(root["data"]) : null;
  const itemsSource = getArray(root?.["items"]) ?? getArray(dataNode?.["items"]) ?? [];
  const items = itemsSource
    .map(parseVirtualLiveListItem)
    .filter((item): item is VirtualLiveListItem => item !== null);

  return {
    items,
    pagination: parsePagination(payload, page, pageSize, items.length)
  };
};
