import {
  getBondsHonorsByRegionList,
  getHonorGroupsByRegionList,
  type GetHonorGroupsByRegionListData
} from "@platform/sekai-master-api-sdk";
import type {
  BondsHonor,
  BondsHonorGroup,
  BondsHonorUnit,
  BondsHonorWord,
  Honor,
  HonorGroup,
  HonorGroupMetadata,
  HonorLevel
} from "$lib/domain/honor";
import type { CataloguePagination } from "./catalogue-data";
import {
  getArray,
  getCatalogueHasNext,
  getItems,
  getMasterApiV1BaseUrl,
  getNumber,
  getObject,
  getPositiveInteger,
  getString,
  parseCataloguePaginationMetadata,
  validateCataloguePageContent,
  validateCataloguePageRequest
} from "./catalogue-data";

// 24 fills whole rows at every catalogue grid width (2, 3, and 4 columns) and keeps the
// first page taller than a desktop viewport, so the next page loads only after scrolling.
export const DEFAULT_HONOR_LIST_PAGE_SIZE = 24;
export type HonorListSortBy = "id";
export type HonorListSortOrder = "asc" | "desc";

export type HonorListQueryState = {
  honorType: string | null;
  name: string;
  sortBy: HonorListSortBy;
  sortOrder: HonorListSortOrder;
};

export type HonorListPagination = CataloguePagination;

export type HonorListPage = {
  items: HonorGroup[];
  /** Filled instead of items when the Bonds category is selected. */
  bondsItems: BondsHonorGroup[];
  availableHonorTypes: string[];
  pagination: HonorListPagination;
};

/** Bonds honors are their own entity, listed as an extra honor category. */
export const BONDS_HONOR_TYPE = "bonds";
// A page holds whole pairs in every region: 72 honors are 24 JP/TW/KR/CN pairs
// (three rarities each) or 36 EN pairs (two). A pair split by a page boundary is
// merged when the next page is appended.
export const BONDS_HONOR_LIST_PAGE_SIZE = 72;

const withBondsHonorType = (honorTypes: string[]): string[] => [
  ...honorTypes.filter((honorType) => honorType !== BONDS_HONOR_TYPE),
  BONDS_HONOR_TYPE
];

const getTrimmedSearchParam = (value: string | null): string => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "";
};

export const parseHonorListQueryState = (searchParams: URLSearchParams): HonorListQueryState => ({
  honorType: (() => {
    const value = getTrimmedSearchParam(searchParams.get("honor_type"));
    return value.length > 0 ? value : null;
  })(),
  name: getTrimmedSearchParam(searchParams.get("name")),
  sortBy: "id",
  sortOrder: searchParams.get("sort_order") === "desc" ? "desc" : "asc"
});

export const getDefaultHonorListQueryState = (): HonorListQueryState => ({
  honorType: null,
  name: "",
  sortBy: "id",
  sortOrder: "asc"
});

export const createHonorListRequestQuery = (
  queryState: HonorListQueryState,
  page: number,
  pageSize: number
): NonNullable<GetHonorGroupsByRegionListData["query"]> => ({
  page,
  page_size: pageSize,
  sort_by: queryState.sortBy,
  sort_order: queryState.sortOrder,
  ...(queryState.honorType?.trim() ? { honor_type: queryState.honorType.trim() } : {}),
  ...(queryState.name.trim() ? { name: queryState.name.trim() } : {})
});

const parseApiPagination = (
  payload: unknown,
  requestedPage: number,
  pageSize: number,
  itemCount: number
): HonorListPagination => {
  const metadata = parseCataloguePaginationMetadata(payload, "Honor");
  validateCataloguePageRequest(metadata, requestedPage, pageSize, itemCount, "Honor");
  const hasNext = getCatalogueHasNext(metadata, requestedPage, pageSize, itemCount, "Honor");
  const isFirstPageOfEmptyCatalogue =
    requestedPage === 1 &&
    itemCount === 0 &&
    metadata.total === 0 &&
    metadata.totalPages === 0 &&
    !hasNext;

  if (
    metadata.totalPages !== null &&
    requestedPage > metadata.totalPages &&
    !isFirstPageOfEmptyCatalogue
  ) {
    throw new Error("Honor catalogue requested a page beyond its reported page count.");
  }

  validateCataloguePageContent(
    metadata.total,
    requestedPage,
    pageSize,
    itemCount,
    hasNext,
    "Honor"
  );

  return {
    page: requestedPage,
    pageSize,
    hasNext,
    total: metadata.total,
    totalPages: metadata.totalPages
  };
};

const parseHonorGroupMetadata = (payload: unknown): HonorGroupMetadata | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    id: getPositiveInteger(root.id),
    name: getString(root.name),
    honorType: getString(root.honorType),
    backgroundAssetBundleName: getString(
      root.backgroundAssetbundleName ?? root.backgroundAssetBundleName
    ),
    frameName: getString(root.frameName)
  };
};

const parseHonorLevel = (payload: unknown): HonorLevel | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    assetBundleName: getString(root.assetbundleName ?? root.assetBundleName),
    bonus: getNumber(root.bonus),
    description: getString(root.description),
    honorId: getPositiveInteger(root.honorId),
    honorRarity: getString(root.honorRarity),
    level: getNumber(root.level)
  };
};

export const parseHonor = (
  payload: unknown,
  fallbackGroup: HonorGroupMetadata | null = null
): Honor | null => {
  const root = getObject(payload);
  const id = getPositiveInteger(root?.id);
  if (!root || id === null) {
    return null;
  }

  const group = parseHonorGroupMetadata(root.group) ?? fallbackGroup;

  return {
    id,
    assetBundleName: getString(root.assetbundleName ?? root.assetBundleName),
    group,
    groupId: getPositiveInteger(root.groupId) ?? group?.id ?? null,
    honorMissionType: getString(root.honorMissionType),
    honorRarity: getString(root.honorRarity),
    honorType: getString(root.honorType),
    honorTypeId: getPositiveInteger(root.honorTypeId),
    levels: getArray(root.levels).flatMap((item) => {
      const level = parseHonorLevel(item);
      return level ? [level] : [];
    }),
    name: getString(root.name),
    seq: getNumber(root.seq)
  };
};

const parseHonorGroup = (payload: unknown): HonorGroup | null => {
  const root = getObject(payload);
  const metadata = parseHonorGroupMetadata(root);
  if (!root || !metadata) {
    return null;
  }
  if (metadata.id === null) {
    return null;
  }

  return {
    ...metadata,
    id: metadata.id,
    honors: getArray(root.honors).flatMap((item) => {
      const honor = parseHonor(item, metadata);
      return honor ? [honor] : [];
    })
  };
};

export const parseHonorGroupList = (payload: unknown): HonorGroup[] =>
  (getItems(payload) ?? []).flatMap((item) => {
    const group = parseHonorGroup(item);
    return group ? [group] : [];
  });

const parseAvailableHonorTypes = (payload: unknown): string[] => {
  const root = getObject(payload);
  const seen = new Set<string>();

  return getArray(root?.availableHonorTypes).flatMap((value) => {
    const honorType = getString(value);
    if (honorType === null || seen.has(honorType)) {
      return [];
    }

    seen.add(honorType);
    return [honorType];
  });
};

export const createEmptyHonorListPage = (page: number): HonorListPage => ({
  items: [],
  bondsItems: [],
  availableHonorTypes: [],
  pagination: {
    page,
    pageSize: DEFAULT_HONOR_LIST_PAGE_SIZE,
    hasNext: false,
    total: null,
    totalPages: null
  }
});

export const fetchHonorListPage = async (
  baseUrl: string,
  region: string,
  page = 1,
  queryState: HonorListQueryState = getDefaultHonorListQueryState()
): Promise<HonorListPage> => {
  if (queryState.honorType === BONDS_HONOR_TYPE) {
    return fetchBondsHonorListPage(baseUrl, region, page, queryState);
  }

  const response = await getHonorGroupsByRegionList({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region },
    query: createHonorListRequestQuery(queryState, page, DEFAULT_HONOR_LIST_PAGE_SIZE)
  });

  if (response.error || !response.data) {
    throw new Error("Failed to load honor catalogue.");
  }

  const sourceGroups = getItems(response.data);
  if (sourceGroups === null) {
    throw new TypeError("Honor catalogue returned invalid groups.");
  }

  const items = parseHonorGroupList(response.data);

  return {
    items,
    bondsItems: [],
    availableHonorTypes: withBondsHonorType(parseAvailableHonorTypes(response.data)),
    pagination: parseApiPagination(
      response.data,
      page,
      DEFAULT_HONOR_LIST_PAGE_SIZE,
      sourceGroups.length
    )
  };
};

const parseBondsHonorUnit = (payload: unknown): BondsHonorUnit | null => {
  const root = getObject(payload);
  const id = getPositiveInteger(root?.id);
  if (!root || id === null) return null;
  return {
    id,
    gameCharacterId: getPositiveInteger(root.gameCharacterId),
    unit: getString(root.unit),
    colorCode: getString(root.colorCode)
  };
};

const parseBondsHonorWord = (payload: unknown): BondsHonorWord | null => {
  const root = getObject(payload);
  const id = getPositiveInteger(root?.id);
  if (!root || id === null) return null;
  return {
    id,
    seq: getNumber(root.seq),
    assetBundleName: getString(root.assetbundleName ?? root.assetBundleName),
    name: getString(root.name)
  };
};

export const parseBondsHonor = (payload: unknown): BondsHonor | null => {
  const root = getObject(payload);
  const id = getPositiveInteger(root?.id);
  const bondsGroupId = getPositiveInteger(root?.bondsGroupId);
  if (!root || id === null || bondsGroupId === null) return null;
  return {
    id,
    bondsGroupId,
    name: getString(root.name),
    honorRarity: getString(root.honorRarity),
    levels: getArray(root.levels).flatMap((item) => {
      const level = getObject(item);
      return level
        ? [{ level: getNumber(level.level), description: getString(level.description) }]
        : [];
    }),
    words: getArray(root.words)
      .flatMap((item) => {
        const word = parseBondsHonorWord(item);
        return word ? [word] : [];
      })
      .sort((left, right) => (left.seq ?? 0) - (right.seq ?? 0) || left.id - right.id),
    units: [parseBondsHonorUnit(root.characterUnit1), parseBondsHonorUnit(root.characterUnit2)]
  };
};

/** Groups consecutive honors of the same pair, keeping the list order. */
export const groupBondsHonors = (honors: BondsHonor[]): BondsHonorGroup[] =>
  honors.reduce<BondsHonorGroup[]>((groups, honor) => {
    const last = groups.at(-1);
    if (last?.id === honor.bondsGroupId) {
      last.honors.push(honor);
    } else {
      groups.push({ id: honor.bondsGroupId, name: honor.name, honors: [honor] });
    }
    return groups;
  }, []);

/** The honor-type filter comes from the regular groups; a failure only hides it. */
const fetchAvailableHonorTypes = async (baseUrl: string, region: string): Promise<string[]> => {
  try {
    const response = await getHonorGroupsByRegionList({
      baseUrl: getMasterApiV1BaseUrl(baseUrl),
      path: { region },
      query: { page: 1, page_size: 1 }
    });
    return response.error ? [] : parseAvailableHonorTypes(response.data);
  } catch {
    return [];
  }
};

const fetchBondsHonorListPage = async (
  baseUrl: string,
  region: string,
  page: number,
  queryState: HonorListQueryState
): Promise<HonorListPage> => {
  const [response, availableHonorTypes] = await Promise.all([
    getBondsHonorsByRegionList({
      baseUrl: getMasterApiV1BaseUrl(baseUrl),
      path: { region },
      query: {
        page,
        page_size: BONDS_HONOR_LIST_PAGE_SIZE,
        sort_by: "id",
        sort_order: queryState.sortOrder,
        ...(queryState.name.trim() ? { name: queryState.name.trim() } : {})
      }
    }),
    fetchAvailableHonorTypes(baseUrl, region)
  ]);

  if (response.error || !response.data) {
    throw new Error("Failed to load bonds honor catalogue.");
  }
  const sourceHonors = getItems(response.data);
  if (sourceHonors === null) {
    throw new TypeError("Bonds honor catalogue returned invalid honors.");
  }

  return {
    items: [],
    bondsItems: groupBondsHonors(
      sourceHonors.flatMap((item) => {
        const honor = parseBondsHonor(item);
        return honor ? [honor] : [];
      })
    ),
    availableHonorTypes: withBondsHonorType(availableHonorTypes),
    pagination: parseApiPagination(
      response.data,
      page,
      BONDS_HONOR_LIST_PAGE_SIZE,
      sourceHonors.length
    )
  };
};
