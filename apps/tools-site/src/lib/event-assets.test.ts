import { describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/public", () => ({ env: {} }));

import { getEventBannerAssetURL, getHonorAssetURL, getLeaderCardAssetURL } from "./event-assets";

describe("getEventBannerAssetURL", () => {
  it("uses the confirmed regional banner path and bucket", () => {
    expect(getEventBannerAssetURL("event_123", "tw", "https://assets.example.test/")).toBe(
      "https://assets.example.test/sekai-tc-assets/home/banner/event_123/event_123.webp"
    );
  });

  it("does not create a malformed URL without a bundle or asset base", () => {
    expect(getEventBannerAssetURL("", "jp", "https://assets.example.test")).toBeNull();
    expect(getEventBannerAssetURL("event_123", "jp", "")).toBeNull();
  });
});

describe("getHonorAssetURL", () => {
  it.each([
    ["jp", "sekai-jp-assets"],
    ["en", "sekai-en-assets"],
    ["tw", "sekai-tc-assets"],
    ["kr", "sekai-kr-assets"]
  ])("maps %s sprites to the existing WebP bucket", (region, bucket) => {
    expect(
      getHonorAssetURL(" /honor/event_123/ ", "degree_main.png", region, " https://assets.test/// ")
    ).toBe(`https://assets.test/${bucket}/honor/event_123/degree_main.webp`);
    expect(
      getHonorAssetURL("honor_frame/event", "frame_degree_m_3", region, "https://assets.test")
    ).toBe(`https://assets.test/${bucket}/honor_frame/event/frame_degree_m_3.webp`);
  });

  it.each(["icon_degreeLv", "icon_degreeLv6", "frame_degree_m_1", "frame_degree_s_4"])(
    "resolves local %s without remote configuration",
    (sprite) => {
      expect(getHonorAssetURL("local/honor", sprite, "jp", "")).toBe(`/degree/${sprite}.png`);
      expect(getHonorAssetURL("local/honor", `${sprite}.png`, "jp")).toBe(`/degree/${sprite}.png`);
    }
  );

  it("keeps WebP extensions and refuses missing configuration or paths", () => {
    expect(getHonorAssetURL("honor/test", "degree_main.webp", "en", "https://assets.test")).toBe(
      "https://assets.test/sekai-en-assets/honor/test/degree_main.webp"
    );
    expect(getHonorAssetURL("honor/test", "degree_main.png", "jp")).toBeNull();
    expect(
      getHonorAssetURL("honor/test", "degree_main.png", "cn", "https://assets.test")
    ).toBeNull();
    for (const [bundle, sprite] of [
      [null, "main.png"],
      ["honor/test", undefined],
      ["/", "main"],
      ["honor/../test", "main"],
      ["honor/test", "../main.png"],
      ["honor/test", "main.png?x=1"]
    ]) {
      expect(getHonorAssetURL(bundle, sprite, "jp", "https://assets.test")).toBeNull();
    }
  });
});

describe("profile asset URLs", () => {
  it("serves staged Bonds and Live Master sprites locally", () => {
    expect(getHonorAssetURL("local/bonds-honor", "degree_bgBase", "jp", "")).toBe(
      "/degree/bonds/degree_bgBase.png"
    );
    expect(getHonorAssetURL("local/live-master", "live_master_honor_star_1", "jp", "")).toBe(
      "/degree/live-master/live_master_honor_star_1.png"
    );
  });

  it("skips trimmed Bonds art caches like content-site", () => {
    expect(getHonorAssetURL("bonds_honor/word", "word_01.png", "jp", "https://assets.test")).toBe(
      "https://assets.test/sekai-jp-assets/bonds_honor/word/word_01.webp?v=2"
    );
  });

  it("resolves leader card thumbnails and profile art by training state", () => {
    expect(getLeaderCardAssetURL("thumbnail", "res001_no001", true, "tw", "https://a.test/")).toBe(
      "https://a.test/sekai-tc-assets/thumbnail/chara/res001_no001_after_training.webp"
    );
    expect(
      getLeaderCardAssetURL("member-small", "res001_no001", false, "jp", "https://a.test")
    ).toBe("https://a.test/sekai-jp-assets/character/member_small/res001_no001/card_normal.webp");
    expect(getLeaderCardAssetURL("thumbnail", "../x", false, "jp", "https://a.test")).toBeNull();
    expect(getLeaderCardAssetURL("thumbnail", "res001_no001", false, "jp", "")).toBeNull();
  });
});
