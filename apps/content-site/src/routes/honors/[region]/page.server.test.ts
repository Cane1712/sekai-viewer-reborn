import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHonorGroupsByRegionList } = vi.hoisted(() => ({
  getHonorGroupsByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({ getHonorGroupsByRegionList }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const { fetchBondsHonorViewData } = vi.hoisted(() => ({ fetchBondsHonorViewData: vi.fn() }));
vi.mock("$lib/server/honor-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("$lib/server/honor-list")>()),
  fetchBondsHonorViewData
}));

import { load } from "./+page.server";
import type { HonorGroup } from "$lib/domain/honor";

type HonorPageLoadResult = {
  region: string;
  query: { honorType: string | null; name: string; sortBy: "id"; sortOrder: "asc" | "desc" };
  catalogue: Promise<{
    items: HonorGroup[];
    availableHonorTypes: string[];
    loadFailed: boolean;
    pagination: {
      page: number;
      pageSize: number;
      hasNext: boolean;
      total: number | null;
      totalPages: number | null;
    };
  }>;
};

const PAGE_SIZE = 24;
const runLoad = (region: string, search = "") =>
  load({
    params: { region },
    url: new URL(`http://localhost/honors/${region}${search}`)
  } as Parameters<typeof load>[0]);

const createHonorGroup = (id: number) => ({
  id,
  name: `Honor group ${id}`,
  honorType: "character",
  backgroundAssetbundleName: `honor_group_${id}`,
  frameName: `frame_${id}`,
  honors: [
    {
      id: id * 100 + 1,
      name: `Honor ${id}`,
      levels: [{ honorId: id * 100 + 1, level: 1, description: "Complete it" }]
    }
  ]
});

const createResponse = (page: number, total = PAGE_SIZE * 2) => ({
  data: {
    items: Array.from(
      { length: Math.max(0, Math.min(PAGE_SIZE, total - (page - 1) * PAGE_SIZE)) },
      (_, index) => createHonorGroup((page - 1) * PAGE_SIZE + index + 1)
    ),
    availableHonorTypes: ["character", "event"],
    pagination: {
      page,
      page_size: PAGE_SIZE,
      total,
      total_pages: Math.ceil(total / PAGE_SIZE),
      has_next: page < Math.ceil(total / PAGE_SIZE)
    }
  }
});

describe("honor catalogue page load", () => {
  beforeEach(() => {
    getHonorGroupsByRegionList.mockReset();
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    fetchBondsHonorViewData.mockReset();
  });

  it("loads the Bonds display data for the Kizuna category only", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(createResponse(1));
    const viewData = { characterUnitIds: { "21:light_sound": 27 }, unitNames: {} };
    fetchBondsHonorViewData.mockResolvedValue(viewData);

    const regular = (await runLoad("jp", "?honor_type=event")) as unknown as {
      bondsView: Promise<unknown>;
    };
    await expect(regular.bondsView).resolves.toBeNull();
    expect(fetchBondsHonorViewData).not.toHaveBeenCalled();

    const bonds = (await runLoad("tw", "?honor_type=bonds")) as unknown as {
      bondsView: Promise<unknown>;
    };
    await expect(bonds.bondsView).resolves.toBe(viewData);
    expect(fetchBondsHonorViewData).toHaveBeenCalledWith("https://master-api.test", "tw");

    fetchBondsHonorViewData.mockRejectedValueOnce(new Error("down"));
    const failed = (await runLoad("jp", "?honor_type=bonds")) as unknown as {
      bondsView: Promise<unknown>;
    };
    await expect(failed.bondsView).resolves.toBeNull();
  });

  it("always SSR-fetches the first group page with normalized search and order state", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(createResponse(1));
    const result = (await runLoad(
      "invalid",
      "?page=9&name=%20Stage%20&honor_type=%20event%20&sort_order=desc"
    )) as unknown as HonorPageLoadResult;

    expect(result.region).toBe("jp");
    expect(result.query).toEqual({
      honorType: "event",
      name: "Stage",
      sortBy: "id",
      sortOrder: "desc"
    });
    const catalogue = await result.catalogue;
    expect(catalogue.loadFailed).toBe(false);
    expect(catalogue.pagination).toMatchObject({ page: 1, hasNext: true });
    expect(catalogue.items[0]).toMatchObject({ id: 1, honors: [{ id: 101, groupId: 1 }] });
    expect(getHonorGroupsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      path: { region: "jp" },
      query: {
        page: 1,
        page_size: PAGE_SIZE,
        honor_type: "event",
        name: "Stage",
        sort_by: "id",
        sort_order: "desc"
      }
    });
  });

  it("defaults invalid order values to ascending ID order", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(createResponse(1, 0));
    const result = (await runLoad(
      "tw",
      "?sort_by=name&sort_order=sideways"
    )) as unknown as HonorPageLoadResult;

    expect(result.query).toEqual({ honorType: null, name: "", sortBy: "id", sortOrder: "asc" });
    await expect(result.catalogue).resolves.toMatchObject({
      loadFailed: false,
      pagination: { page: 1, total: 0, hasNext: false }
    });
  });

  it("keeps API-provided categories available when the selected filter is empty", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(createResponse(1, 0));
    const result = (await runLoad(
      "jp",
      "?honor_type=unknown&name=missing"
    )) as unknown as HonorPageLoadResult;

    await expect(result.catalogue).resolves.toMatchObject({
      items: [],
      availableHonorTypes: ["character", "event", "bonds"],
      loadFailed: false
    });
    expect(getHonorGroupsByRegionList.mock.calls[0]?.[0].query).toMatchObject({
      honor_type: "unknown",
      name: "missing",
      sort_by: "id",
      sort_order: "asc"
    });
  });

  it("returns a retryable failed first page when the API is unavailable", async () => {
    getHonorGroupsByRegionList.mockRejectedValue(new Error("unavailable"));
    const result = (await runLoad("tw")) as unknown as HonorPageLoadResult;
    await expect(result.catalogue).resolves.toMatchObject({
      items: [],
      loadFailed: true,
      pagination: { page: 1, hasNext: false }
    });
  });
});
