import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  getMysekaiFixturesByRegionById: vi.fn(),
  getMysekaiFixturesByRegionFilters: vi.fn(),
  getMysekaiFixturesByRegionList: vi.fn(),
  getMysekaiMaterialsByRegionById: vi.fn(),
  getMysekaiMaterialsByRegionList: vi.fn(),
  getMysekaiMusicRecordsByRegionFilters: vi.fn(),
  getMysekaiMusicRecordsByRegionList: vi.fn(),
  getMysekaiShopsByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => sdk);

import { parseMysekaiFixtureListQuery } from "$lib/domain/mysekai";
import {
  createMysekaiFixtureListRequestQuery,
  createMysekaiSoundtrackListRequestQuery,
  fetchMysekaiFixtureDetail,
  fetchMysekaiFixtureFilters,
  fetchMysekaiFixtureListPage,
  fetchMysekaiMaterialDetail,
  fetchMysekaiMaterials,
  fetchMysekaiShopItems,
  fetchMysekaiSoundtrackFilters,
  fetchMysekaiSoundtrackListPage,
  MYSEKAI_FIXTURE_PAGE_SIZE
} from "./mysekai";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("MySekai fixture requests", () => {
  it("sends every selected tag as one AND filter and the genre pair", () => {
    const query = parseMysekaiFixtureListQuery(
      new URLSearchParams("name=desk&main_genre_id=2&sub_genre_id=3&series=61&character=5")
    );

    expect(createMysekaiFixtureListRequestQuery(query, 2)).toEqual({
      page: 2,
      page_size: MYSEKAI_FIXTURE_PAGE_SIZE,
      sort_by: "id",
      sort_order: "asc",
      name: "desk",
      main_genre_id: "2",
      sub_genre_id: "3",
      tag_id: "61,5"
    });
  });

  it("maps the API pagination and targets the v1 base URL", async () => {
    sdk.getMysekaiFixturesByRegionList.mockResolvedValue({
      data: {
        items: [{ id: 1, name: "Table", tagIds: [] }],
        pagination: { page: 1, page_size: 48, total: 60, total_pages: 2, has_next: true }
      }
    });

    const page = await fetchMysekaiFixtureListPage(
      "https://api.example.test/",
      "jp",
      parseMysekaiFixtureListQuery(new URLSearchParams())
    );

    expect(page.pagination).toEqual({ page: 1, pageSize: 48, total: 60, hasNext: true });
    expect(sdk.getMysekaiFixturesByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://api.example.test/api/v1",
        path: { region: "jp" }
      })
    );
  });

  it("returns null for a missing fixture and throws on other failures", async () => {
    sdk.getMysekaiFixturesByRegionById.mockResolvedValueOnce({
      error: { error: { code: "MYSEKAI_FIXTURE_NOT_FOUND" } },
      response: { status: 404 }
    });
    await expect(
      fetchMysekaiFixtureDetail("https://api.example.test", "jp", 9)
    ).resolves.toBeNull();

    sdk.getMysekaiFixturesByRegionById.mockResolvedValueOnce({
      error: { error: { code: "MYSEKAI_FIXTURE_QUERY_ERROR" } },
      response: { status: 500 }
    });
    await expect(fetchMysekaiFixtureDetail("https://api.example.test", "jp", 9)).rejects.toThrow();
  });
});

describe("MySekai materials", () => {
  it("reads pages until the API reports no next page", async () => {
    sdk.getMysekaiMaterialsByRegionList
      .mockResolvedValueOnce({
        data: { items: [{ id: 1 }], pagination: { has_next: true } }
      })
      .mockResolvedValueOnce({
        data: { items: [{ id: 2 }], pagination: { has_next: false } }
      });

    const materials = await fetchMysekaiMaterials("https://api.example.test", "en");

    expect(materials.map((material) => material.id)).toEqual([1, 2]);
    expect(sdk.getMysekaiMaterialsByRegionList).toHaveBeenCalledTimes(2);
  });
});

describe("MySekai secret shop", () => {
  it("reads every shop page from the v1 API and throws on failure", async () => {
    sdk.getMysekaiShopsByRegionList
      .mockResolvedValueOnce({ data: { items: [{ id: 1 }], pagination: { has_next: true } } })
      .mockResolvedValueOnce({ data: { items: [{ id: 101 }] } });

    const items = await fetchMysekaiShopItems("https://api.example.test", "jp");

    expect(items.map((item) => item.id)).toEqual([1, 101]);
    expect(sdk.getMysekaiShopsByRegionList).toHaveBeenNthCalledWith(1, {
      baseUrl: "https://api.example.test/api/v1",
      path: { region: "jp" },
      query: { page: 1, page_size: 100 }
    });

    sdk.getMysekaiShopsByRegionList.mockResolvedValueOnce({ error: { code: "x" } });
    await expect(fetchMysekaiShopItems("https://api.example.test", "jp")).rejects.toThrow();
  });
});

describe("MySekai soundtrack requests", () => {
  it("asks for sound-track records and the category only when one is selected", () => {
    expect(createMysekaiSoundtrackListRequestQuery({ name: "", categoryId: 3 }, 1)).toMatchObject({
      track_type: "music_sound_track",
      sound_track_category_id: "3"
    });
    const query = createMysekaiSoundtrackListRequestQuery({ name: "sekai", categoryId: null }, 1);
    expect(query).toMatchObject({ track_type: "music_sound_track", name: "sekai" });
    expect(query).not.toHaveProperty("sound_track_category_id");
  });
});

describe("MySekai fetch failures and defaults", () => {
  const baseUrl = "https://api.example.test";

  it("throws when a list, filter, or page request fails", async () => {
    const failure = { error: { error: { code: "QUERY_ERROR" } }, response: { status: 500 } };
    sdk.getMysekaiFixturesByRegionList.mockResolvedValue(failure);
    sdk.getMysekaiFixturesByRegionFilters.mockResolvedValue(failure);
    sdk.getMysekaiMaterialsByRegionList.mockResolvedValue(failure);
    sdk.getMysekaiMaterialsByRegionById.mockResolvedValue(failure);
    sdk.getMysekaiMusicRecordsByRegionList.mockResolvedValue(failure);
    sdk.getMysekaiMusicRecordsByRegionFilters.mockResolvedValue(failure);
    const query = parseMysekaiFixtureListQuery(new URLSearchParams());
    const recordQuery = { name: "", categoryId: null };

    await expect(fetchMysekaiFixtureListPage(baseUrl, "jp", query)).rejects.toThrow();
    await expect(fetchMysekaiFixtureFilters(baseUrl, "jp")).rejects.toThrow();
    await expect(fetchMysekaiMaterials(baseUrl, "jp")).rejects.toThrow();
    await expect(fetchMysekaiMaterialDetail(baseUrl, "jp", 1)).rejects.toThrow();
    await expect(fetchMysekaiSoundtrackListPage(baseUrl, "jp", recordQuery)).rejects.toThrow();
    await expect(fetchMysekaiSoundtrackFilters(baseUrl, "jp")).rejects.toThrow();
  });

  it("fills missing arrays and pagination with defaults", async () => {
    sdk.getMysekaiFixturesByRegionFilters.mockResolvedValue({
      data: { mainGenres: [{ id: 2, name: "General" }] }
    });
    sdk.getMysekaiMusicRecordsByRegionList.mockResolvedValue({ data: {} });
    sdk.getMysekaiMusicRecordsByRegionFilters.mockResolvedValue({ data: {} });

    await expect(fetchMysekaiFixtureFilters(baseUrl, "jp")).resolves.toEqual({
      mainGenres: [{ id: 2, name: "General", subGenres: [] }],
      tags: []
    });
    await expect(
      fetchMysekaiSoundtrackListPage(baseUrl, "jp", { name: "", categoryId: 1 }, 3)
    ).resolves.toEqual({
      items: [],
      pagination: { page: 3, pageSize: 48, total: null, hasNext: false }
    });
    await expect(fetchMysekaiSoundtrackFilters(baseUrl, "jp")).resolves.toEqual({
      soundTrackCategories: []
    });
  });

  it("returns a material, or null when the region lacks it", async () => {
    sdk.getMysekaiMaterialsByRegionById
      .mockResolvedValueOnce({ data: { id: 1, name: "Wood" } })
      .mockResolvedValueOnce({ error: {}, response: { status: 404 } });

    await expect(fetchMysekaiMaterialDetail(baseUrl, "jp", 1)).resolves.toMatchObject({
      name: "Wood"
    });
    await expect(fetchMysekaiMaterialDetail(baseUrl, "jp", 2)).resolves.toBeNull();
  });
});
