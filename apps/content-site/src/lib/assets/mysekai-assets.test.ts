import { describe, expect, it, vi } from "vitest";
import {
  getMysekaiFixtureThumbnailURL,
  getMysekaiMaterialIconURL,
  getMysekaiSoundTrackAudioURL,
  getMysekaiSoundTrackJacketURL,
  getStampImageURL
} from "./index";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.example.test" }
}));

const jp = "https://assets.example.test/sekai-jp-assets";

describe("MySekai asset URLs", () => {
  it("reads fixture thumbnails from the JP server", () => {
    expect(
      getMysekaiFixtureThumbnailURL({
        assetbundleName: "mdl_mis0001_fixture_table1",
        mysekaiFixtureType: "normal",
        mysekaiSettableLayoutType: "floor"
      })
    ).toBe(`${jp}/mysekai/thumbnail/fixture/mdl_mis0001_fixture_table1_1.webp`);
  });

  it("shows wallpapers and flooring as their texture swatch", () => {
    expect(
      getMysekaiFixtureThumbnailURL({
        assetbundleName: "mis0001",
        mysekaiFixtureType: "surface_appearance",
        mysekaiSettableLayoutType: "wall_appearance"
      })
    ).toBe(`${jp}/mysekai/thumbnail/surface_appearance/mis0001/tex_mis0001_wall_appearance_1.webp`);
  });

  it("trims surrounding slashes from bundle names", () => {
    expect(getMysekaiMaterialIconURL("//item_wood_1/")).toBe(
      `${jp}/mysekai/thumbnail/material/item_wood_1.webp`
    );
    expect(getMysekaiMaterialIconURL(" /// ")).toBeNull();
  });

  it("returns null without a bundle name", () => {
    expect(getMysekaiFixtureThumbnailURL({ assetbundleName: " " })).toBeNull();
    expect(getMysekaiMaterialIconURL(undefined)).toBeNull();
    expect(getMysekaiSoundTrackJacketURL(null)).toBeNull();
    expect(getMysekaiSoundTrackAudioURL(undefined, "bgm")).toBeNull();
  });

  it("builds material icons, sound-track jackets, and audio", () => {
    expect(getMysekaiMaterialIconURL("item_wood_1")).toBe(
      `${jp}/mysekai/thumbnail/material/item_wood_1.webp`
    );
    expect(getMysekaiSoundTrackJacketURL("jacket_s_soundtrack_1")).toBe(
      `${jp}/mysekai/music_record_soundtrack/jacket/jacket_s_soundtrack_1.webp`
    );
    expect(getMysekaiSoundTrackAudioURL("mysekai/sound/bgm/music0001", "music0001")).toBe(
      `${jp}/mysekai/sound/bgm/music0001/music0001.mp3`
    );
    // Without a file name, the bundle's last segment names the file.
    expect(getMysekaiSoundTrackAudioURL("sound/scenario/bgm/bgm00036", null)).toBe(
      `${jp}/sound/scenario/bgm/bgm00036/bgm00036.mp3`
    );
  });
});

describe("stamp image URLs", () => {
  it("names the image by the stamp's own bundle on the region's server", () => {
    expect(getStampImageURL("stamp0038", "tw")).toBe(
      "https://assets.example.test/sekai-tc-assets/stamp/stamp0038/stamp0038.webp"
    );
    expect(getStampImageURL(" /stamp0941/ ")).toBe(`${jp}/stamp/stamp0941/stamp0941.webp`);
    expect(getStampImageURL(null)).toBeNull();
    expect(getStampImageURL("  ")).toBeNull();
  });
});
