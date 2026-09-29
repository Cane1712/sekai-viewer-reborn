import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const { fetchTitlePreview } = vi.hoisted(() => ({ fetchTitlePreview: vi.fn() }));
vi.mock("$lib/server/title-preview", () => ({ fetchTitlePreview }));

import { GET } from "./+server";
import type { TitlePreview } from "$lib/domain/title-preview";

const preview: TitlePreview = {
  kind: "honor",
  id: 12,
  name: "Title 12",
  rarity: "high",
  subtitle: "Group",
  degree: { kind: "normal", region: "jp", honorId: 12 } as TitlePreview["degree"],
  levels: [{ level: 1, description: "Clear a show" }]
};

const callGet = (region: string, kind: string, id: string, search = "") =>
  GET({
    params: { region, kind, id },
    url: new URL(`http://localhost/honors/${region}/preview/${kind}/${id}${search}`)
  } as Parameters<typeof GET>[0]);

describe("title preview endpoint", () => {
  beforeEach(() => {
    fetchTitlePreview.mockReset();
  });

  it("returns the title rendered at the rewarded level", async () => {
    fetchTitlePreview.mockResolvedValue(preview);

    const response = await callGet("en", "honor", "12", "?level=3");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(preview);
    expect(fetchTitlePreview).toHaveBeenCalledWith("https://master-api.test", "en", "honor", 12, 3);
  });

  it("maps the bonds path to Kizuna titles and ignores an invalid level", async () => {
    fetchTitlePreview.mockResolvedValue({ ...preview, kind: "bonds" });

    const response = await callGet("jp", "bonds", "7", "?level=abc");

    expect(response.status).toBe(200);
    expect(fetchTitlePreview).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      "bonds",
      7,
      null
    );
  });

  it.each([
    ["an unknown kind", "bonds_honor", "12"],
    ["a non-numeric id", "honor", "abc"],
    ["a zero id", "honor", "0"]
  ])("rejects %s", async (_label, kind, id) => {
    const response = await callGet("jp", kind, id);

    expect(response.status).toBe(400);
    expect(fetchTitlePreview).not.toHaveBeenCalled();
  });

  it("returns 404 when the region does not have the title", async () => {
    fetchTitlePreview.mockResolvedValue(null);

    const response = await callGet("jp", "honor", "12");

    expect(response.status).toBe(404);
  });

  it("returns 500 when the title cannot be loaded", async () => {
    fetchTitlePreview.mockRejectedValue(new Error("upstream failed"));

    const response = await callGet("jp", "honor", "12");

    expect(response.status).toBe(500);
  });
});
