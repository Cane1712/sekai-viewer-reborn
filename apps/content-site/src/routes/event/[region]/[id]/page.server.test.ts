import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventDetail, EventRelatedData } from "$lib/domain/event-detail";

const {
  getEventsByRegionByIdDetail,
  getEventsByRegionByIdHonorBonuses,
  getEventsRegionsByIdAvailability
} = vi.hoisted(() => ({
  getEventsByRegionByIdDetail: vi.fn(),
  getEventsByRegionByIdHonorBonuses: vi.fn(),
  getEventsRegionsByIdAvailability: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getEventsByRegionByIdDetail,
  getEventsByRegionByIdHonorBonuses,
  getEventsRegionsByIdAvailability
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
import { DISCORD_SEO_BUDGET_MS } from "$lib/seo/discord-embed";

const messages = {
  invalidEventId: "Invalid event id",
  eventUnavailableInCurrentRegion: "Event unavailable",
  failedToLoadEventData: "Failed to load event data"
} as const;

type EventPageLoadResult = {
  region: string;
  eventPayload: Promise<{
    event: EventDetail | null;
    relatedData: EventRelatedData | null;
    debugEventJson: string | null;
    error: string | null;
  }>;
};

const runLoad = (region: string, id: string) =>
  load({
    params: { region, id },
    cookies: { get: () => undefined },
    fetch: vi.fn()
  } as unknown as Parameters<typeof load>[0]);

describe("event detail page load", () => {
  beforeEach(() => {
    getEventsByRegionByIdDetail.mockReset();
    getEventsByRegionByIdHonorBonuses.mockReset();
    getEventsRegionsByIdAvailability.mockReset();
    getEventsRegionsByIdAvailability.mockResolvedValue({ data: ["jp"] });
    getServerI18nText.mockReset();
    getServerI18nText.mockImplementation((_locale, key) =>
      Promise.resolve(messages[key as keyof typeof messages] ?? `t:${key}`)
    );
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    fetchUnitProfiles.mockReset();
    fetchUnitProfiles.mockResolvedValue([]);
    toUnitProfileMap.mockReset();
    toUnitProfileMap.mockReturnValue({});
  });

  it("preserves the invalid-id message and normalizes an unknown region", async () => {
    const result = (await runLoad("invalid", "   ")) as EventPageLoadResult;

    expect(result.region).toBe("jp");
    await expect(result.eventPayload).resolves.toEqual({
      event: null,
      relatedData: null,
      debugEventJson: null,
      error: messages.invalidEventId
    });
    expect(getEventsByRegionByIdDetail).not.toHaveBeenCalled();
  });

  it.each(["error response", "request rejection"] as const)(
    "returns the failed-load message after a detail API %s",
    async (failureMode) => {
      if (failureMode === "error response") {
        getEventsByRegionByIdDetail.mockResolvedValue({ error: new Error("upstream failure") });
      } else {
        getEventsByRegionByIdDetail.mockRejectedValue(new Error("network failure"));
      }

      const result = (await runLoad("invalid", "event-1")) as EventPageLoadResult;

      expect(result.region).toBe("jp");
      await expect(result.eventPayload).resolves.toEqual({
        event: null,
        relatedData: null,
        debugEventJson: null,
        error: messages.failedToLoadEventData
      });
      expect(getEventsByRegionByIdDetail).toHaveBeenCalledWith({
        baseUrl: "https://master-api.test",
        path: { region: "jp", id: "event-1" }
      });
    }
  );
  it("does not report an error when the detail API succeeds", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({ data: {} });

    const result = (await runLoad("jp", "event-1")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toEqual({
      event: null,
      relatedData: null,
      debugEventJson: null,
      error: null
    });
  });

  it("replaces aggregate honor bonus stubs with the read-only enriched response", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({
      data: {
        event: { id: 123, name: "Event" },
        bonuses: {
          eventHonorBonuses: [{ honorId: 42, bonusRate: 25 }]
        }
      }
    });
    getEventsByRegionByIdHonorBonuses.mockResolvedValue({
      data: {
        items: [
          {
            honorId: 42,
            bonusRate: 25,
            honor: {
              id: 42,
              name: "Event Honor",
              assetbundleName: "honor_bundle",
              group: {
                name: "Event Group",
                honorType: "rank_match",
                backgroundAssetbundleName: "group_background"
              }
            }
          }
        ]
      }
    });

    const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toMatchObject({
      error: null,
      event: { id: "123", title: "Event" },
      relatedData: {
        honorBonusesLoadFailed: false,
        bonuses: {
          honorBonusCount: 1,
          honorBonuses: [
            {
              honorId: 42,
              bonusRate: 25,
              honor: {
                id: 42,
                name: "Event Honor",
                assetBundleName: "honor_bundle",
                group: {
                  name: "Event Group",
                  honorType: "rank_match",
                  backgroundAssetBundleName: "group_background"
                }
              }
            }
          ]
        }
      }
    });
    expect(getEventsByRegionByIdHonorBonuses).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "tw", id: "event-123" }
    });
  });

  it.each(["error response", "request rejection"] as const)(
    "retains safe aggregate honor bonus data when enrichment has a %s",
    async (failureMode) => {
      getEventsByRegionByIdDetail.mockResolvedValue({
        data: {
          event: { id: 123, name: "Event" },
          bonuses: {
            eventHonorBonuses: [{ honorId: 42, bonusRate: 25 }]
          }
        }
      });
      if (failureMode === "error response") {
        getEventsByRegionByIdHonorBonuses.mockResolvedValue({
          error: new Error("upstream failure")
        });
      } else {
        getEventsByRegionByIdHonorBonuses.mockRejectedValue(new Error("network failure"));
      }

      const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

      await expect(result.eventPayload).resolves.toMatchObject({
        error: null,
        relatedData: {
          honorBonusesLoadFailed: true,
          bonuses: {
            honorBonusCount: 1,
            honorBonuses: [{ honorId: 42, bonusRate: 25, honor: null }]
          }
        }
      });
    }
  );

  it("does not request honor bonus enrichment when the aggregate reports no bonuses", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({
      data: {
        event: { id: 123, name: "Event" },
        bonuses: { eventHonorBonuses: [] }
      }
    });

    const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toMatchObject({
      error: null,
      relatedData: {
        honorBonusesLoadFailed: false,
        bonuses: { honorBonusCount: 0 }
      }
    });
    expect(getEventsByRegionByIdHonorBonuses).not.toHaveBeenCalled();
  });

  it("keeps an empty successful enrichment response distinct from a failure", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({
      data: {
        event: { id: 123, name: "Event" },
        bonuses: {
          eventHonorBonuses: [{ honorId: 42, bonusRate: 25 }]
        }
      }
    });
    getEventsByRegionByIdHonorBonuses.mockResolvedValue({ data: { items: [] } });

    const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toMatchObject({
      error: null,
      relatedData: {
        honorBonusesLoadFailed: false,
        bonuses: {
          honorBonusCount: 1,
          honorBonuses: [{ honorId: 42, bonusRate: 25, honor: null }]
        }
      }
    });
  });

  it("marks malformed successful enrichment data unavailable and preserves aggregate bonuses", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({
      data: {
        event: { id: 123, name: "Event" },
        bonuses: {
          eventHonorBonuses: [{ honorId: 42, bonusRate: 25 }]
        }
      }
    });
    getEventsByRegionByIdHonorBonuses.mockResolvedValue({ data: "invalid response" });

    const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toMatchObject({
      error: null,
      relatedData: {
        honorBonusesLoadFailed: true,
        bonuses: {
          honorBonusCount: 1,
          honorBonuses: [{ honorId: 42, bonusRate: 25, honor: null }]
        }
      }
    });
  });

  it("server-renders the embed for Discord's crawler", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({
      data: {
        event: {
          id: "1",
          name: "Event title",
          assetbundleName: "event-1",
          unitName: "Leo/need",
          eventType: "marathon"
        }
      }
    });

    const pageUrl = new URL("https://viewer.example/event/jp/1");
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
    expect(result.seo?.title).toBe("Event title");
    expect(result.seo?.canonicalUrl).toBe("https://viewer.example/event/jp/1");
    expect(result.seo?.imageUrl).toContain("home/banner");
    expect(result.seo?.inlineScriptHtml).toContain('id="discord:component-embed"');
  });

  describe("crawler fallback", () => {
    const DISCORD_UA = "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)";

    type CrawlerResult = EventPageLoadResult & {
      seo: { inlineScriptHtml: string } | null;
      availableRegions: Promise<string[]>;
    };

    const runCrawlerLoad = (id: string, userAgent = DISCORD_UA) => {
      const pageUrl = new URL(`https://viewer.example/event/jp/${id}`);
      return load({
        params: { region: "jp", id },
        url: pageUrl,
        request: new Request(pageUrl, { headers: { "user-agent": userAgent } }),
        cookies: { get: () => undefined },
        fetch: vi.fn()
      } as unknown as Parameters<typeof load>[0]) as Promise<CrawlerResult>;
    };

    const eventResponse = {
      data: {
        event: {
          id: "1",
          name: "Event title",
          assetbundleName: "event-1",
          unitName: "Leo/need",
          eventType: "marathon"
        }
      }
    };

    it("keeps the invalid-id message for a crawler with an empty id", async () => {
      const result = await runCrawlerLoad("   ");

      expect(result.seo).toBe(null);
      await expect(result.eventPayload).resolves.toEqual({
        event: null,
        relatedData: null,
        debugEventJson: null,
        error: messages.invalidEventId
      });
      await expect(result.availableRegions).resolves.toEqual(["jp"]);
      expect(getEventsByRegionByIdDetail).not.toHaveBeenCalled();
      expect(getEventsRegionsByIdAvailability).not.toHaveBeenCalled();
    });

    it("still resolves the real payload when the embed misses its time budget", async () => {
      vi.useFakeTimers();
      try {
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        getEventsByRegionByIdDetail.mockReturnValue(gate.then(() => eventResponse));

        const pending = runCrawlerLoad("1");
        await vi.advanceTimersByTimeAsync(DISCORD_SEO_BUDGET_MS + 100);
        const result = await pending;

        expect(result.seo).toBe(null);

        release();
        const payload = await result.eventPayload;
        expect(payload.error).toBe(null);
        expect(payload.event?.title).toBe("Event title");
        expect(getEventsByRegionByIdDetail).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("uses the localized open label and omits the component for non-Discord crawlers", async () => {
      getEventsByRegionByIdDetail.mockResolvedValue(eventResponse);

      const discord = await runCrawlerLoad("1");
      const twitter = await runCrawlerLoad("1", "Twitterbot/1.0");

      expect(discord.seo?.inlineScriptHtml).toContain("t:discordEmbedOpen");
      expect(twitter.seo).not.toBe(null);
      expect(twitter.seo?.inlineScriptHtml).toBe("");
    });
  });
});
