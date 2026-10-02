import {
  getCharacterMissionV2ParameterGroupsByRegionByIdLevels,
  getCharacterRanksByRegionList,
  getMissionsByRegionList,
  type GetMissionsByRegionListData
} from "@platform/sekai-master-api-sdk";
import type {
  CharacterRankReference,
  Mission,
  MissionFamily,
  MissionParameterGroup,
  MissionParameterGroupLevel,
  MissionResourceBox,
  MissionResourceBoxDetail,
  MissionReward
} from "$lib/domain/mission";
import { missionFamilies } from "$lib/domain/mission";
import type { CataloguePagination, CataloguePaginationMetadata } from "./catalogue-data";
import {
  getArray,
  getBoolean,
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

const PAGE_SIZE = 24;
const FAMILY_PAGE_SIZE = PAGE_SIZE / missionFamilies.length;
export type MissionListPagination = CataloguePagination;

export type MissionListPage = {
  items: Mission[];
  pagination: MissionListPagination;
};

const getTotalPagesFromTotal = (total: number | null, pageSize: number): number | null =>
  total === null ? null : Math.ceil(total / pageSize);

const resolveMissionTotalPages = (
  metadata: CataloguePaginationMetadata,
  pageSize: number
): number | null => {
  const pagesFromTotal = getTotalPagesFromTotal(metadata.total, pageSize);
  if (
    metadata.totalPages !== null &&
    pagesFromTotal !== null &&
    metadata.totalPages !== pagesFromTotal &&
    !(metadata.total === 0 && metadata.totalPages === 1)
  ) {
    throw new Error("Mission catalogue returned inconsistent total counts.");
  }

  return metadata.totalPages ?? pagesFromTotal;
};

const validateMissionPageRange = (
  requestedPage: number,
  totalPages: number | null,
  itemCount: number
): void => {
  if (totalPages !== null && requestedPage > totalPages && itemCount > 0) {
    throw new Error("Mission catalogue returned items beyond its reported page count.");
  }
};

const inferMissionTotal = (
  total: number | null,
  totalPages: number | null,
  requestedPage: number,
  pageSize: number,
  itemCount: number,
  hasNext: boolean
): number | null => {
  if (total !== null) {
    return total;
  }

  if (totalPages === 0) {
    return 0;
  }

  if (totalPages === null || requestedPage !== totalPages || hasNext) {
    return null;
  }

  return (totalPages - 1) * pageSize + itemCount;
};

const parseApiPagination = (
  payload: unknown,
  requestedPage: number,
  pageSize: number,
  itemCount: number
): MissionListPagination => {
  const metadata = parseCataloguePaginationMetadata(payload, "Mission");
  validateCataloguePageRequest(metadata, requestedPage, pageSize, itemCount, "Mission");

  const totalPages = resolveMissionTotalPages(metadata, pageSize);
  const resolvedMetadata = { ...metadata, totalPages };
  const hasNext = getCatalogueHasNext(
    resolvedMetadata,
    requestedPage,
    pageSize,
    itemCount,
    "Mission"
  );
  validateMissionPageRange(requestedPage, totalPages, itemCount);
  validateCataloguePageContent(
    metadata.total,
    requestedPage,
    pageSize,
    itemCount,
    hasNext,
    "Mission"
  );

  return {
    page: requestedPage,
    pageSize,
    hasNext,
    total: inferMissionTotal(
      metadata.total,
      totalPages,
      requestedPage,
      pageSize,
      itemCount,
      hasNext
    ),
    totalPages
  };
};

const getStringList = (value: unknown): number[] =>
  getArray(value).flatMap((item) => {
    const parsed = getPositiveInteger(item);
    return parsed === null ? [] : [parsed];
  });

const parseResourceBoxDetail = (payload: unknown): MissionResourceBoxDetail | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    resourceBoxId: getPositiveInteger(root.resourceBoxId),
    resourceBoxPurpose: getString(root.resourceBoxPurpose),
    resourceId: getPositiveInteger(root.resourceId),
    resourceLevel: getNumber(root.resourceLevel),
    resourceQuantity: getNumber(root.resourceQuantity),
    resourceType: getString(root.resourceType),
    seq: getNumber(root.seq),
    resourceName: getString(root.resourceName),
    resourceAssetbundleName: getString(root.resourceAssetbundleName),
    resourceRarity: getString(root.resourceRarity)
  };
};

const parseResourceBox = (payload: unknown): MissionResourceBox | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    id: getPositiveInteger(root.id),
    resourceBoxPurpose: getString(root.resourceBoxPurpose),
    resourceBoxType: getString(root.resourceBoxType),
    details: getArray(root.details).flatMap((item) => {
      const detail = parseResourceBoxDetail(item);
      return detail ? [detail] : [];
    })
  };
};

const parseMissionReward = (payload: unknown): MissionReward | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    id: getPositiveInteger(root.id),
    missionId: getPositiveInteger(root.missionId),
    missionType: getString(root.missionType),
    resourceBox: parseResourceBox(root.resourceBox),
    resourceBoxId: getPositiveInteger(root.resourceBoxId),
    resourceBoxIds: getStringList(root.resourceBoxIds),
    resourceBoxPurpose: getString(root.resourceBoxPurpose),
    resourceId: getPositiveInteger(root.resourceId),
    resourceLevel: getNumber(root.resourceLevel),
    resourceQuantity: getNumber(root.resourceQuantity),
    resourceType: getString(root.resourceType),
    seq: getNumber(root.seq),
    status: getString(root.status)
  };
};

const parseMissionParameterGroupLevel = (payload: unknown): MissionParameterGroupLevel | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    exp: getNumber(root.exp),
    quantity: getNumber(root.quantity),
    requirement: getNumber(root.requirement),
    reward: getObject(root.reward)
      ? {
          resourceQuantity: getNumber(getObject(root.reward)?.resourceQuantity),
          resourceType: getString(getObject(root.reward)?.resourceType)
        }
      : null,
    seq: getNumber(root.seq)
  };
};

const parseMissionParameterGroup = (payload: unknown): MissionParameterGroup | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const levels = getArray(root.previewLevels ?? root.levels)
    .flatMap((item) => {
      const level = parseMissionParameterGroupLevel(item);
      return level ? [level] : [];
    })
    .sort((left, right) => {
      if (left.seq === null) return right.seq === null ? 0 : 1;
      if (right.seq === null) return -1;
      return left.seq - right.seq;
    });

  return {
    id: getPositiveInteger(root.id),
    levels,
    lastLevel: parseMissionParameterGroupLevel(root.lastLevel),
    totalLevels: getPositiveInteger(root.totalLevels) ?? (levels.length > 0 ? levels.length : null)
  };
};

const parseMissionParameterGroupLevels = (payload: unknown): MissionParameterGroupLevel[] =>
  (getItems(payload) ?? [])
    .flatMap((item) => {
      const level = parseMissionParameterGroupLevel(item);
      return level ? [level] : [];
    })
    .sort(
      (left, right) =>
        (left.seq ?? Number.MAX_SAFE_INTEGER) - (right.seq ?? Number.MAX_SAFE_INTEGER)
    );

export type MissionParameterGroupLevelsPage = {
  items: MissionParameterGroupLevel[];
  pagination: { page: number; hasNext: boolean };
};

export const fetchMissionParameterGroupLevels = async (
  baseUrl: string,
  region: string,
  parameterGroupId: number,
  page: number
): Promise<MissionParameterGroupLevelsPage> => {
  const response = await getCharacterMissionV2ParameterGroupsByRegionByIdLevels({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region, id: parameterGroupId },
    query: { page, page_size: 20 }
  });
  if (response.error || !response.data) {
    throw new Error("Failed to load Character Mission V2 levels.");
  }
  const items = parseMissionParameterGroupLevels(response.data);
  const pagination = parseCataloguePaginationMetadata(response.data, "Mission");
  return {
    items,
    pagination: {
      page,
      hasNext: getCatalogueHasNext(pagination, page, 20, items.length, "Mission")
    }
  };
};

// The Master API caps lookup pages at 100 items; complete lists here span a few pages at most.
const FULL_LIST_PAGE_SIZE = 100;
const MAX_FULL_LIST_PAGES = 10;

const fetchAllLookupPages = async (
  label: string,
  fetchPage: (page: number) => Promise<{ data?: unknown; error?: unknown }>
): Promise<unknown[]> => {
  const items: unknown[] = [];
  for (let page = 1; page <= MAX_FULL_LIST_PAGES; page += 1) {
    const response = await fetchPage(page);
    if (response.error || !response.data) {
      throw new Error(`Failed to load ${label}.`);
    }
    const pageItems = getItems(response.data);
    if (pageItems === null) {
      throw new TypeError(`${label} returned invalid items.`);
    }
    items.push(...pageItems);
    const metadata = parseCataloguePaginationMetadata(response.data, "Mission");
    if (!getCatalogueHasNext(metadata, page, FULL_LIST_PAGE_SIZE, pageItems.length, "Mission")) {
      return items;
    }
  }
  throw new Error(`${label} exceeded ${MAX_FULL_LIST_PAGES} pages.`);
};

const parseCharacterRankReference = (item: unknown): CharacterRankReference | null => {
  const root = getObject(item);
  const rank = getPositiveInteger(root?.characterRank);
  if (!root || rank === null) return null;
  const bonusRates = [root.power1BonusRate, root.power2BonusRate, root.power3BonusRate].flatMap(
    (value) => {
      const rate = getNumber(value);
      return rate === null ? [] : [rate];
    }
  );
  return {
    characterRank: rank,
    powerBonusRate: bonusRates.length > 0 ? Math.max(...bonusRates) : null,
    totalExp: getNumber(root.totalExp),
    rewards: getArray(root.rewardResourceBoxes).flatMap((reward) => {
      const parsed = parseResourceBox(reward);
      return parsed ? [parsed] : [];
    })
  };
};

export const fetchCharacterRankReferences = async (
  baseUrl: string,
  region: string,
  characterId: number
): Promise<CharacterRankReference[]> => {
  const items = await fetchAllLookupPages("Character Rank references", (page) =>
    getCharacterRanksByRegionList({
      baseUrl: getMasterApiV1BaseUrl(baseUrl),
      path: { region },
      query: { character_id: characterId, page, page_size: FULL_LIST_PAGE_SIZE }
    })
  );
  return items
    .flatMap((item) => {
      const rank = parseCharacterRankReference(item);
      return rank ? [rank] : [];
    })
    .sort((left, right) => (left.characterRank ?? 0) - (right.characterRank ?? 0));
};

const fetchCompleteMissionFamily = async (
  baseUrl: string,
  region: string,
  family: MissionFamily,
  filters: { characterId?: number } = {}
): Promise<Mission[]> => {
  const items = await fetchAllLookupPages(`${family} missions`, (page) =>
    getMissionsByRegionList({
      baseUrl: getMasterApiV1BaseUrl(baseUrl),
      path: { region },
      query: {
        family,
        ...(filters.characterId === undefined ? {} : { character_id: String(filters.characterId) }),
        page,
        page_size: FULL_LIST_PAGE_SIZE,
        // Story missions have no seq; their IDs follow the target order.
        sort_by: family === "storyMissions" ? "id" : "seq",
        sort_order: "asc"
      }
    })
  );
  const seen = new Set<number>();
  return items.flatMap((item) => {
    const mission = parseMission(item, family);
    if (!mission || seen.has(mission.id)) return [];
    seen.add(mission.id);
    return [mission];
  });
};

export const fetchCharacterMissions = (
  baseUrl: string,
  region: string,
  characterId: number
): Promise<Mission[]> =>
  fetchCompleteMissionFamily(baseUrl, region, "characterMissionV2s", { characterId });

export const fetchStoryMissions = (baseUrl: string, region: string): Promise<Mission[]> =>
  fetchCompleteMissionFamily(baseUrl, region, "storyMissions");

export const fetchNormalMissions = (baseUrl: string, region: string): Promise<Mission[]> =>
  fetchCompleteMissionFamily(baseUrl, region, "normalMissions");

export const parseMission = (payload: unknown, family: MissionFamily): Mission | null => {
  const root = getObject(payload);
  const id = getPositiveInteger(root?.id);
  if (!root || id === null) {
    return null;
  }

  return {
    id,
    family,
    characterId: getPositiveInteger(root.characterId),
    characterMissionType: getString(root.characterMissionType),
    eventId: getPositiveInteger(root.eventId),
    isAchievementMission: getBoolean(root.isAchievementMission),
    normalMissionType: getString(root.normalMissionType),
    parameterGroup: parseMissionParameterGroup(root.parameterGroup),
    parameterGroupId: getPositiveInteger(root.parameterGroupId),
    progressSentence: getString(root.progressSentence),
    requirement: getNumber(root.requirement),
    resourceBoxId: getPositiveInteger(root.resourceBoxId),
    rewards: getArray(root.rewards).flatMap((item) => {
      const reward = parseMissionReward(item);
      return reward ? [reward] : [];
    }),
    sentence: getString(root.sentence),
    seq: getNumber(root.seq),
    storyMissionType: getString(root.storyMissionType)
  };
};

export const parseMissionList = (payload: unknown, family: MissionFamily): Mission[] =>
  (getItems(payload) ?? []).flatMap((item) => {
    const mission = parseMission(item, family);
    return mission ? [mission] : [];
  });

export type MissionListFilters = {
  /** Applies to Character Missions only. */
  characterId?: number | null;
};

const createMissionListQuery = (
  family: MissionFamily,
  page: number,
  filters: MissionListFilters = {}
): NonNullable<GetMissionsByRegionListData["query"]> => ({
  family,
  ...(family === "characterMissionV2s" && filters.characterId
    ? { character_id: String(filters.characterId) }
    : {}),
  page,
  page_size: FAMILY_PAGE_SIZE,
  sort_by: "seq",
  sort_order: "asc"
});

type MissionFamilyPage = {
  items: Mission[];
  pagination: MissionListPagination;
  sourceItemCount: number;
};

const fetchMissionFamilyPage = async (
  baseUrl: string,
  region: string,
  family: MissionFamily,
  page: number,
  filters: MissionListFilters = {}
): Promise<MissionFamilyPage> => {
  const response = await getMissionsByRegionList({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region },
    query: createMissionListQuery(family, page, filters)
  });

  if (response.error || !response.data) {
    throw new Error(`Failed to load ${family} missions.`);
  }

  const sourceItems = getItems(response.data);
  if (sourceItems === null) {
    throw new TypeError(`Mission catalogue returned invalid ${family} items.`);
  }

  const seen = new Set<number>();
  const items = parseMissionList(response.data, family).filter((mission) => {
    if (seen.has(mission.id)) {
      return false;
    }

    seen.add(mission.id);
    return true;
  });

  return {
    items,
    pagination: parseApiPagination(response.data, page, FAMILY_PAGE_SIZE, sourceItems.length),
    sourceItemCount: sourceItems.length
  };
};

export const parseMissionFamilies = (searchParams: URLSearchParams): MissionFamily[] => {
  const requestedFamilies = new Set(
    searchParams
      .getAll("family")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value): value is MissionFamily => missionFamilies.includes(value as MissionFamily))
  );

  return requestedFamilies.size > 0
    ? missionFamilies.filter((family) => requestedFamilies.has(family))
    : [...missionFamilies];
};

export const parseMissionFamily = (searchParams: URLSearchParams): MissionFamily | null => {
  for (const value of searchParams.getAll("family").flatMap((item) => item.split(","))) {
    const family = value.trim();
    if (missionFamilies.includes(family as MissionFamily)) {
      return family as MissionFamily;
    }
  }

  return null;
};

/** The `character` filter for Character Missions; anything but one positive integer is ignored. */
export const parseMissionCharacterId = (searchParams: URLSearchParams): number | null => {
  const value = searchParams.get("character")?.trim() ?? "";
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const createEmptyMissionListPage = (page: number): MissionListPage => ({
  items: [],
  pagination: {
    page,
    pageSize: PAGE_SIZE,
    hasNext: false,
    total: null,
    totalPages: null
  }
});

export const fetchMissionListPage = async (
  baseUrl: string,
  region: string,
  families: readonly MissionFamily[] = missionFamilies,
  page = 1,
  filters: MissionListFilters = {}
): Promise<MissionListPage> => {
  const selectedFamilies = missionFamilies.filter((family) => families.includes(family));
  const familyPages = await Promise.all(
    selectedFamilies.map((family) => fetchMissionFamilyPage(baseUrl, region, family, page, filters))
  );

  const reportedTotalPages = familyPages.flatMap(({ pagination }) =>
    pagination.totalPages === null ? [] : [pagination.totalPages]
  );
  const totalPages = reportedTotalPages.length > 0 ? Math.max(...reportedTotalPages) : null;
  const sourceItemCount = familyPages.reduce(
    (sum, familyPage) => sum + familyPage.sourceItemCount,
    0
  );

  if (
    selectedFamilies.length > 0 &&
    page > 1 &&
    sourceItemCount === 0 &&
    (totalPages === null || page > totalPages)
  ) {
    throw new Error("Mission catalogue returned a page beyond the selected families.");
  }

  const familyTotals = familyPages.map(({ pagination }) => pagination.total);
  const total =
    familyTotals.length > 0 && familyTotals.every((value): value is number => value !== null)
      ? familyTotals.reduce((sum, value) => sum + value, 0)
      : null;

  if (total !== null && !Number.isSafeInteger(total)) {
    throw new Error("Mission catalogue returned an unsupported total count.");
  }

  return {
    items: familyPages.flatMap(({ items }) => items),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      hasNext: familyPages.some(({ pagination }) => pagination.hasNext),
      total,
      totalPages
    }
  };
};
