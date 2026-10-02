import { describe, expect, it, vi } from "vitest";
import {
  getMysekaiMaterialRarity,
  getMysekaiMaterialTab,
  loadMysekaiDetail,
  parseMysekaiFixtureListQuery,
  parseMysekaiSoundtrackListQuery,
  toMysekaiFixtureSearchParams,
  toMysekaiSoundtrackSearchParams
} from "./mysekai";

describe("MySekai fixture list query", () => {
  it("round-trips a full query through the page URL", () => {
    const query = parseMysekaiFixtureListQuery(
      new URLSearchParams(
        "name=%20table%20&main_genre_id=2&sub_genre_id=3&series=61&unit=5&character=10&sort_order=desc"
      )
    );

    expect(query).toEqual({
      name: "table",
      mainGenreId: 2,
      subGenreId: 3,
      seriesTagId: 61,
      unitTagId: 5,
      characterTagId: 10,
      sortOrder: "desc"
    });
    expect(toMysekaiFixtureSearchParams(query, 2).toString()).toBe(
      "page=2&name=table&main_genre_id=2&sub_genre_id=3&series=61&unit=5&character=10&sort_order=desc"
    );
  });

  it("drops invalid IDs, a sub-genre without its main genre, and defaults", () => {
    const query = parseMysekaiFixtureListQuery(
      new URLSearchParams("sub_genre_id=3&series=-1&unit=x&character=0&sort_order=up")
    );

    expect(query).toMatchObject({
      mainGenreId: null,
      subGenreId: null,
      seriesTagId: null,
      unitTagId: null,
      characterTagId: null,
      sortOrder: "asc"
    });
    expect(toMysekaiFixtureSearchParams(query).toString()).toBe("");
  });
});

describe("MySekai soundtrack list query", () => {
  it("round-trips the name and category through the page URL", () => {
    const query = parseMysekaiSoundtrackListQuery(new URLSearchParams("category=2&name=%20bgm"));
    expect(query).toEqual({ name: "bgm", categoryId: 2 });
    expect(toMysekaiSoundtrackSearchParams(query, 3).toString()).toBe("page=3&name=bgm&category=2");
    expect(
      toMysekaiSoundtrackSearchParams(
        parseMysekaiSoundtrackListQuery(new URLSearchParams("category=x"))
      ).toString()
    ).toBe("");
  });
});

describe("MySekai materials", () => {
  it.each([
    ["wood", "wood"],
    ["mineral", "mineral"],
    ["plant", "plant"],
    ["junk", "other"],
    ["game_character", "other"],
    [null, "other"]
  ] as const)("puts %s materials in the %s tab", (materialType, tab) => {
    expect(getMysekaiMaterialTab(materialType)).toBe(tab);
  });

  it("reads the rarity number", () => {
    expect(getMysekaiMaterialRarity("rarity_4")).toBe(4);
    expect(getMysekaiMaterialRarity("legendary")).toBeNull();
    expect(getMysekaiMaterialRarity(undefined)).toBeNull();
  });
});

describe("loadMysekaiDetail", () => {
  it("resolves found, missing, failed, and invalid IDs without rejecting", async () => {
    const fetchById = vi.fn(async (id: number) => {
      if (id === 1) return { id };
      if (id === 2) return null;
      throw new Error("offline");
    });

    await expect(loadMysekaiDetail("1", fetchById)).resolves.toEqual({
      status: "ready",
      item: { id: 1 }
    });
    await expect(loadMysekaiDetail("2", fetchById)).resolves.toEqual({
      status: "notFound",
      item: null
    });
    await expect(loadMysekaiDetail("3", fetchById)).resolves.toEqual({
      status: "error",
      item: null
    });
    await expect(loadMysekaiDetail("abc", fetchById)).resolves.toEqual({
      status: "notFound",
      item: null
    });
    expect(fetchById).toHaveBeenCalledTimes(3);
  });
});
