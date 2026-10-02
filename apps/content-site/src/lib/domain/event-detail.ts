export type BannerGameCharacter = {
  id: number;
  firstName: string | null;
  givenName: string | null;
  unit: string | null;
  colorCode: string | null;
};

export type EventVirtualLive = {
  id: string | null;
  name: string | null;
  virtualLiveType: string | null;
  assetBundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
};

export type EventDeckBonus = {
  gameCharacterId: number | null;
  gameCharacterUnitId: number | null;
  unit: string | null;
  firstName: string | null;
  givenName: string | null;
  colorCode: string | null;
  cardAttr: string | null;
  bonusRate: number | null;
};

export type EventRarityBonusRate = {
  cardRarityType: string | null;
  masterRank: number | null;
  bonusRate: number | null;
};

export type EventCardBonusLimit = {
  memberCountLimit: number | null;
};

export type EventHonorBonusGroup = {
  name: string | null;
  honorType: string | null;
  backgroundAssetBundleName: string | null;
};

export type EventHonorBonusHonor = {
  id: number;
  name: string | null;
  assetBundleName: string | null;
  group: EventHonorBonusGroup | null;
};

export type EventHonorBonus = {
  honorId: number;
  bonusRate: number | null;
  honor: EventHonorBonusHonor | null;
};

export type EventBonuses = {
  deckBonuses: EventDeckBonus[];
  rarityBonusRates: EventRarityBonusRate[];
  cardBonusLimits: EventCardBonusLimit[];
  honorBonusCount: number;
  honorBonuses?: EventHonorBonus[];
  mySekaiFixtureBonusLimitCount: number;
};

export type EventFeaturedCard = {
  cardId: string | null;
  title: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
  initialSpecialTrainingStatus: string | null;
  bonusRate: number | null;
  leaderBonusRate: number | null;
};

export type EventMusic = {
  musicId: string | null;
  title: string | null;
  assetBundleName: string | null;
  seq: number | null;
};

export type EventRewardResourceBoxDetail = {
  resourceType: string | null;
  resourceId: string | null;
  resourceLevel: number | null;
  resourceQuantity: number | null;
  seq: number | null;
  honor: EventRewardHonor | null;
  /** Localized name of a gacha ticket, material, skill practice ticket, boost item, or title. */
  resourceName?: string | null;
  /** Gacha tickets only; their icon path uses it. */
  resourceAssetbundleName?: string | null;
  /** Titles only (low, middle, high, highest); it picks the title reward icon. */
  resourceRarity?: string | null;
};

export type EventRewardHonorLevel = {
  honorId: string | null;
  level: number | null;
  honorRarity: string | null;
  assetBundleName: string | null;
};

export type EventRewardHonorGroup = {
  id: string | null;
  honorType: string | null;
  backgroundAssetBundleName: string | null;
  frameName: string | null;
};

export type EventRewardHonor = {
  id: string | null;
  groupId: string | null;
  honorRarity: string | null;
  honorMissionType: string | null;
  honorType: string | null;
  assetBundleName: string | null;
  levels: EventRewardHonorLevel[];
  group: EventRewardHonorGroup | null;
};

export type EventRankingReward = {
  id: string | null;
  resourceBoxId: string | null;
  conditionValue: number | null;
  rewardConditionType: string | null;
  seq: number | null;
  resourceBoxPurpose: string | null;
  resourceBoxDetails: EventRewardResourceBoxDetail[];
};

export type EventRankingRewardRange = {
  fromRank: number | null;
  toRank: number | null;
  isToRankBorder: boolean | null;
  rewardCount: number;
  rewards: EventRankingReward[];
};

export type EventRelatedData = {
  bonuses: EventBonuses | null;
  honorBonusesLoadFailed: boolean;
  cards: EventFeaturedCard[];
  musics: EventMusic[];
  rewardRanges: EventRankingRewardRange[];
  rewardRangesHasMore: boolean | null;
};

export type EventDetail = {
  id: string;
  title: string;
  unit: string | null;
  unitName: string | null;
  eventType: string | null;
  eventPointIcon: string | null;
  bgmAssetbundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
  assetBundleName: string | null;
  bannerGameCharacter: BannerGameCharacter | null;
  virtualLive: EventVirtualLive | null;
};
