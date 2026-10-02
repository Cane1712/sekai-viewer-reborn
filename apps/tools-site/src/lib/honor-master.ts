import type {
  BondsHonor,
  BondsHonorUnit,
  BondsHonorWord,
  Honor,
  HonorGroupMetadata,
  HonorLevel
} from "@platform/ui-shell/honor-degree-adapter";

/** Parsers for honor master data shared by the tracker's reward and player titles. */
export const asObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
export const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
export const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export const asPositiveInteger = (value: unknown): number | null => {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
export const isPresent = <T>(value: T | null): value is T => value !== null;

const parseHonorGroup = (value: unknown): HonorGroupMetadata | null => {
  const group = asObject(value);
  if (!group) return null;
  return {
    id: asPositiveInteger(group.id),
    name: asString(group.name),
    honorType: asString(group.honorType),
    backgroundAssetBundleName: asString(
      group.backgroundAssetbundleName ?? group.backgroundAssetBundleName
    ),
    frameName: asString(group.frameName)
  };
};

const parseHonorLevel = (value: unknown): HonorLevel | null => {
  const level = asObject(value);
  if (!level) return null;
  return {
    assetBundleName: asString(level.assetbundleName ?? level.assetBundleName),
    bonus: asNumber(level.bonus),
    description: asString(level.description),
    honorId: asPositiveInteger(level.honorId),
    honorRarity: asString(level.honorRarity),
    level: asNumber(level.level)
  };
};

/** Mirrors content-site's honor parser for the `/honors/{region}/{id}` response. */
export const parseHonor = (value: unknown): Honor | null => {
  const honor = asObject(value);
  const id = asPositiveInteger(honor?.id);
  if (!honor || id === null) return null;
  const group = parseHonorGroup(honor.group);
  return {
    id,
    assetBundleName: asString(honor.assetbundleName ?? honor.assetBundleName),
    group,
    groupId: asPositiveInteger(honor.groupId) ?? group?.id ?? null,
    honorMissionType: asString(honor.honorMissionType),
    honorRarity: asString(honor.honorRarity),
    honorType: asString(honor.honorType),
    honorTypeId: asPositiveInteger(honor.honorTypeId),
    levels: asArray(honor.levels).map(parseHonorLevel).filter(isPresent),
    name: asString(honor.name),
    seq: asNumber(honor.seq)
  };
};

const parseBondsHonorUnit = (value: unknown): BondsHonorUnit | null => {
  const unit = asObject(value);
  const id = asPositiveInteger(unit?.id);
  if (!unit || id === null) return null;
  return {
    id,
    gameCharacterId: asPositiveInteger(unit.gameCharacterId),
    unit: asString(unit.unit),
    colorCode: asString(unit.colorCode)
  };
};

const parseBondsHonorWord = (value: unknown): BondsHonorWord | null => {
  const word = asObject(value);
  const id = asPositiveInteger(word?.id);
  if (!word || id === null) return null;
  return {
    id,
    seq: asNumber(word.seq),
    assetBundleName: asString(word.assetbundleName ?? word.assetBundleName),
    name: asString(word.name),
    description: asString(word.description)
  };
};

/** Mirrors content-site's Bonds honor parser for the `/bondsHonors/{region}/{id}` response. */
export const parseBondsHonor = (value: unknown): BondsHonor | null => {
  const honor = asObject(value);
  const id = asPositiveInteger(honor?.id);
  const bondsGroupId = asPositiveInteger(honor?.bondsGroupId);
  if (!honor || id === null || bondsGroupId === null) return null;
  return {
    id,
    bondsGroupId,
    name: asString(honor.name),
    honorRarity: asString(honor.honorRarity),
    levels: asArray(honor.levels).flatMap((item) => {
      const level = asObject(item);
      return level
        ? [{ level: asNumber(level.level), description: asString(level.description) }]
        : [];
    }),
    words: asArray(honor.words)
      .map(parseBondsHonorWord)
      .filter(isPresent)
      .sort((left, right) => (left.seq ?? 0) - (right.seq ?? 0) || left.id - right.id),
    units: [parseBondsHonorUnit(honor.characterUnit1), parseBondsHonorUnit(honor.characterUnit2)],
    configurableUnitVirtualSinger: honor.configurableUnitVirtualSinger === true
  };
};
