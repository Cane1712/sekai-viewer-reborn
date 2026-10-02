import type { SharedStampListItemResponse } from "@platform/sekai-master-api-sdk";

export type StampItem = SharedStampListItemResponse;

/** The stamp categories the master API derives from a stamp's type and characters. */
export const stampCategories = ["character", "bond", "text", "other"] as const;
export type StampCategory = (typeof stampCategories)[number];

/**
 * Where a stamp comes from, as the master API reads it from the resource box that rewards it.
 * Kizuna stamps are the Bond category, so they have no source tab of their own.
 */
export const stampSources = ["shop", "live", "rank", "exchange", "crystal", "other"] as const;
export type StampSource = (typeof stampSources)[number];

export type StampListQuery = {
  name: string;
  category: StampCategory | null;
  source: StampSource | null;
  /** The game character every listed stamp shows. */
  characterId: number | null;
  /** A second character the stamp must also show; only meaningful with `characterId`. */
  secondCharacterId: number | null;
  sortOrder: "asc" | "desc";
};

const parsePositiveId = (value: string | null): number | null => {
  const id = Number(value);
  return value !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const parseStampListQuery = (searchParams: URLSearchParams): StampListQuery => {
  const category = searchParams.get("category");
  const source = searchParams.get("source");
  const characterId = parsePositiveId(searchParams.get("character"));
  const secondCharacterId =
    characterId === null ? null : parsePositiveId(searchParams.get("second"));
  return {
    name: searchParams.get("name")?.trim() ?? "",
    category: stampCategories.find((value) => value === category) ?? null,
    source: stampSources.find((value) => value === source) ?? null,
    characterId,
    // A stamp cannot show the same character twice.
    secondCharacterId: secondCharacterId === characterId ? null : secondCharacterId,
    sortOrder: searchParams.get("sort_order") === "desc" ? "desc" : "asc"
  };
};

/** The page URL's query for a stamp list query, without defaults. */
export const toStampSearchParams = (query: StampListQuery, page?: number): URLSearchParams => {
  const params = new URLSearchParams();
  if (page !== undefined) params.set("page", String(page));
  if (query.name) params.set("name", query.name);
  if (query.category !== null) params.set("category", query.category);
  if (query.source !== null) params.set("source", query.source);
  if (query.characterId !== null) params.set("character", String(query.characterId));
  if (query.characterId !== null && query.secondCharacterId !== null) {
    params.set("second", String(query.secondCharacterId));
  }
  if (query.sortOrder === "desc") params.set("sort_order", "desc");
  return params;
};

/** The stamp's characters that the list knows, in the stamp's slot order. */
export const getStampCharacters = <T extends { id: number }>(
  characterIds: readonly number[],
  characters: readonly T[]
): T[] =>
  characterIds.flatMap((id) => {
    const character = characters.find((candidate) => candidate.id === id);
    return character ? [character] : [];
  });

/**
 * The stamp's own text. Names read "[スタンプ]咲希：おつかれさま！" or "[テキストスタンプ]一歌！": the
 * bracketed kind and the "character：" prefix are dropped.
 */
export const getStampDisplayName = (name: string): string => {
  const text = name.replace(/^\[[^\]]*\]/, "").replace(/^[^：]*：/, "");
  return text.trim() || name;
};
