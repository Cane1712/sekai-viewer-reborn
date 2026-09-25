import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCardsByRegionByIdDetail, getCardsRegionsByIdAvailability } = vi.hoisted(() => ({
  getCardsByRegionByIdDetail: vi.fn(),
  getCardsRegionsByIdAvailability: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCardsByRegionByIdDetail,
  getCardsRegionsByIdAvailability
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
  invalidCardId: "Invalid card id",
  cardUnavailableInCurrentRegion: "Card unavailable",
  failedToLoadCardData: "Failed to load card data"
} as const;

type CardPageLoadResult = {
  region: string;
  cardPayload: Promise<{
    card: null;
    debugCardJson: null;
    error: string | null;
  }>;
};

const runLoad = (region: string, id: string) =>
  load({
    params: { region, id },
    cookies: { get: () => undefined },
    fetch: vi.fn()
  } as unknown as Parameters<typeof load>[0]);

describe("card detail page load", () => {
  beforeEach(() => {
    getCardsByRegionByIdDetail.mockReset();
    getCardsRegionsByIdAvailability.mockReset();
    getCardsRegionsByIdAvailability.mockResolvedValue({ data: ["jp"] });
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

  it("preserves the invalid-id message and normalizes an unknown region", async () => {
    const result = (await runLoad("invalid", "   ")) as CardPageLoadResult;

    expect(result.region).toBe("jp");
    await expect(result.cardPayload).resolves.toEqual({
      card: null,
      debugCardJson: null,
      error: messages.invalidCardId
    });
    expect(getCardsByRegionByIdDetail).not.toHaveBeenCalled();
  });

  it.each(["error response", "request rejection"] as const)(
    "returns the failed-load message after a detail API %s",
    async (failureMode) => {
      if (failureMode === "error response") {
        getCardsByRegionByIdDetail.mockResolvedValue({ error: new Error("upstream failure") });
      } else {
        getCardsByRegionByIdDetail.mockRejectedValue(new Error("network failure"));
      }

      const result = (await runLoad("invalid", "card-1")) as CardPageLoadResult;

      expect(result.region).toBe("jp");
      await expect(result.cardPayload).resolves.toEqual({
        card: null,
        debugCardJson: null,
        error: messages.failedToLoadCardData
      });
      expect(getCardsByRegionByIdDetail).toHaveBeenCalledWith({
        baseUrl: "https://master-api.test",
        path: { region: "jp", id: "card-1" }
      });
    }
  );
  it("does not report an error when the detail API succeeds", async () => {
    getCardsByRegionByIdDetail.mockResolvedValue({ data: {} });

    const result = (await runLoad("jp", "card-1")) as CardPageLoadResult;

    await expect(result.cardPayload).resolves.toEqual({
      card: null,
      debugCardJson: null,
      error: null
    });
  });

  it("returns null seo for browsers to keep the streaming path", async () => {
    getCardsByRegionByIdDetail.mockResolvedValue({ data: {} });

    const pageUrl = new URL("https://viewer.example/card/jp/card-1");
    const result = (await load({
      params: { region: "jp", id: "card-1" },
      url: pageUrl,
      request: new Request(pageUrl),
      cookies: { get: () => undefined },
      fetch: vi.fn()
    } as unknown as Parameters<typeof load>[0])) as { seo: null };

    expect(result.seo).toBe(null);
  });

  it("server-renders the trained embed for Discord's crawler", async () => {
    getCardsByRegionByIdDetail.mockResolvedValue({
      data: {
        card: {
          id: "1",
          prefix: "Card title",
          assetbundleName: "bundle-1",
          attr: "cool",
          flavorText: "Flavor text",
          cardRarity: { cardRarityType: "rarity_4" },
          character: { firstName: "Hatsune", givenName: "Miku" }
        }
      }
    });

    const pageUrl = new URL("https://viewer.example/card/jp/1?trained=true");
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
      trained: boolean;
      seo: {
        pageTitle: string;
        title: string;
        imageUrl: string;
        canonicalUrl: string;
        componentJson: string;
        inlineScriptHtml: string;
      } | null;
    };

    expect(result.trained).toBe(true);
    expect(result.seo).not.toBe(null);
    expect(result.seo?.title).toBe("Card title");
    expect(result.seo?.canonicalUrl).toBe("https://viewer.example/card/jp/1?trained=true");
    expect(result.seo?.imageUrl).toContain("after_training");
    expect(result.seo?.inlineScriptHtml).toContain('id="discord:component-embed"');

    const payload = JSON.parse(result.seo!.componentJson) as {
      component: { type: number };
    };
    expect(payload.component.type).toBe(17);
    expect(new TextEncoder().encode(result.seo!.componentJson).length).toBeLessThanOrEqual(3000);
  });
});
