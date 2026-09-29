import { toTimestampMs } from "$lib/time/date-time";
import type { SupportedRegion } from "$lib/domain/regions";

export type VirtualLiveStatus = "upcoming" | "ongoing" | "ended";

export const VIRTUAL_LIVE_STATUS_VALUES: readonly VirtualLiveStatus[] = [
  "upcoming",
  "ongoing",
  "ended"
];

export const deriveVirtualLiveStatus = (
  startAt: string | number | null,
  endAt: string | number | null
): VirtualLiveStatus => {
  const now = Date.now();
  const startMs = toTimestampMs(startAt);
  const endMs = toTimestampMs(endAt);

  if (startMs !== null && now < startMs) {
    return "upcoming";
  }

  if (endMs !== null && now > endMs) {
    return "ended";
  }

  return "ongoing";
};

export type VirtualLiveListItem = {
  id: string;
  name: string | null;
  virtualLiveType: string | null;
  assetBundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
  status: VirtualLiveStatus;
};

export type VirtualLiveListPagination = {
  page: number;
  pageSize: number;
  hasNext: boolean;
  total: number | null;
  totalPages: number | null;
};

export type VirtualLiveListPage = {
  items: VirtualLiveListItem[];
  pagination: VirtualLiveListPagination;
};

export type VirtualLiveListSortBy = "id" | "startAt";
export type VirtualLiveListSortOrder = "asc" | "desc";

export type VirtualLiveListQueryState = {
  name: string;
  id: string;
  virtualLiveType: string[];
  spoiler: boolean;
  sortBy: VirtualLiveListSortBy;
  sortOrder: VirtualLiveListSortOrder;
};

export const DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE = 20;
export const DEFAULT_VIRTUAL_LIVE_LIST_QUERY_STATE: VirtualLiveListQueryState = {
  name: "",
  id: "",
  virtualLiveType: [],
  spoiler: false,
  sortBy: "startAt",
  sortOrder: "desc"
};

export type VirtualLiveInformation = {
  virtualLiveId: number | null;
  description: string | null;
  summary: string | null;
};

export type VirtualLiveWaitingRoom = {
  id: number | null;
  virtualLiveId: number | null;
  assetBundleName: string | null;
  lobbyAssetBundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
};

export type VirtualLiveCharacter = {
  id: number | null;
  virtualLiveId: number | null;
  gameCharacterUnitId: number | null;
  subGameCharacter2dId: number | null;
  seq: number | null;
  virtualLivePerformanceType: string | null;
  /**
   * Enriched from the region game-character-unit aggregate. `null` when no
   * matching `gameCharacterUnitId` was found or the enrichment source failed to
   * load. Never inferred from `subGameCharacter2dId`/`character3dId*`.
   */
  gameCharacterId: number | null;
  unit: string | null;
  colorCode: string | null;
};

export type VirtualLiveReward = {
  id: number | null;
  virtualLiveId: number | null;
  resourceBoxId: number | null;
  virtualLiveType: string | null;
  /**
   * Optional expanded resource box. `null` when the source reward carried no
   * `resourceBox` (e.g. legacy rewards). When present, `details` is sorted
   * deterministically by `seq`.
   */
  resourceBox: VirtualLiveRewardResourceBox | null;
};

/**
 * Neutral resource-box shape for an expanded Virtual Live reward. Mirrors the
 * compatible event reward-box model (`EventRewardResourceBoxDetail` +
 * `EventRewardHonor`) but is scoped to Virtual Live data so the two domains
 * stay decoupled. Only confirmed display fields are retained; no item
 * names/links are invented.
 */
export type VirtualLiveRewardResourceBox = {
  id: number | null;
  resourceBoxPurpose: string | null;
  resourceBoxType: string | null;
  details: VirtualLiveRewardResourceBoxDetail[];
};

export type VirtualLiveRewardResourceBoxDetail = {
  resourceType: string | null;
  resourceId: number | null;
  resourceLevel: number | null;
  resourceQuantity: number | null;
  seq: number | null;
  honor: VirtualLiveRewardHonor | null;
  /** Localized name of a gacha ticket, material, skill practice ticket, boost item, or title. */
  resourceName?: string | null;
  /** Gacha tickets only; their icon path uses it. */
  resourceAssetbundleName?: string | null;
  /** Titles only (low, middle, high, highest); it picks the title reward icon. */
  resourceRarity?: string | null;
};

export type VirtualLiveRewardHonor = {
  id: number | null;
  groupId: number | null;
  honorRarity: string | null;
  honorMissionType: string | null;
  honorType: string | null;
  assetBundleName: string | null;
  levels: VirtualLiveRewardHonorLevel[];
  group: VirtualLiveRewardHonorGroup | null;
};

export type VirtualLiveRewardHonorLevel = {
  honorId: number | null;
  level: number | null;
  honorRarity: string | null;
  assetBundleName: string | null;
};

export type VirtualLiveRewardHonorGroup = {
  id: number | null;
  honorType: string | null;
  backgroundAssetBundleName: string | null;
  frameName: string | null;
};

export type VirtualLiveSchedule = {
  id: number | null;
  virtualLiveId: number | null;
  seq: number | null;
  startAt: string | number | null;
  endAt: string | number | null;
  isAfterEvent: boolean | null;
  noticeGroupId: number | null;
};

export type VirtualLiveSetlist = {
  id: number | null;
  virtualLiveId: number | null;
  seq: number | null;
  musicId: number | null;
  musicVocalId: number | null;
  virtualLiveStageId: number | null;
  virtualLiveSetlistType: string | null;
  assetBundleName: string | null;
  character3dId1: number | null;
  character3dId2: number | null;
  character3dId3: number | null;
  character3dId4: number | null;
  character3dId5: number | null;
  character3dId6: number | null;
  music: VirtualLiveSetlistMusicDisplay | null;
};

export type VirtualLiveSetlistMusicDisplay = {
  id: string;
  title: string;
  jacketAssetBundleName: string | null;
  fillerSec: number | null;
  artist: string | null;
  assetRegion: SupportedRegion;
  vocal: {
    id: string;
    vocalType: string | null;
    assetBundleName: string | null;
    characters: { characterId: number; unit: string }[];
  } | null;
};

export type VirtualLiveBasic = {
  id: string;
  name: string | null;
  virtualLiveType: string | null;
  virtualLivePlatform: string | null;
  assetBundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
  rankingAnnounceAt: string | number | null;
  seq: number | null;
  status: VirtualLiveStatus;
};

/**
 * Human-readable display model for a Virtual Live's `virtualLiveGroup`.
 *
 * Derived strictly from confirmed display fields; internal identifiers
 * (`id`, `assetbundleName`, `seq`, `releaseConditionId`) are intentionally
 * excluded. The model is a `type` alias (not an `interface`) so it stays
 * assignable to `Record<string, unknown>` for consumers that render it
 * generically.
 */
export type VirtualLiveGroupDisplay = {
  name: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
};

/**
 * Human-readable display model for a Virtual Live's `screenMvMusicVocal`.
 *
 * `musicId` is preserved (as a number) so the UI can build a `/music/:region/:id`
 * link with a useful fallback. `musicVocalType`/`caption` are shown directly,
 * and `characterIds` aggregates `characters[].characterId`. The music asset
 * bundle is retained only to resolve jacket artwork; other internal
 * identifiers (`id`, `archivePublishedAt`, `releaseConditionId`, `seq`) are
 * excluded.
 */
export type VirtualLiveScreenMvMusicVocalDisplay = {
  musicId: number | null;
  musicVocalType: string | null;
  caption: string | null;
  characterIds: number[];
  /**
   * Human-readable music title fetched from the region music endpoint.
   * `null` when there is no valid `musicId`, the lookup failed, or the
   * response carried no usable title. Optional on the base parse output and
   * always defined once the server enrichment runs; never makes the Virtual
   * Live detail unavailable.
   */
  musicTitle?: string | null;
  /** Asset bundle from the resolved music record, used only for jacket artwork. */
  musicAssetBundleName?: string | null;
};

/**
 * Human-readable display model for a Virtual Live's `pamphlet`.
 *
 * Internal identifiers (`id`, `assetbundleName`, `seq`, `releaseConditionId`)
 * are excluded.
 */
export type VirtualLivePamphletDisplay = {
  name: string | null;
  flavorText: string | null;
};

/**
 * Human-readable display model for a Virtual Live's `ticket`.
 *
 * Internal identifiers (`id`, `assetbundleName`, `seq`, `releaseConditionId`)
 * are excluded.
 */
export type VirtualLiveTicketDisplay = {
  name: string | null;
  flavorText: string | null;
  virtualLiveTicketType: string | null;
};

export type VirtualLiveDetail = VirtualLiveBasic & {
  information: VirtualLiveInformation | null;
  waitingRoom: VirtualLiveWaitingRoom | null;
  characters: VirtualLiveCharacter[];
  rewards: VirtualLiveReward[];
  schedules: VirtualLiveSchedule[];
  setlists: VirtualLiveSetlist[];
  virtualLiveGroup: VirtualLiveGroupDisplay | null;
  screenMvMusicVocal: VirtualLiveScreenMvMusicVocalDisplay | null;
  pamphlet: VirtualLivePamphletDisplay | null;
  ticket: VirtualLiveTicketDisplay | null;
};
