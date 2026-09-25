import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMusicsByRegionByIdDetail, getMusicsRegionsByIdAvailability } = vi.hoisted(() => ({
  getMusicsByRegionByIdDetail: vi.fn(),
  getMusicsRegionsByIdAvailability: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getMusicsByRegionByIdDetail,
  getMusicsRegionsByIdAvailability
}));

const { getServerI18nText } = vi.hoisted(() => ({ getServerI18nText: vi.fn() }));
vi.mock("$lib/i18n/runtime", () => ({ getServerI18nText }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const { fetchUnitProfiles, toUnitProfileMap } = vi.hoisted(() => ({
  fetchUnitProfiles: vi.fn(),
  toUnitProfileMap: vi.fn()
}));
vi.mock("$lib/server/unit-profiles", () => ({ fetchUnitProfiles, toUnitProfileMap }));

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.example.test" }
}));

import { load } from "./+page.server";

const messages = {
  invalidMusicId: "Invalid music id",
  musicUnavailableInCurrentRegion: "Music unavailable",
  failedToLoadMusicData: "Failed to load music data"
} as const;

describe("music detail page load", () => {
  beforeEach(() => {
    getMusicsByRegionByIdDetail.mockReset();
    getMusicsRegionsByIdAvailability.mockReset();
    getMusicsRegionsByIdAvailability.mockResolvedValue({ data: ["jp"] });
    getServerI18nText.mockReset();
    getServerI18nText.mockImplementation((_locale, key) =>
      Promise.resolve(messages[key as keyof typeof messages])
    );
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    fetchUnitProfiles.mockReset();
    fetchUnitProfiles.mockResolvedValue([]);
    toUnitProfileMap.mockReset();
    toUnitProfileMap.mockReturnValue({});
  });

  it("returns null seo for browsers to keep the streaming path", async () => {
    getMusicsByRegionByIdDetail.mockResolvedValue({ data: {} });

    const pageUrl = new URL("https://viewer.example/music/jp/1");
    const result = (await load({
      params: { region: "jp", id: "1" },
      url: pageUrl,
      request: new Request(pageUrl),
      cookies: { get: () => undefined },
      fetch: vi.fn()
    } as unknown as Parameters<typeof load>[0])) as { seo: null };

    expect(result.seo).toBe(null);
  });

  it("server-renders the embed for Discord's crawler", async () => {
    getMusicsByRegionByIdDetail.mockResolvedValue({
      data: {
        music: {
          id: "1",
          title: "Song title",
          assetbundleName: "jacket-1",
          composer: "Composer",
          creatorArtist: { name: "Artist" }
        },
        difficulties: [{ difficulty: "master", level: 33 }],
        vocals: [],
        tags: []
      }
    });

    const pageUrl = new URL("https://viewer.example/music/jp/1");
    const result = (await load({
      params: { region: "jp", id: "1" },
      url: pageUrl,
      request: new Request(pageUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"
        }
      }),
      cookies: { get: () => undefined },
      fetch: vi.fn()
    } as unknown as Parameters<typeof load>[0])) as {
      seo: {
        title: string;
        imageUrl: string;
        canonicalUrl: string;
        inlineScriptHtml: string;
      } | null;
    };

    expect(result.seo).not.toBe(null);
    expect(result.seo?.title).toBe("Song title");
    expect(result.seo?.canonicalUrl).toBe("https://viewer.example/music/jp/1");
    expect(result.seo?.imageUrl).toContain("music/jacket");
    expect(result.seo?.inlineScriptHtml).toContain('id="discord:component-embed"');
  });
});
