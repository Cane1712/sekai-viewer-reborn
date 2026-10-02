import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mission, MissionFamily } from "$lib/domain/mission";
import { missionFamilies } from "$lib/domain/mission";

const { getMissionsByRegionList } = vi.hoisted(() => ({
  getMissionsByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({ getMissionsByRegionList }));

import {
  createEmptyMissionListPage,
  fetchMissionListPage,
  parseMission,
  parseMissionFamily,
  parseMissionFamilies,
  parseMissionList
} from "./mission-list";

type MissionRequest = {
  baseUrl: string;
  path: { region: string };
  query: {
    family: MissionFamily;
    page: number;
    page_size: number;
    sort_by: "seq";
    sort_order: "asc";
  };
};

const FAMILY_PAGE_SIZE = 8;
const PAGE_SIZE = 24;

const createMission = (family: MissionFamily, id: number) => ({
  id,
  sentence: `${family} mission ${id}`
});

const createMissionResponse = (family: MissionFamily, page: number, total: number) => {
  const startIndex = (page - 1) * FAMILY_PAGE_SIZE;
  const itemCount = Math.max(0, Math.min(FAMILY_PAGE_SIZE, total - startIndex));

  return {
    data: {
      items: Array.from({ length: itemCount }, (_, index) =>
        createMission(family, startIndex + index + 1)
      ),
      pagination: {
        page,
        page_size: FAMILY_PAGE_SIZE,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / FAMILY_PAGE_SIZE),
        has_next: page < Math.ceil(total / FAMILY_PAGE_SIZE)
      }
    }
  };
};

describe("mission catalogue adapter", () => {
  beforeEach(() => {
    getMissionsByRegionList.mockReset();
  });

  it("maps valid mission and reward wire records and drops malformed records", () => {
    const missionPayload = {
      id: "101",
      characterId: "6",
      characterMissionType: "character",
      eventId: "42",
      isAchievementMission: true,
      normalMissionType: "normal",
      parameterGroup: {
        id: 9,
        lastLevel: null,
        totalLevels: 2,
        levels: [
          { exp: 100, quantity: null, requirement: 10, reward: null, seq: 1 },
          { exp: null, quantity: 3, requirement: 20, reward: null, seq: 2 }
        ]
      },
      parameterGroupId: "9",
      progressSentence: "Progress",
      requirement: 10,
      resourceBoxId: "55",
      rewards: [
        {
          id: "1",
          missionId: "101",
          missionType: "mission",
          resourceBox: {
            id: "55",
            resourceBoxPurpose: "purpose",
            resourceBoxType: "item",
            details: [
              {
                resourceBoxId: "55",
                resourceBoxPurpose: "purpose",
                resourceId: "99",
                resourceLevel: 2,
                resourceQuantity: 3,
                resourceType: "crystal",
                seq: 1,
                resourceName: "Mission Gacha Ticket",
                resourceAssetbundleName: "mission_gacha_ticket",
                resourceRarity: null
              },
              "malformed detail"
            ]
          },
          resourceBoxId: "55",
          resourceBoxIds: ["55", 56, "invalid"],
          resourceBoxPurpose: "purpose",
          resourceId: "99",
          resourceLevel: 2,
          resourceQuantity: 3,
          resourceType: "crystal",
          seq: 1,
          status: "available"
        },
        null
      ],
      sentence: "Complete the mission",
      seq: 4,
      storyMissionType: "story"
    };

    expect(parseMission(missionPayload, "storyMissions")).toEqual({
      id: 101,
      family: "storyMissions",
      characterId: 6,
      characterMissionType: "character",
      eventId: 42,
      isAchievementMission: true,
      normalMissionType: "normal",
      parameterGroup: {
        id: 9,
        lastLevel: null,
        totalLevels: 2,
        levels: [
          { exp: 100, quantity: null, requirement: 10, reward: null, seq: 1 },
          { exp: null, quantity: 3, requirement: 20, reward: null, seq: 2 }
        ]
      },
      parameterGroupId: 9,
      progressSentence: "Progress",
      requirement: 10,
      resourceBoxId: 55,
      rewards: [
        {
          id: 1,
          missionId: 101,
          missionType: "mission",
          resourceBox: {
            id: 55,
            resourceBoxPurpose: "purpose",
            resourceBoxType: "item",
            details: [
              {
                resourceBoxId: 55,
                resourceBoxPurpose: "purpose",
                resourceId: 99,
                resourceLevel: 2,
                resourceQuantity: 3,
                resourceType: "crystal",
                seq: 1,
                resourceName: "Mission Gacha Ticket",
                resourceAssetbundleName: "mission_gacha_ticket",
                resourceRarity: null
              }
            ]
          },
          resourceBoxId: 55,
          resourceBoxIds: [55, 56],
          resourceBoxPurpose: "purpose",
          resourceId: 99,
          resourceLevel: 2,
          resourceQuantity: 3,
          resourceType: "crystal",
          seq: 1,
          status: "available"
        }
      ],
      sentence: "Complete the mission",
      seq: 4,
      storyMissionType: "story"
    } satisfies Mission);

    expect(parseMission(null, "storyMissions")).toBeNull();
    expect(parseMission({ id: 0 }, "storyMissions")).toBeNull();
    expect(
      parseMissionList(
        { data: { items: [missionPayload, { id: 0 }, "malformed"] } },
        "normalMissions"
      )
    ).toHaveLength(1);
  });

  it("parses parameter-group levels defensively and orders them by sequence", () => {
    expect(
      parseMission(
        {
          id: 102,
          parameterGroup: {
            id: "not a number",
            levels: [
              { seq: 3, requirement: 40 },
              { seq: 1, requirement: 10, exp: 100 },
              "malformed level",
              { seq: "not a number", requirement: "not a number", quantity: null },
              { seq: 2, requirement: 20, quantity: 2 }
            ]
          }
        },
        "characterMissionV2s"
      )
    ).toMatchObject({
      parameterGroup: {
        id: null,
        levels: [
          { seq: 1, requirement: 10, exp: 100, quantity: null },
          { seq: 2, requirement: 20, exp: null, quantity: 2 },
          { seq: 3, requirement: 40, exp: null, quantity: null },
          { seq: null, requirement: null, exp: null, quantity: null }
        ]
      }
    });

    expect(
      parseMission({ id: 103, parameterGroup: "malformed" }, "characterMissionV2s")
    ).toMatchObject({ parameterGroup: null });
    expect(
      parseMission(
        { id: 104, parameterGroup: { id: 8, levels: "malformed" } },
        "characterMissionV2s"
      )
    ).toMatchObject({ parameterGroup: { id: 8, levels: [] } });
  });

  it("filters requested families in canonical order and defaults to all families", () => {
    expect(
      parseMissionFamilies(
        new URLSearchParams(
          "family=normalMissions,invalid&family=storyMissions&family=normalMissions"
        )
      )
    ).toEqual(["storyMissions", "normalMissions"]);
    expect(parseMissionFamilies(new URLSearchParams("family=invalid"))).toEqual([
      ...missionFamilies
    ]);
  });

  it("resolves one selected family from new and legacy family query values", () => {
    expect(parseMissionFamily(new URLSearchParams("family=normalMissions"))).toBe("normalMissions");
    expect(
      parseMissionFamily(
        new URLSearchParams("family=invalid,characterMissionV2s&family=storyMissions")
      )
    ).toBe("characterMissionV2s");
    expect(parseMissionFamily(new URLSearchParams("family=invalid"))).toBeNull();
    expect(parseMissionFamily(new URLSearchParams())).toBeNull();
  });

  it("creates an empty page with stable pagination defaults", () => {
    expect(createEmptyMissionListPage(3)).toEqual({
      items: [],
      pagination: {
        page: 3,
        pageSize: PAGE_SIZE,
        hasNext: false,
        total: null,
        totalPages: null
      }
    });
  });

  it("fetches selected families, de-duplicates family items, and aggregates metadata", async () => {
    getMissionsByRegionList.mockImplementation((request: MissionRequest) => {
      const response = createMissionResponse(request.query.family, request.query.page, 8);
      if (request.query.family === "storyMissions") {
        response.data.items[1] = response.data.items[0];
      }
      return Promise.resolve(response);
    });

    await expect(
      fetchMissionListPage(
        "https://master-api.test/api/v1/",
        "tw",
        ["normalMissions", "storyMissions", "normalMissions"],
        1
      )
    ).resolves.toMatchObject({
      items: [
        { id: 1, family: "storyMissions" },
        { id: 3, family: "storyMissions" },
        { id: 4, family: "storyMissions" },
        { id: 5, family: "storyMissions" },
        { id: 6, family: "storyMissions" },
        { id: 7, family: "storyMissions" },
        { id: 8, family: "storyMissions" },
        { id: 1, family: "normalMissions" },
        { id: 2, family: "normalMissions" },
        { id: 3, family: "normalMissions" },
        { id: 4, family: "normalMissions" },
        { id: 5, family: "normalMissions" },
        { id: 6, family: "normalMissions" },
        { id: 7, family: "normalMissions" },
        { id: 8, family: "normalMissions" }
      ],
      pagination: { page: 1, pageSize: PAGE_SIZE, hasNext: false, total: 16, totalPages: 1 }
    });

    expect(getMissionsByRegionList).toHaveBeenCalledTimes(2);
    expect(getMissionsByRegionList.mock.calls.map(([request]) => request)).toEqual([
      {
        baseUrl: "https://master-api.test/api/v1",
        path: { region: "tw" },
        query: {
          family: "storyMissions",
          page: 1,
          page_size: FAMILY_PAGE_SIZE,
          sort_by: "seq",
          sort_order: "asc"
        }
      },
      {
        baseUrl: "https://master-api.test/api/v1",
        path: { region: "tw" },
        query: {
          family: "normalMissions",
          page: 1,
          page_size: FAMILY_PAGE_SIZE,
          sort_by: "seq",
          sort_order: "asc"
        }
      }
    ] satisfies MissionRequest[]);
  });

  it("combines family totals and has-next state across a later page", async () => {
    getMissionsByRegionList.mockImplementation((request: MissionRequest) =>
      Promise.resolve(
        createMissionResponse(
          request.query.family,
          request.query.page,
          request.query.family === "storyMissions" ? 16 : 10
        )
      )
    );

    const result = await fetchMissionListPage(
      "https://master-api.test",
      "jp",
      ["storyMissions", "characterMissionV2s"],
      2
    );

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: PAGE_SIZE,
      hasNext: false,
      total: 26,
      totalPages: 2
    });
    expect(result.items).toHaveLength(10);
  });

  it("keeps the aggregate total nullable when a family omits its total", async () => {
    getMissionsByRegionList.mockResolvedValue({
      data: {
        items: Array.from({ length: FAMILY_PAGE_SIZE }, (_, index) => ({ id: index + 1 })),
        pagination: { page: 1, page_size: FAMILY_PAGE_SIZE, total_pages: 3, has_next: true }
      }
    });

    await expect(
      fetchMissionListPage("https://master-api.test", "jp", ["normalMissions"])
    ).resolves.toMatchObject({
      pagination: { page: 1, pageSize: PAGE_SIZE, hasNext: true, total: null, totalPages: 3 }
    });
  });

  it("returns an empty page without requesting any family when none is selected", async () => {
    await expect(fetchMissionListPage("https://master-api.test", "jp", [], 4)).resolves.toEqual({
      items: [],
      pagination: { page: 4, pageSize: PAGE_SIZE, hasNext: false, total: null, totalPages: null }
    });
    expect(getMissionsByRegionList).not.toHaveBeenCalled();
  });

  it.each([
    [
      "an API error",
      { error: new Error("unavailable") },
      "Failed to load normalMissions missions."
    ],
    [
      "a malformed items collection",
      { data: { items: "not an array" } },
      "Mission catalogue returned invalid normalMissions items."
    ],
    [
      "malformed pagination metadata",
      { data: { items: [], pagination: "not an object" } },
      "Mission catalogue returned invalid pagination metadata."
    ]
  ] as const)("rejects %s", async (_description, response, message) => {
    getMissionsByRegionList.mockResolvedValue(response);

    await expect(
      fetchMissionListPage("https://master-api.test", "jp", ["normalMissions"])
    ).rejects.toThrow(message);
  });

  it("rejects a requested page beyond every selected family", async () => {
    getMissionsByRegionList.mockResolvedValue({
      data: {
        items: [],
        pagination: {
          page: 2,
          page_size: FAMILY_PAGE_SIZE,
          total: 8,
          total_pages: 1,
          has_next: false
        }
      }
    });

    await expect(
      fetchMissionListPage("https://master-api.test", "jp", ["normalMissions"], 2)
    ).rejects.toThrow("Mission catalogue returned a page beyond the selected families.");
  });

  it("rejects inconsistent pagination metadata from a family", async () => {
    getMissionsByRegionList.mockResolvedValue({
      data: {
        items: Array.from({ length: FAMILY_PAGE_SIZE }, (_, index) => ({ id: index + 1 })),
        pagination: {
          page: 1,
          page_size: FAMILY_PAGE_SIZE,
          total: 8,
          total_pages: 2,
          has_next: false
        }
      }
    });

    await expect(
      fetchMissionListPage("https://master-api.test", "jp", ["normalMissions"])
    ).rejects.toThrow("Mission catalogue returned inconsistent total counts.");
  });
});
