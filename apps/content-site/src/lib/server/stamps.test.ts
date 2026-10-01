import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ getStampsByRegionList: vi.fn() }));
vi.mock("@platform/sekai-master-api-sdk", () => sdk);

import { parseStampListQuery } from "$lib/domain/stamp";
import { createStampListRequestQuery, fetchStampListPage, STAMP_PAGE_SIZE } from "./stamps";

const query = (search: string) => parseStampListQuery(new URLSearchParams(search));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("stamp list requests", () => {
  it("sends only the filters that are set, with both characters as one AND filter", () => {
    expect(createStampListRequestQuery(query(""), 1)).toEqual({
      page: 1,
      page_size: STAMP_PAGE_SIZE,
      sort_by: "id",
      sort_order: "asc"
    });
    expect(
      createStampListRequestQuery(
        query("name=hi&category=bond&source=shop&character=1&second=2&sort_order=desc"),
        3
      )
    ).toEqual({
      page: 3,
      page_size: STAMP_PAGE_SIZE,
      sort_by: "id",
      sort_order: "desc",
      name: "hi",
      category: "bond",
      source: "shop",
      character_id: "1,2"
    });
  });

  it("maps the API pagination and targets the v1 base URL", async () => {
    sdk.getStampsByRegionList.mockResolvedValue({
      data: {
        items: [{ id: 1, name: "Stamp", characterIds: [] }],
        pagination: { page: 2, page_size: 48, total: 100, total_pages: 3, has_next: true }
      }
    });

    const page = await fetchStampListPage("https://api.example.test/", "tw", query(""), 2);

    expect(sdk.getStampsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://api.example.test/api/v1",
      path: { region: "tw" },
      query: createStampListRequestQuery(query(""), 2)
    });
    expect(page).toEqual({
      items: [{ id: 1, name: "Stamp", characterIds: [] }],
      pagination: { page: 2, pageSize: 48, total: 100, hasNext: true }
    });
  });

  it("fills missing items and pagination with defaults, and throws on failure", async () => {
    sdk.getStampsByRegionList.mockResolvedValueOnce({ data: {} });
    await expect(fetchStampListPage("https://api.example.test", "jp", query(""))).resolves.toEqual({
      items: [],
      pagination: { page: 1, pageSize: STAMP_PAGE_SIZE, total: null, hasNext: false }
    });

    sdk.getStampsByRegionList.mockResolvedValueOnce({ error: { code: "x" } });
    await expect(fetchStampListPage("https://api.example.test", "jp", query(""))).rejects.toThrow();
  });
});
