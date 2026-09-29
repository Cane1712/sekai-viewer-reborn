export const missionFamilies = ["storyMissions", "characterMissionV2s", "normalMissions"] as const;

export type MissionFamily = (typeof missionFamilies)[number];

export type MissionResourceBoxDetail = {
  resourceBoxId: number | null;
  resourceBoxPurpose: string | null;
  resourceId: number | null;
  resourceLevel: number | null;
  resourceQuantity: number | null;
  resourceType: string | null;
  seq: number | null;
  /** Localized name of a gacha ticket, material, skill practice ticket, boost item, or title. */
  resourceName?: string | null;
  /** Gacha tickets only; their icon path uses it. */
  resourceAssetbundleName?: string | null;
  /** Titles only (low, middle, high, highest); it picks the title reward icon. */
  resourceRarity?: string | null;
};

export type MissionResourceBox = {
  id: number | null;
  resourceBoxPurpose: string | null;
  resourceBoxType: string | null;
  details: MissionResourceBoxDetail[];
};

export type MissionReward = {
  id: number | null;
  missionId: number | null;
  missionType: string | null;
  resourceBox: MissionResourceBox | null;
  resourceBoxId: number | null;
  resourceBoxIds: number[];
  resourceBoxPurpose: string | null;
  resourceId: number | null;
  resourceLevel: number | null;
  resourceQuantity: number | null;
  resourceType: string | null;
  seq: number | null;
  status: string | null;
};

export type MissionParameterGroupLevel = {
  exp: number | null;
  quantity: number | null;
  requirement: number | null;
  reward?: {
    resourceQuantity: number | null;
    resourceType: string | null;
  } | null;
  seq: number | null;
};

export type MissionParameterGroup = {
  id: number | null;
  levels: MissionParameterGroupLevel[];
  lastLevel?: MissionParameterGroupLevel | null;
  totalLevels?: number | null;
};

/** A character offered by the Character Missions picker. */
export type MissionCharacterOption = {
  id: number;
  name: string;
  unit: string | null;
  unitName: string | null;
};

export type CharacterRankReference = {
  characterRank: number | null;
  /** Largest of the rank's power bonus rates, in percent. */
  powerBonusRate: number | null;
  /** Cumulative character rank EXP needed to reach this rank. */
  totalExp?: number | null;
  rewards: MissionResourceBox[];
};

export type Mission = {
  id: number;
  family: MissionFamily;
  characterId: number | null;
  characterMissionType: string | null;
  eventId: number | null;
  isAchievementMission: boolean | null;
  normalMissionType: string | null;
  parameterGroup: MissionParameterGroup | null;
  parameterGroupId: number | null;
  progressSentence: string | null;
  requirement: number | null;
  resourceBoxId: number | null;
  rewards: MissionReward[];
  sentence: string | null;
  seq: number | null;
  storyMissionType: string | null;
};
