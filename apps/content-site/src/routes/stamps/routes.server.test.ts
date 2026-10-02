import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  fetchMissionCharacterOptions: vi.fn(),
  fetchStampListPage: vi.fn()
}));
vi.mock("$lib/server/stamps", () => ({ fetchStampListPage: server.fetchStampListPage }));
vi.mock("$lib/server/mission-characters", () => ({
  fetchMissionCharacterOptions: server.fetchMissionCharacterOptions
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl: () => "https://master-api.test" }));

import { GET as getStampsPage } from "./[region]/data/+server";
import { load as loadStamps } from "./[region]/+page.server";

type LoadEvent = { params: Record<string, string>; url: URL };
const event = (params: Record<string, string>, path = "http://localhost/"): LoadEvent => ({
  params,
  url: new URL(path)
});

const page = {
  items: [{ id: 1 }],
  pagination: { page: 2, pageSize: 48, total: 49, hasNext: false }
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("stamp list loader", () => {
  it("streams the stamps and characters for the parsed query and region", async () => {
    server.fetchStampListPage.mockResolvedValue(page);
    server.fetchMissionCharacterOptions.mockResolvedValue([{ id: 1, name: "Ichika" }]);

    const data = loadStamps(
      event({ region: "xx" }, "http://localhost/?category=bond&character=1&second=2") as never
    ) as Exclude<ReturnType<typeof loadStamps>, void | Promise<unknown>>;

    expect(data.region).toBe("jp");
    expect(data.query).toMatchObject({ category: "bond", characterId: 1, secondCharacterId: 2 });
    await expect(data.catalogue).resolves.toEqual(page);
    await expect(data.characters).resolves.toEqual([{ id: 1, name: "Ichika" }]);
    expect(server.fetchStampListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      data.query
    );
  });

  it("resolves failed requests to null so the page shows its own error state", async () => {
    server.fetchStampListPage.mockRejectedValue(new Error("offline"));
    server.fetchMissionCharacterOptions.mockRejectedValue(new Error("offline"));

    const data = loadStamps(event({ region: "en" }) as never) as Exclude<
      ReturnType<typeof loadStamps>,
      void | Promise<unknown>
    >;

    await expect(data.catalogue).resolves.toBeNull();
    await expect(data.characters).resolves.toBeNull();
  });
});

describe("stamp data endpoint", () => {
  it("returns the requested page of stamps", async () => {
    server.fetchStampListPage.mockResolvedValue(page);

    const response = await getStampsPage(
      event({ region: "jp" }, "http://localhost/data?page=2&category=text&source=live") as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(page);
    expect(server.fetchStampListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      expect.objectContaining({ category: "text", source: "live" }),
      2
    );
  });

  it("answers a failed request with a 500", async () => {
    server.fetchStampListPage.mockRejectedValue(new Error("offline"));

    const response = await getStampsPage(event({ region: "jp" }) as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: true });
  });
});
