import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  getMysekaiMusicRecordsByRegionList: vi.fn(),
  getMysekaiMusicRecordsByRegionFilters: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => sdk);

const tagLib = vi.hoisted(() => {
  const tag = { setTitle: vi.fn(), setArtist: vi.fn(), setAlbum: vi.fn() };
  const file = { tag: () => tag, setPictures: vi.fn(), save: vi.fn() };
  const edit = vi.fn(async (_audio: Uint8Array, apply: (value: typeof file) => void) => {
    apply(file);
    return new Uint8Array([9, 9]);
  });
  return { tag, file, edit };
});
vi.mock("taglib-wasm", () => ({ TagLib: { initialize: async () => ({ edit: tagLib.edit }) } }));
vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.example.test" }
}));

import {
  buildMysekaiSoundtrackDownload,
  findMysekaiSoundtrack
} from "./mysekai-soundtrack-download";

const record = (id: number, categoryId = 2) => ({
  id,
  mysekaiMusicTrackType: "music_sound_track",
  externalId: id,
  soundTrack: {
    id,
    title: `Track ${id}`,
    musicSoundTrackCategoryId: categoryId,
    assetbundleName: `sound/bgm/bgm${id}`,
    assetbundleFileName: `bgm${id}`
  }
});
const listPage = (ids: number[], hasNext: boolean) => ({
  data: { items: ids.map((id) => record(id)), pagination: { has_next: hasNext } }
});

const fetchFn = vi.fn(async (url: string) =>
  url.endsWith(".mp3")
    ? new Response(new Uint8Array([1, 2, 3]))
    : url.endsWith(".webp")
      ? new Response(new Uint8Array([7]))
      : new Response("", { status: 404 })
);
const build = (recordId: number) =>
  buildMysekaiSoundtrackDownload({
    fetchFn: fetchFn as unknown as typeof fetch,
    baseUrl: "https://api.example.test",
    assetBaseUrl: null,
    region: "jp",
    recordId
  });

beforeEach(() => {
  vi.clearAllMocks();
  sdk.getMysekaiMusicRecordsByRegionFilters.mockResolvedValue({
    data: {
      soundTrackCategories: [{ id: 2, name: "Virtual Singers", assetbundleName: "jacket_2" }]
    }
  });
});

describe("findMysekaiSoundtrack", () => {
  it("pages through sound-track records until it finds the record", async () => {
    sdk.getMysekaiMusicRecordsByRegionList
      .mockResolvedValueOnce(listPage([1, 2], true))
      .mockResolvedValueOnce(listPage([3], false));

    await expect(findMysekaiSoundtrack("https://api.example.test", "jp", 3)).resolves.toMatchObject(
      {
        id: 3
      }
    );
    expect(sdk.getMysekaiMusicRecordsByRegionList).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: { page: 2, page_size: 100, track_type: "music_sound_track" }
      })
    );
  });

  it("returns null when no page has it and throws when a page fails", async () => {
    sdk.getMysekaiMusicRecordsByRegionList.mockResolvedValueOnce(listPage([1], false));
    await expect(findMysekaiSoundtrack("https://api.example.test", "jp", 5)).resolves.toBeNull();

    sdk.getMysekaiMusicRecordsByRegionList.mockResolvedValueOnce({ error: {} });
    await expect(findMysekaiSoundtrack("https://api.example.test", "jp", 5)).rejects.toThrow();
  });
});

describe("buildMysekaiSoundtrackDownload", () => {
  it("tags the title, the category as artist and album, and the jacket", async () => {
    sdk.getMysekaiMusicRecordsByRegionList.mockResolvedValue(listPage([10007], false));

    const download = await build(10007);

    expect(download).toEqual({ title: "Track 10007", body: new Uint8Array([9, 9]) });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://assets.example.test/sekai-jp-assets/sound/bgm/bgm10007/bgm10007.mp3"
    );
    expect(tagLib.tag.setTitle).toHaveBeenCalledWith("Track 10007");
    expect(tagLib.tag.setArtist).toHaveBeenCalledWith("Virtual Singers");
    expect(tagLib.tag.setAlbum).toHaveBeenCalledWith("Virtual Singers");
    expect(tagLib.file.setPictures).toHaveBeenCalledWith([
      expect.objectContaining({ data: new Uint8Array([7]), type: "FrontCover" })
    ]);
  });

  it("returns null for a missing record or unavailable audio", async () => {
    sdk.getMysekaiMusicRecordsByRegionList.mockResolvedValue(listPage([], false));
    await expect(build(1)).resolves.toBeNull();

    sdk.getMysekaiMusicRecordsByRegionList.mockResolvedValue(listPage([1], false));
    fetchFn.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(build(1)).resolves.toBeNull();
  });

  it("sends the untagged audio when tagging fails, without a category or cover", async () => {
    sdk.getMysekaiMusicRecordsByRegionList.mockResolvedValue(listPage([1], false));
    sdk.getMysekaiMusicRecordsByRegionFilters.mockResolvedValue({ error: {} });
    tagLib.edit.mockRejectedValueOnce(new Error("bad mp3"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(build(1)).resolves.toEqual({
      title: "Track 1",
      body: new Uint8Array([1, 2, 3])
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
