import { describe, expect, it } from "vitest";
import {
  getStampCharacters,
  getStampDisplayName,
  parseStampListQuery,
  toStampSearchParams
} from "./stamp";

const parse = (query: string) => parseStampListQuery(new URLSearchParams(query));

describe("stamp list query", () => {
  it("defaults to every stamp in ascending ID order", () => {
    expect(parse("")).toEqual({
      name: "",
      category: null,
      characterId: null,
      secondCharacterId: null,
      sortOrder: "asc"
    });
  });

  it("reads the name, category, characters, and order", () => {
    expect(parse("name=%20hello%20&category=bond&character=1&second=2&sort_order=desc")).toEqual({
      name: "hello",
      category: "bond",
      characterId: 1,
      secondCharacterId: 2,
      sortOrder: "desc"
    });
  });

  it("ignores an unknown category and malformed IDs", () => {
    expect(parse("category=bonds&character=one&second=2")).toMatchObject({
      category: null,
      characterId: null,
      // A second character only narrows a first one.
      secondCharacterId: null
    });
    expect(parse("character=0")).toMatchObject({ characterId: null });
    expect(parse("character=-3")).toMatchObject({ characterId: null });
  });

  it("drops a second character equal to the first", () => {
    expect(parse("character=4&second=4")).toMatchObject({
      characterId: 4,
      secondCharacterId: null
    });
  });

  it("writes only what differs from the defaults", () => {
    expect(toStampSearchParams(parse("")).toString()).toBe("");
    expect(
      toStampSearchParams(
        parse("name=a&category=text&character=1&second=2&sort_order=desc")
      ).toString()
    ).toBe("name=a&category=text&character=1&second=2&sort_order=desc");
    expect(toStampSearchParams(parse("category=character"), 3).toString()).toBe(
      "page=3&category=character"
    );
  });
});

describe("getStampDisplayName", () => {
  it("drops the bracketed kind and the character prefix", () => {
    expect(getStampDisplayName("[スタンプ]咲希：おつかれさま！")).toBe("おつかれさま！");
    expect(getStampDisplayName("[スタンプ]一歌と咲希：ソフトクリームの雲だよ")).toBe(
      "ソフトクリームの雲だよ"
    );
    expect(getStampDisplayName("[テキストスタンプ]一歌！")).toBe("一歌！");
    expect(getStampDisplayName("[スタンプ]Happy Halloween")).toBe("Happy Halloween");
  });

  it("keeps the whole name when nothing is left", () => {
    expect(getStampDisplayName("[スタンプ]")).toBe("[スタンプ]");
    expect(getStampDisplayName("plain")).toBe("plain");
  });
});

describe("getStampCharacters", () => {
  const characters = [
    { id: 1, name: "Ichika" },
    { id: 2, name: "Saki" },
    { id: 5, name: "Minori" }
  ];

  it("returns the stamp's characters in the stamp's slot order", () => {
    expect(getStampCharacters([5, 1], characters)).toEqual([characters[2], characters[0]]);
  });

  it("leaves out characters the list does not know, and handles an empty list", () => {
    expect(getStampCharacters([9, 2], characters)).toEqual([characters[1]]);
    expect(getStampCharacters([1], [])).toEqual([]);
    expect(getStampCharacters([], characters)).toEqual([]);
  });
});
