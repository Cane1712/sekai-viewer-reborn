import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  fetchMysekaiFixtureDetail: vi.fn(),
  fetchMysekaiFixtureFilters: vi.fn(),
  fetchMysekaiFixtureListPage: vi.fn(),
  fetchMysekaiMaterialDetail: vi.fn(),
  fetchMysekaiMaterials: vi.fn(),
  fetchMysekaiShopItems: vi.fn(),
  fetchMysekaiSoundtrackFilters: vi.fn(),
  fetchMysekaiSoundtrackListPage: vi.fn()
}));
vi.mock("$lib/server/mysekai", () => server);
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl: () => "https://master-api.test" }));

import { load as loadFixtures } from "./fixtures/[region]/+page.server";
import { GET as getFixturesPage } from "./fixtures/[region]/data/+server";
import { load as loadFixture } from "./fixture/[region]/[id]/+page.server";
import { load as loadMaterials } from "./materials/[region]/+page.server";
import { load as loadMaterial } from "./material/[region]/[id]/+page.server";
import { load as loadShop } from "./shop/[region]/+page.server";
import { load as loadSoundtracks } from "./soundtracks/[region]/+page.server";
import { GET as getSoundtracksPage } from "./soundtracks/[region]/data/+server";

type LoadEvent = { params: Record<string, string>; url: URL };
const event = (params: Record<string, string>, path = "http://localhost/"): LoadEvent => ({
  params,
  url: new URL(path)
});
// The route loaders only read params and url, and return their data synchronously.
const run = <T>(load: (event: never) => T, input: LoadEvent): Exclude<Awaited<T>, void> =>
  load(input as never) as Exclude<Awaited<T>, void>;

const page = {
  items: [{ id: 1 }],
  pagination: { page: 2, pageSize: 48, total: 49, hasNext: false }
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("MySekai list loaders", () => {
  it("streams the fixture list and filters for the parsed query and region", async () => {
    server.fetchMysekaiFixtureListPage.mockResolvedValue(page);
    server.fetchMysekaiFixtureFilters.mockRejectedValue(new Error("offline"));

    const data = run(
      loadFixtures,
      event({ region: "xx" }, "http://localhost/mysekai/fixtures/xx?main_genre_id=2&character=5")
    );

    expect(data.region).toBe("jp");
    expect(data.query).toMatchObject({ mainGenreId: 2, characterTagId: 5 });
    await expect(data.catalogue).resolves.toEqual(page);
    // A failed request resolves to null, so the page shows its own error state.
    await expect(data.filters).resolves.toBeNull();
    expect(server.fetchMysekaiFixtureListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      data.query
    );
  });

  it("streams every material and resolves failures to null", async () => {
    server.fetchMysekaiMaterials.mockRejectedValue(new Error("offline"));

    const data = run(loadMaterials, event({ region: "en" }));

    expect(data.region).toBe("en");
    await expect(data.materials).resolves.toBeNull();
  });

  it("streams every secret shop item and resolves failures to null", async () => {
    server.fetchMysekaiShopItems.mockResolvedValueOnce([{ id: 1 }]);

    const data = run(loadShop, event({ region: "jp" }));

    expect(data.region).toBe("jp");
    await expect(data.items).resolves.toEqual([{ id: 1 }]);
    expect(server.fetchMysekaiShopItems).toHaveBeenCalledWith("https://master-api.test", "jp");

    server.fetchMysekaiShopItems.mockRejectedValueOnce(new Error("offline"));
    await expect(run(loadShop, event({ region: "en" })).items).resolves.toBeNull();
  });

  it("streams the soundtracks of the selected category", async () => {
    server.fetchMysekaiSoundtrackListPage.mockRejectedValue(new Error("offline"));
    server.fetchMysekaiSoundtrackFilters.mockResolvedValue({ soundTrackCategories: [] });

    const data = run(loadSoundtracks, event({ region: "tw" }, "http://localhost/?category=3"));

    expect(data.query).toEqual({ name: "", categoryId: 3 });
    await expect(data.catalogue).resolves.toBeNull();
    await expect(data.filters).resolves.toEqual({ soundTrackCategories: [] });
  });
});

describe("MySekai detail loaders", () => {
  it("resolves a fixture, a missing fixture, and an invalid ID", async () => {
    server.fetchMysekaiFixtureDetail.mockResolvedValueOnce({ id: 7 }).mockResolvedValueOnce(null);

    await expect(run(loadFixture, event({ region: "jp", id: "7" })).payload).resolves.toEqual({
      status: "ready",
      item: { id: 7 }
    });
    await expect(run(loadFixture, event({ region: "jp", id: "8" })).payload).resolves.toEqual({
      status: "notFound",
      item: null
    });
    await expect(run(loadFixture, event({ region: "jp", id: "x" })).payload).resolves.toEqual({
      status: "notFound",
      item: null
    });
    expect(server.fetchMysekaiFixtureDetail).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      7
    );
  });

  it("reports a failed material request as an error", async () => {
    server.fetchMysekaiMaterialDetail.mockRejectedValue(new Error("offline"));

    const data = run(loadMaterial, event({ region: "kr", id: "1" }));

    expect(data).toMatchObject({ region: "kr", id: "1" });
    await expect(data.payload).resolves.toEqual({ status: "error", item: null });
  });
});

describe("MySekai data endpoints", () => {
  it("returns the requested fixture page", async () => {
    server.fetchMysekaiFixtureListPage.mockResolvedValue(page);

    const response = await getFixturesPage(
      event({ region: "jp" }, "http://localhost/data?page=2&unit=4") as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(page);
    expect(server.fetchMysekaiFixtureListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      expect.objectContaining({ unitTagId: 4 }),
      2
    );
  });

  it("answers 500 when a page fails", async () => {
    server.fetchMysekaiFixtureListPage.mockRejectedValue(new Error("offline"));
    server.fetchMysekaiSoundtrackListPage.mockRejectedValue(new Error("offline"));

    const fixtures = await getFixturesPage(
      event({ region: "jp" }, "http://localhost/data") as never
    );
    const records = await getSoundtracksPage(
      event({ region: "jp" }, "http://localhost/data?page=3") as never
    );

    expect([fixtures.status, records.status]).toEqual([500, 500]);
  });

  it("returns the requested soundtrack page", async () => {
    server.fetchMysekaiSoundtrackListPage.mockResolvedValue(page);

    const response = await getSoundtracksPage(
      event({ region: "cn" }, "http://localhost/data?page=2&name=bgm") as never
    );

    await expect(response.json()).resolves.toEqual(page);
    expect(server.fetchMysekaiSoundtrackListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "cn",
      { name: "bgm", categoryId: null },
      2
    );
  });
});
