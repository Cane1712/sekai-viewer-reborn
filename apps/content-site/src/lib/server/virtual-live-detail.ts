import {
  deriveVirtualLiveStatus,
  type VirtualLiveBasic,
  type VirtualLiveCharacter,
  type VirtualLiveDetail,
  type VirtualLiveGroupDisplay,
  type VirtualLiveInformation,
  type VirtualLivePamphletDisplay,
  type VirtualLiveReward,
  type VirtualLiveRewardHonor,
  type VirtualLiveRewardHonorGroup,
  type VirtualLiveRewardHonorLevel,
  type VirtualLiveRewardResourceBox,
  type VirtualLiveRewardResourceBoxDetail,
  type VirtualLiveSchedule,
  type VirtualLiveScreenMvMusicVocalDisplay,
  type VirtualLiveSetlist,
  type VirtualLiveTicketDisplay,
  type VirtualLiveTotalCheerPointReward,
  type VirtualLiveTotalCheerPointSurplusReward,
  type VirtualLiveVirtualItemOverrideCost,
  type VirtualLiveWaitingRoom
} from "$lib/domain/virtual-live";

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

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

const getArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

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

const parseBasic = (source: Record<string, unknown>): VirtualLiveBasic | null => {
  const id = pickFirstStringLike(source, ["id", "virtualLiveId"]);
  const name = pickFirstString(source, ["name", "virtualLiveName"]);

  if (!id || !name) {
    return null;
  }

  const startAt = pickFirstDateValue(source, ["startAt", "start_at", "startDate"]);
  const endAt = pickFirstDateValue(source, ["endAt", "end_at", "endDate"]);

  return {
    id,
    name,
    virtualLiveType: pickFirstString(source, ["virtualLiveType", "virtual_live_type"]),
    virtualLivePlatform: pickFirstString(source, ["virtualLivePlatform", "virtual_live_platform"]),
    assetBundleName: pickFirstString(source, ["assetbundleName", "assetBundleName"]),
    startAt,
    endAt,
    rankingAnnounceAt: pickFirstDateValue(source, ["rankingAnnounceAt", "ranking_announce_at"]),
    seq: getNumber(source["seq"]),
    status: deriveVirtualLiveStatus(startAt, endAt)
  };
};

const parseInformation = (source: Record<string, unknown>): VirtualLiveInformation | null => {
  const node = getObject(source["virtualLiveInformation"]);
  if (!node) {
    return null;
  }

  const virtualLiveId = getNumber(node["virtualLiveId"]) ?? getNumber(source["id"]);

  return {
    virtualLiveId,
    description: getString(node["description"]),
    summary: getString(node["summary"])
  };
};

const parseWaitingRoom = (source: Record<string, unknown>): VirtualLiveWaitingRoom | null => {
  const node = getObject(source["virtualLiveWaitingRoom"]);
  const effective = node ?? source;

  const id = getNumber(effective["virtualLiveWaitingRoomId"]) ?? getNumber(effective["id"]);
  const virtualLiveId = getNumber(effective["virtualLiveId"]);

  if (id === null && virtualLiveId === null) {
    return null;
  }

  return {
    id,
    virtualLiveId,
    assetBundleName: getString(effective["assetbundleName"] ?? effective["assetBundleName"]),
    lobbyAssetBundleName: getString(
      effective["lobbyAssetbundleName"] ?? effective["lobbyAssetBundleName"]
    ),
    startAt: pickFirstDateValue(effective, ["startAt", "start_at", "startDate"]),
    endAt: pickFirstDateValue(effective, ["endAt", "end_at", "endDate"])
  };
};

const parseCharacter = (value: unknown): VirtualLiveCharacter | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    id: getNumber(node["id"]),
    virtualLiveId: getNumber(node["virtualLiveId"]),
    gameCharacterUnitId: getNumber(node["gameCharacterUnitId"]),
    subGameCharacter2dId: getNumber(node["subGameCharacter2dId"]),
    seq: getNumber(node["seq"]),
    virtualLivePerformanceType: getString(node["virtualLivePerformanceType"]),
    gameCharacterId: null,
    unit: null,
    colorCode: null
  };
};

const parseRewardHonorLevel = (value: unknown): VirtualLiveRewardHonorLevel | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    honorId: getNumber(node["honorId"]),
    level: getNumber(node["level"]),
    honorRarity: getString(node["honorRarity"]),
    assetBundleName: getString(node["assetbundleName"] ?? node["assetBundleName"])
  };
};

const parseRewardHonorGroup = (value: unknown): VirtualLiveRewardHonorGroup | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    id: getNumber(node["id"]),
    honorType: getString(node["honorType"]),
    backgroundAssetBundleName: getString(
      node["backgroundAssetbundleName"] ?? node["backgroundAssetBundleName"]
    ),
    frameName: getString(node["frameName"])
  };
};

const parseRewardHonor = (value: unknown): VirtualLiveRewardHonor | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    id: getNumber(node["id"]),
    groupId: getNumber(node["groupId"]),
    honorRarity: getString(node["honorRarity"]),
    honorMissionType: getString(node["honorMissionType"]),
    honorType: getString(node["honorType"]),
    assetBundleName: getString(node["assetbundleName"] ?? node["assetBundleName"]),
    levels: getArray(node["levels"]).flatMap((item) => {
      const level = parseRewardHonorLevel(item);
      return level ? [level] : [];
    }),
    group: parseRewardHonorGroup(node["group"])
  };
};

const parseRewardResourceBoxDetail = (
  value: unknown
): VirtualLiveRewardResourceBoxDetail | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    resourceType: getString(node["resourceType"]),
    resourceId: getNumber(node["resourceId"]),
    resourceLevel: getNumber(node["resourceLevel"]),
    resourceQuantity: getNumber(node["resourceQuantity"]),
    seq: getNumber(node["seq"]),
    honor: parseRewardHonor(node["honor"]),
    resourceName: getString(node["resourceName"]),
    resourceAssetbundleName: getString(node["resourceAssetbundleName"]),
    resourceRarity: getString(node["resourceRarity"])
  };
};

const parseRewardResourceBox = (value: unknown): VirtualLiveRewardResourceBox | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  const details = getArray(node["details"])
    .flatMap((item) => {
      const detail = parseRewardResourceBoxDetail(item);
      return detail ? [detail] : [];
    })
    .sort((a, b) => {
      const aSeq = a.seq ?? Number.POSITIVE_INFINITY;
      const bSeq = b.seq ?? Number.POSITIVE_INFINITY;
      return aSeq - bSeq;
    });

  return {
    id: getNumber(node["id"]),
    resourceBoxPurpose: getString(node["resourceBoxPurpose"]),
    resourceBoxType: getString(node["resourceBoxType"]),
    details
  };
};

const parseReward = (value: unknown): VirtualLiveReward | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    id: getNumber(node["id"]),
    virtualLiveId: getNumber(node["virtualLiveId"]),
    resourceBoxId: getNumber(node["resourceBoxId"]),
    virtualLiveType: getString(node["virtualLiveType"]),
    resourceBox: parseRewardResourceBox(node["resourceBox"])
  };
};

const parseTotalCheerPointReward = (value: unknown): VirtualLiveTotalCheerPointReward | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    id: getNumber(node["id"]),
    threshold: getNumber(node["threshold"]),
    resourceBox: parseRewardResourceBox(node["resourceBox"])
  };
};

const parseTotalCheerPointSurplusReward = (
  value: unknown
): VirtualLiveTotalCheerPointSurplusReward | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    basePoint: getNumber(node["basePoint"]),
    resourceBox: parseRewardResourceBox(node["resourceBox"])
  };
};

const parseVirtualItemOverrideCost = (
  value: unknown
): VirtualLiveVirtualItemOverrideCost | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    costResourceType: getString(node["costResourceType"]),
    costResourceId: getNumber(node["costResourceId"]),
    costResourceName: getString(node["costResourceName"])
  };
};

const parseSchedule = (value: unknown): VirtualLiveSchedule | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    id: getNumber(node["id"]),
    virtualLiveId: getNumber(node["virtualLiveId"]),
    seq: getNumber(node["seq"]),
    startAt: pickFirstDateValue(node, ["startAt", "start_at", "startDate"]),
    endAt: pickFirstDateValue(node, ["endAt", "end_at", "endDate"]),
    isAfterEvent: getBoolean(node["isAfterEvent"]),
    noticeGroupId: getNumber(node["noticeGroupId"])
  };
};

const parseSetlist = (value: unknown): VirtualLiveSetlist | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    id: getNumber(node["id"]),
    virtualLiveId: getNumber(node["virtualLiveId"]),
    seq: getNumber(node["seq"]),
    musicId: getNumber(node["musicId"]),
    musicVocalId: getNumber(node["musicVocalId"]),
    virtualLiveStageId: getNumber(node["virtualLiveStageId"]),
    virtualLiveSetlistType: getString(node["virtualLiveSetlistType"]),
    assetBundleName: getString(node["assetbundleName"] ?? node["assetBundleName"]),
    character3dId1: getNumber(node["character3dId1"]),
    character3dId2: getNumber(node["character3dId2"]),
    character3dId3: getNumber(node["character3dId3"]),
    character3dId4: getNumber(node["character3dId4"]),
    character3dId5: getNumber(node["character3dId5"]),
    character3dId6: getNumber(node["character3dId6"]),
    music: null
  };
};

export const parseVirtualLiveSetlistItems = (items: unknown): VirtualLiveSetlist[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map(parseSetlist)
    .filter((setlist): setlist is VirtualLiveSetlist => setlist !== null);
};

const parseVirtualLiveGroup = (value: unknown): VirtualLiveGroupDisplay | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    name: pickFirstString(node, ["name", "virtualLiveGroupName"]),
    startAt: pickFirstDateValue(node, ["startAt", "start_at", "startDate"]),
    endAt: pickFirstDateValue(node, ["endAt", "end_at", "endDate"])
  };
};

const parseScreenMvMusicVocal = (value: unknown): VirtualLiveScreenMvMusicVocalDisplay | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  const characterIds = getArray(node["characters"])
    .map((entry) =>
      getNumber(getObject(entry)?.["characterId"] ?? getObject(entry)?.["character_id"])
    )
    .filter((id): id is number => id !== null);

  return {
    musicId: getNumber(node["musicId"]),
    musicVocalType: pickFirstString(node, ["musicVocalType", "music_vocal_type"]),
    caption: getString(node["caption"]),
    characterIds
  };
};

const parsePamphlet = (value: unknown): VirtualLivePamphletDisplay | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    name: getString(node["name"]),
    flavorText: getString(node["flavorText"] ?? node["flavor_text"])
  };
};

const parseTicket = (value: unknown): VirtualLiveTicketDisplay | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    name: getString(node["name"]),
    flavorText: getString(node["flavorText"] ?? node["flavor_text"]),
    virtualLiveTicketType: pickFirstString(node, [
      "virtualLiveTicketType",
      "virtual_live_ticket_type",
      "ticketType",
      "ticket_type"
    ])
  };
};

export const parseVirtualLiveDetail = (payload: unknown): VirtualLiveDetail | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const basic = parseBasic(root);
  if (!basic) {
    return null;
  }

  return {
    ...basic,
    information: parseInformation(root),
    waitingRoom: parseWaitingRoom(root),
    characters: getArray(root["virtualLiveCharacters"]).flatMap((item) => {
      const character = parseCharacter(item);
      return character ? [character] : [];
    }),
    rewards: getArray(root["virtualLiveRewards"]).flatMap((item) => {
      const reward = parseReward(item);
      return reward ? [reward] : [];
    }),
    totalCheerPointRewards: getArray(root["virtualLiveTotalCheerPointRewards"])
      .flatMap((item) => {
        const reward = parseTotalCheerPointReward(item);
        return reward ? [reward] : [];
      })
      .sort(
        (a, b) =>
          (a.threshold ?? Number.POSITIVE_INFINITY) - (b.threshold ?? Number.POSITIVE_INFINITY)
      ),
    totalCheerPointSurplusReward: parseTotalCheerPointSurplusReward(
      root["virtualLiveTotalCheerPointSurplusReward"]
    ),
    virtualItemOverrideCost: parseVirtualItemOverrideCost(
      root["virtualLiveVirtualItemOverrideCost"]
    ),
    groupAssetBundleName: getString(
      getObject(root["virtualLiveGroup"])?.["assetbundleName"] ??
        getObject(root["virtualLiveGroup"])?.["assetBundleName"]
    ),
    schedules: getArray(root["virtualLiveSchedules"]).flatMap((item) => {
      const schedule = parseSchedule(item);
      return schedule ? [schedule] : [];
    }),
    setlists: parseVirtualLiveSetlistItems(root["virtualLiveSetlists"]),
    virtualLiveGroup: parseVirtualLiveGroup(root["virtualLiveGroup"]),
    screenMvMusicVocal: parseScreenMvMusicVocal(root["screenMvMusicVocal"]),
    pamphlet: parsePamphlet(root["pamphlet"]),
    ticket: parseTicket(root["ticket"])
  };
};

/**
 * Coerce an unknown value to a finite number. Unlike the module `getNumber`
 * (which only accepts numeric `number` inputs), this also accepts numeric
 * strings (e.g. `"13"`) so both supported aggregate representations resolve.
 */
const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseCharacterUnitItems = (payload: unknown): unknown[] => {
  const root = getObject(payload);
  if (Array.isArray(root?.["items"])) {
    return root["items"] as unknown[];
  }

  const data = getObject(root?.["data"]);
  if (Array.isArray(data?.["items"])) {
    return data["items"] as unknown[];
  }

  return [];
};

export const buildCharacterUnitEnrichmentMap = (
  aggregate: unknown,
  loadFailed: boolean
): Map<
  number,
  { gameCharacterId: number; unit: string | null; colorCode: string | null }
> | null => {
  if (loadFailed || aggregate === null || aggregate === undefined) return null;
  const items = parseCharacterUnitItems(aggregate);
  if (items.length === 0) return null;
  const map = new Map<
    number,
    { gameCharacterId: number; unit: string | null; colorCode: string | null }
  >();
  for (const raw of items) {
    const node = getObject(raw);
    if (!node) continue;
    const recordId = toNumber(node["id"]);
    const gameCharacterId = toNumber(node["gameCharacterId"]);
    if (recordId === null || gameCharacterId === null) continue;
    map.set(recordId, {
      gameCharacterId,
      unit: getString(node["unit"]),
      colorCode: getString(node["colorCode"])
    });
  }
  return map.size > 0 ? map : null;
};

/**
 * Enrich a parsed `VirtualLiveDetail`'s characters using a prebuilt unit-map.
 *
 * Character entries keep their existing base fields unchanged; the nullable
 * `gameCharacterId`/`unit`/`colorCode` fields are filled only when the
 * character's `gameCharacterUnitId` has a matching record in the map.
 * Characters without a match retain `null` enriched fields.
 *
 * Safe to call with `enrichmentMap = null` (no enrichment applied).
 */
export const enrichVirtualLiveCharacters = (
  detail: VirtualLiveDetail,
  enrichmentMap: Map<
    number,
    { gameCharacterId: number; unit: string | null; colorCode: string | null }
  > | null
): VirtualLiveDetail => {
  if (!enrichmentMap || enrichmentMap.size === 0) {
    return detail;
  }

  const characters: VirtualLiveCharacter[] = detail.characters.map((character) => {
    if (character.gameCharacterUnitId === null) {
      return character;
    }

    const match = enrichmentMap.get(character.gameCharacterUnitId);
    if (!match) {
      return character;
    }

    return {
      ...character,
      gameCharacterId: match.gameCharacterId,
      unit: match.unit,
      colorCode: match.colorCode
    };
  });

  return {
    ...detail,
    characters
  };
};

export type { VirtualLiveDetail };
