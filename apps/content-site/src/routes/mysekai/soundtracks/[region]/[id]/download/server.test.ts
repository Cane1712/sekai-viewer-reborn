import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildMysekaiSoundtrackDownload } = vi.hoisted(() => ({
  buildMysekaiSoundtrackDownload: vi.fn()
}));
vi.mock("$lib/server/mysekai-soundtrack-download", () => ({ buildMysekaiSoundtrackDownload }));
vi.mock("$lib/server/config", () => ({
  getMasterApiBaseUrl: () => "https://master-api.test",
  getInternalRemoteAssetBaseUrl: () => "https://assets.internal.test"
}));

import { GET } from "./+server";

const request = (id: string) =>
  GET({ params: { region: "en", id }, fetch: vi.fn() } as unknown as Parameters<typeof GET>[0]);

beforeEach(() => {
  buildMysekaiSoundtrackDownload.mockReset();
});

describe("MySekai soundtrack download", () => {
  it("sends the tagged MP3 as an attachment named after the title", async () => {
    buildMysekaiSoundtrackDownload.mockResolvedValue({
      title: "セカイの狭間にて",
      body: new Uint8Array([1, 2])
    });

    const response = await request("10007");

    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="soundtrack-10007.mp3"; filename*=UTF-8''${encodeURIComponent("セカイの狭間にて.mp3")}`
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
    expect(buildMysekaiSoundtrackDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://master-api.test",
        assetBaseUrl: "https://assets.internal.test",
        region: "en",
        recordId: 10007
      })
    );
  });

  it("answers 404 for an invalid ID or a missing soundtrack", async () => {
    await expect(request("abc")).rejects.toMatchObject({ status: 404 });
    expect(buildMysekaiSoundtrackDownload).not.toHaveBeenCalled();

    buildMysekaiSoundtrackDownload.mockResolvedValue(null);
    await expect(request("5")).rejects.toMatchObject({ status: 404 });
  });
});
