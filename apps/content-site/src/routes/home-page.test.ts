import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { I18nMessages } from "@platform/i18n-runtime";
import { tick } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupportedRegion } from "$lib/domain/regions";
import type { HomeRegionData } from "$lib/server/home-page-data";
import HomePage from "./+page.svelte";
import type { PageData } from "./$types";

const messages: I18nMessages = {
  idLabel: "#",
  "latestData.loadingEvents": "Loading events...",
  "latestData.loadFailed": "Failed to load latest data.",
  "latestData.noData": "No data available.",
  "latestData.title": "Latest Data",
  "latestData.viewAll": "View all",
  "latestData.viewAllSection": "View all {section}",
  "homeNews.error": "Failed to load news.",
  "homeNews.empty": "No news available.",
  "homeNews.loading": "Loading news...",
  "homeNews.title": "News",
  noCurrentEventData: "No current event data.",
  "settings.gameContentRegion": "Preferred Content Region",
  "settings.gameContentRegionDescription": "Select a region."
};

const createRegionData = (region: SupportedRegion): HomeRegionData => ({
  region,
  card: {
    region,
    label: region.toUpperCase(),
    event: null,
    unitProfiles: {},
    error: null
  },
  latestData: {
    region,
    cards: [],
    musics: [],
    gachas: []
  },
  news: { status: "empty" }
});

const createPageData = (): PageData =>
  ({
    initialRegion: "jp",
    initialCard: Promise.resolve(createRegionData("jp").card),
    initialLatestData: Promise.resolve(createRegionData("jp").latestData),
    initialNews: Promise.resolve({ status: "empty" }),
    versionsByRegion: {},
    currentEventLoadFailedMessage: "Failed to load current event.",
    i18nMessages: messages,
    uiLocale: "en",
    preferredRegion: "jp",
    globalNotices: [],
    siteVersion: "test"
  }) as PageData;

const flushEffects = async (): Promise<void> => {
  await Promise.resolve();
  await tick();
  await Promise.resolve();
  await tick();
};

describe("homepage section links", () => {
  it("uses the shared View all control, named after each section", async () => {
    // Any latest item shows the per-section headers instead of the empty state.
    const latestData = {
      ...createRegionData("jp").latestData,
      musics: [{ id: "1", title: "Song", assetBundleName: null, composer: null, publishedAt: null }]
    };
    render(HomePage, {
      data: { ...createPageData(), initialLatestData: Promise.resolve(latestData) } as PageData
    });

    const hrefs = {
      "View all Events": "/events/jp",
      "View all Cards": "/cards/jp",
      "View all Songs": "/musics/jp",
      "View all Gachas": "/gachas/jp",
      "View all News": "/news/jp"
    };
    for (const [name, href] of Object.entries(hrefs)) {
      const link = await screen.findByRole("link", { name });
      expect(link.getAttribute("href")).toBe(href);
      expect(link.textContent?.trim()).toBe("View all");
      expect(link.className).toContain("text-primary");
    }
  });
});

describe("homepage region data loading", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the selected region in error state after a failed request and allows retrying", async () => {
    let rejectFailedRequest: ((reason?: unknown) => void) | undefined;
    const failedRequest = new Promise<Response>((_, reject) => {
      rejectFailedRequest = reject;
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValueOnce(failedRequest);
    render(HomePage, { data: createPageData() });

    await fireEvent.click(screen.getByRole("button", { name: "EN" }));
    await waitFor(() => expect(screen.getByText("Loading events...")).toBeTruthy());

    rejectFailedRequest?.(new Error("request failed"));
    await expect(failedRequest).rejects.toThrow("request failed");
    await waitFor(() => expect(screen.getByText("Failed to load current event.")).toBeTruthy());
    await flushEffects();

    expect(screen.getByText("Failed to load current event.")).toBeTruthy();
    expect(screen.getByText("Failed to load latest data.")).toBeTruthy();
    expect(screen.getByText("Failed to load news.")).toBeTruthy();
    expect(screen.queryByText("Loading events...")).toBeNull();
    expect(screen.queryByText("Loading news...")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/home/en", expect.any(Object));

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(createRegionData("en"))
    } as unknown as Response);

    await fireEvent.click(screen.getByRole("button", { name: "JP" }));
    await fireEvent.click(screen.getByRole("button", { name: "EN" }));

    await waitFor(() => expect(screen.getByText("No current event data.")).toBeTruthy());
    expect(screen.queryByText("Failed to load current event.")).toBeNull();
    expect(screen.queryByText("Failed to load latest data.")).toBeNull();
    expect(screen.queryByText("Failed to load news.")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
