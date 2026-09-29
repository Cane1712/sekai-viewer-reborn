import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HonorGroup } from "$lib/domain/honor";

const { getBondsHonorsByRegionList, getHonorGroupsByRegionList } = vi.hoisted(() => ({
  getBondsHonorsByRegionList: vi.fn(),
  getHonorGroupsByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getBondsHonorsByRegionList,
  getHonorGroupsByRegionList
}));

import {
  createEmptyHonorListPage,
  fetchHonorListPage,
  parseHonorListQueryState,
  parseHonor,
  parseHonorGroupList
} from "./honor-list";

type HonorRequest = {
  baseUrl: string;
  path: { region: string };
  query: {
    page: number;
    page_size: number;
    name?: string;
    honor_type?: string;
    sort_by: "id";
    sort_order: "asc" | "desc";
  };
};

const PAGE_SIZE = 24;

const createHonorGroup = (id: number) => ({
  id,
  name: `Honor group ${id}`,
  honorType: "character",
  backgroundAssetbundleName: `background_${id}`,
  frameName: `frame_${id}`,
  honors: [{ id: id * 100 + 1, name: `Honor ${id}` }]
});

const createHonorResponse = (page: number, total: number, items?: unknown[]) => ({
  data: {
    items:
      items ??
      Array.from(
        { length: Math.max(0, Math.min(PAGE_SIZE, total - (page - 1) * PAGE_SIZE)) },
        (_, index) => createHonorGroup((page - 1) * PAGE_SIZE + index + 1)
      ),
    pagination: {
      page,
      page_size: PAGE_SIZE,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / PAGE_SIZE),
      has_next: page < Math.ceil(total / PAGE_SIZE)
    }
  }
});

describe("honor catalogue adapter", () => {
  beforeEach(() => {
    getHonorGroupsByRegionList.mockReset();
  });

  it("maps valid wire records, applies group fallbacks, and drops malformed records", () => {
    const payload = {
      data: {
        items: [
          {
            id: "7",
            name: "  Group 7 ",
            honorType: "character",
            backgroundAssetbundleName: "group_background",
            frameName: "group_frame",
            honors: [
              {
                id: "701",
                assetBundleName: "honor_bundle",
                honorMissionType: "character",
                honorRarity: "normal",
                honorType: "character",
                honorTypeId: "3",
                levels: [
                  {
                    assetbundleName: "level_bundle",
                    bonus: 25,
                    description: "Level one",
                    honorId: "701",
                    honorRarity: "normal",
                    level: 1
                  },
                  "malformed level"
                ],
                name: "  Honor 701 ",
                seq: 1
              },
              { id: 0 }
            ]
          },
          null,
          { id: 0 }
        ]
      }
    };

    expect(parseHonorGroupList(payload)).toEqual([
      {
        id: 7,
        name: "Group 7",
        honorType: "character",
        backgroundAssetBundleName: "group_background",
        frameName: "group_frame",
        honors: [
          {
            id: 701,
            assetBundleName: "honor_bundle",
            group: {
              id: 7,
              name: "Group 7",
              honorType: "character",
              backgroundAssetBundleName: "group_background",
              frameName: "group_frame"
            },
            groupId: 7,
            honorMissionType: "character",
            honorRarity: "normal",
            honorType: "character",
            honorTypeId: 3,
            levels: [
              {
                assetBundleName: "level_bundle",
                bonus: 25,
                description: "Level one",
                honorId: 701,
                honorRarity: "normal",
                level: 1
              }
            ],
            name: "Honor 701",
            seq: 1
          }
        ]
      }
    ] satisfies HonorGroup[]);
  });

  it("returns null for malformed honor identities and parses explicit fallback metadata", () => {
    expect(parseHonor(null)).toBeNull();
    expect(parseHonor({ id: 0 })).toBeNull();
    expect(
      parseHonor(
        { id: 9, name: "Honor 9" },
        {
          id: 3,
          name: "Fallback group",
          honorType: "event",
          backgroundAssetBundleName: null,
          frameName: null
        }
      )
    ).toMatchObject({
      id: 9,
      group: { id: 3, name: "Fallback group" },
      groupId: 3,
      name: "Honor 9"
    });
  });

  it("loads the Bonds category as character-pair groups with its name search", async () => {
    const bondsHonor = (id: number, groupId: number, rarity: string) => ({
      id,
      bondsGroupId: groupId,
      name: `Pair ${groupId}`,
      honorRarity: rarity,
      levels: [{ level: 1, description: "Reach bond rank 5" }],
      words: [
        {
          id: groupId * 1000 + 10,
          seq: 3,
          assetbundleName: `honorname_${groupId}_01`,
          name: "Later"
        },
        {
          id: groupId * 1000 + 1,
          seq: 1,
          assetbundleName: `honorname_${groupId}_default`,
          name: "First"
        }
      ],
      characterUnit1: { id: 21, gameCharacterId: 21, unit: "piapro", colorCode: "#33ccbb" },
      characterUnit2: { id: 26, gameCharacterId: 26, unit: "piapro", colorCode: "#3366cc" }
    });
    getBondsHonorsByRegionList.mockResolvedValueOnce({
      data: {
        items: [
          bondsHonor(1212601, 12126, "low"),
          bondsHonor(1212602, 12126, "middle"),
          bondsHonor(1010201, 10102, "low")
        ],
        pagination: { page: 1, page_size: 72, total: 3, total_pages: 1, has_next: false }
      }
    });
    getHonorGroupsByRegionList.mockResolvedValueOnce({
      data: { ...createHonorResponse(1, 0).data, availableHonorTypes: ["event", "bonds"] }
    });

    const page = await fetchHonorListPage("https://master-api.test", "jp", 1, {
      honorType: "bonds",
      name: " 寒色 ",
      sortBy: "id",
      sortOrder: "desc"
    });

    expect(getBondsHonorsByRegionList.mock.calls[0]?.[0].query).toEqual({
      page: 1,
      page_size: 72,
      sort_by: "id",
      sort_order: "desc",
      name: "寒色"
    });
    expect(getHonorGroupsByRegionList.mock.calls[0]?.[0].query).toEqual({ page: 1, page_size: 1 });
    expect(page.items).toEqual([]);
    expect(page.availableHonorTypes).toEqual(["event", "bonds"]);
    expect(page.pagination).toMatchObject({ page: 1, pageSize: 72, hasNext: false, total: 3 });
    expect(
      page.bondsItems.map((group) => [group.id, group.honors.map((honor) => honor.id)])
    ).toEqual([
      [12126, [1212601, 1212602]],
      [10102, [1010201]]
    ]);
    expect(page.bondsItems[0]?.honors[0]).toMatchObject({
      name: "Pair 12126",
      honorRarity: "low",
      levels: [{ level: 1, description: "Reach bond rank 5" }],
      units: [
        { id: 21, colorCode: "#33ccbb" },
        { id: 26, colorCode: "#3366cc" }
      ]
    });
    // Words are sorted by seq, so the default word comes first.
    expect(page.bondsItems[0]?.honors[0]?.words.map((word) => word.name)).toEqual([
      "First",
      "Later"
    ]);
  });

  it("creates an empty page with stable pagination defaults", () => {
    expect(createEmptyHonorListPage(4)).toEqual({
      items: [],
      bondsItems: [],
      availableHonorTypes: [],
      pagination: {
        page: 4,
        pageSize: PAGE_SIZE,
        hasNext: false,
        total: null,
        totalPages: null
      }
    });
  });

  it("constructs the versioned request and maps the paginated response", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(createHonorResponse(2, PAGE_SIZE + 1));

    await expect(fetchHonorListPage("https://master-api.test///", "tw", 2)).resolves.toMatchObject({
      items: [{ id: PAGE_SIZE + 1, honors: [{ id: (PAGE_SIZE + 1) * 100 + 1 }] }],
      pagination: {
        page: 2,
        pageSize: PAGE_SIZE,
        hasNext: false,
        total: PAGE_SIZE + 1,
        totalPages: 2
      }
    });
    expect(getHonorGroupsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      path: { region: "tw" },
      query: { page: 2, page_size: PAGE_SIZE, sort_by: "id", sort_order: "asc" }
    } satisfies HonorRequest);
  });

  it("parses available honor types as trimmed unique strings in API order", async () => {
    getHonorGroupsByRegionList.mockResolvedValue({
      data: {
        items: [],
        availableHonorTypes: [" event ", "character", "event", "  ", null, 3, {}],
        pagination: {
          page: 1,
          page_size: PAGE_SIZE,
          total: 0,
          total_pages: 0,
          has_next: false
        }
      }
    });

    // Bonds honors are a separate entity, always offered as a final category.
    await expect(fetchHonorListPage("https://master-api.test", "jp")).resolves.toMatchObject({
      items: [],
      availableHonorTypes: ["event", "character", "bonds"]
    });
  });

  it("defaults malformed or absent available honor types to an empty list", async () => {
    getHonorGroupsByRegionList.mockResolvedValue({
      data: {
        ...createHonorResponse(1, 0).data,
        availableHonorTypes: "not an array"
      }
    });

    await expect(fetchHonorListPage("https://master-api.test", "jp")).resolves.toMatchObject({
      availableHonorTypes: ["bonds"]
    });

    getHonorGroupsByRegionList.mockResolvedValue(createHonorResponse(1, 0));

    await expect(fetchHonorListPage("https://master-api.test", "jp")).resolves.toMatchObject({
      availableHonorTypes: ["bonds"]
    });
  });

  it("sends a normalized honor type filter and omits an empty filter", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(createHonorResponse(1, 0));

    await fetchHonorListPage("https://master-api.test", "jp", 1, {
      honorType: "  character  ",
      name: "",
      sortBy: "id",
      sortOrder: "asc"
    });

    expect(getHonorGroupsByRegionList.mock.calls[0]?.[0].query).toEqual({
      page: 1,
      page_size: PAGE_SIZE,
      honor_type: "character",
      sort_by: "id",
      sort_order: "asc"
    });

    getHonorGroupsByRegionList.mockReset();
    getHonorGroupsByRegionList.mockResolvedValue(createHonorResponse(1, 0));

    await fetchHonorListPage("https://master-api.test", "jp", 1, {
      honorType: "  ",
      name: "",
      sortBy: "id",
      sortOrder: "asc"
    });

    expect(getHonorGroupsByRegionList.mock.calls[0]?.[0].query).toEqual({
      page: 1,
      page_size: PAGE_SIZE,
      sort_by: "id",
      sort_order: "asc"
    });
  });

  it("normalizes searchable, categorized, and ordered URL state", () => {
    const query = parseHonorListQueryState(
      new URLSearchParams("name=%20Stage%20&honor_type=%20event%20&sort_by=invalid&sort_order=desc")
    );
    expect(query).toEqual({
      honorType: "event",
      name: "Stage",
      sortBy: "id",
      sortOrder: "desc"
    });
  });

  it("does not duplicate the API prefix when the base URL already contains it", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(createHonorResponse(1, 0));

    await fetchHonorListPage("https://master-api.test/api/v1/", "jp");

    expect(getHonorGroupsByRegionList.mock.calls[0]?.[0]).toMatchObject({
      baseUrl: "https://master-api.test/api/v1"
    });
  });

  it.each([
    ["an SDK error", { error: new Error("unavailable") }, "Failed to load honor catalogue."],
    [
      "a malformed items collection",
      { data: { items: "not an array" } },
      "Honor catalogue returned invalid groups."
    ],
    [
      "malformed pagination metadata",
      { data: { items: [], pagination: "not an object" } },
      "Honor catalogue returned invalid pagination metadata."
    ]
  ] as const)("rejects %s", async (_description, response, message) => {
    getHonorGroupsByRegionList.mockResolvedValue(response);

    await expect(fetchHonorListPage("https://master-api.test", "jp")).rejects.toThrow(message);
  });

  it("accepts the first page of an empty catalogue but rejects a later empty page", async () => {
    getHonorGroupsByRegionList.mockResolvedValueOnce(createHonorResponse(1, 0));

    await expect(fetchHonorListPage("https://master-api.test", "jp")).resolves.toEqual({
      items: [],
      bondsItems: [],
      availableHonorTypes: ["bonds"],
      pagination: { page: 1, pageSize: PAGE_SIZE, hasNext: false, total: 0, totalPages: 0 }
    });

    getHonorGroupsByRegionList.mockResolvedValueOnce(createHonorResponse(2, 0));

    await expect(fetchHonorListPage("https://master-api.test", "jp", 2)).rejects.toThrow(
      "Honor catalogue requested a page beyond its reported page count."
    );
  });

  it.each([
    [
      "a stale page",
      { page: 1, page_size: PAGE_SIZE, total: 24, total_pages: 2, has_next: true },
      2,
      "Honor catalogue returned page 1 for requested page 2."
    ],
    [
      "an unexpected page size",
      { page: 1, page_size: 6, total: 6, total_pages: 1, has_next: false },
      1,
      "Honor catalogue returned a page with an unexpected page size."
    ],
    [
      "an invalid has-next value",
      { page: 1, page_size: PAGE_SIZE, total: 0, total_pages: 0, has_next: "yes" },
      1,
      "Honor catalogue returned an invalid has-next value."
    ],
    [
      "an incomplete page with another page",
      { page: 1, total_pages: 2, has_next: true },
      1,
      "Honor catalogue returned an incomplete page while reporting another page."
    ],
    [
      "an incorrect reported total",
      { page: 1, page_size: PAGE_SIZE, total: 24, has_next: false },
      1,
      "Honor catalogue returned an incomplete page for its reported total."
    ]
  ] as const)("rejects %s", async (_description, pagination, page, message) => {
    getHonorGroupsByRegionList.mockResolvedValue({
      data: {
        items: page === 1 && pagination.has_next === true ? [createHonorGroup(1)] : [],
        pagination
      }
    });

    await expect(fetchHonorListPage("https://master-api.test", "jp", page)).rejects.toThrow(
      message
    );
  });
});
