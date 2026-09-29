import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Honor, HonorGroup } from "$lib/domain/honor";
import "$lib/icons/mdi";
import HonorsPage from "../../../routes/honors/[region]/+page.svelte";

const { goto, invalidateAll } = vi.hoisted(() => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock("$app/navigation", () => ({ goto, invalidateAll }));
vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.example.test" }
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const honor = (id: number): Honor => ({
  id,
  name: `Variant ${id}`,
  assetBundleName: null,
  group: null,
  groupId: 1,
  honorMissionType: null,
  honorRarity: null,
  honorType: null,
  honorTypeId: null,
  seq: null,
  levels: [
    {
      level: 3,
      description: `Requirement ${id}`,
      assetBundleName: null,
      bonus: null,
      honorId: id,
      honorRarity: null
    },
    {
      level: null,
      description: null,
      assetBundleName: null,
      bonus: null,
      honorId: id,
      honorRarity: null
    }
  ]
});
const group: HonorGroup = {
  id: 1,
  name: "Group identity",
  honorType: "normal",
  backgroundAssetBundleName: "group-art",
  frameName: null,
  honors: [honor(9), honor(2)]
};
type PageData = ComponentProps<typeof HonorsPage>["data"];
const result: Awaited<PageData["catalogue"]> = {
  items: [group],
  bondsItems: [],
  availableHonorTypes: ["achievement", "event"],
  loadFailed: false,
  pagination: { page: 1, totalPages: 3, hasNext: true, pageSize: 24, total: 30 }
};
const data = (
  catalogue: PageData["catalogue"] | Awaited<PageData["catalogue"]>,
  region: PageData["region"] = "jp",
  honorType: string | null = null
): PageData => ({
  region,
  query: { honorType, name: "", sortBy: "id", sortOrder: "asc" },
  catalogue: Promise.resolve(catalogue),
  bondsView: Promise.resolve(null),
  uiLocale: "en",
  preferredRegion: region,
  globalNotices: [],
  siteVersion: "test",
  i18nMessages: {
    "navigation.honors": "Titles",
    home: "Home",
    imageUnavailable: "Image unavailable"
  }
});

describe("Honors page group contract", () => {
  it("composes the first member in the card and individual event ranks in the dialog", async () => {
    const { container } = render(HonorsPage, {
      data: data({
        ...result,
        items: [
          {
            ...group,
            honorType: "event",
            frameName: "event-frame",
            honors: [
              { ...honor(9), assetBundleName: "rank-nine", honorRarity: "high" },
              { ...honor(2), assetBundleName: "rank-two", honorRarity: "middle" }
            ]
          }
        ]
      }),
      params: { region: "jp" },
      form: null
    });
    await screen.findByRole("heading", { name: "Group identity" });
    const trigger = screen.getByRole("button", { name: /Group identity/ });
    expect(trigger.querySelector('[data-layer="rank"]')?.getAttribute("href")).toBe(
      "https://assets.example.test/sekai-jp-assets/honor/rank-nine/rank_main.webp"
    );
    await fireEvent.click(trigger);
    const ranks = Array.from(
      screen.getByRole("dialog").querySelectorAll('[data-layer="rank"]'),
      (node) => node.getAttribute("href")
    );
    expect(ranks).toEqual([
      "https://assets.example.test/sekai-jp-assets/honor/rank-nine/rank_main.webp",
      "https://assets.example.test/sekai-jp-assets/honor/rank-two/rank_main.webp"
    ]);
    expect(container.querySelector("img")).toBeNull();
  });
  it("labels same-name members by localized rarity with name fallbacks", async () => {
    const rarities = ["low", "middle", "high", "highest", "future", null, ""];
    const variants = rarities.map((honorRarity, index) => ({
      ...honor(index + 1),
      name: index < 4 ? "一歌ファン" : `Fallback ${index}`,
      honorRarity
    }));
    const pageData = data({
      ...result,
      items: [{ ...group, name: "一歌ファン", honors: variants }]
    });
    const { container, rerender } = render(HonorsPage, {
      data: pageData,
      params: { region: "jp" },
      form: null
    });
    await screen.findByRole("heading", { name: "一歌ファン", level: 2 });
    await fireEvent.click(screen.getByRole("button", { name: /一歌ファン/ }));
    expect((container.querySelector("dialog") as HTMLDialogElement).open).toBe(true);
    const headings = () =>
      screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings()).toEqual([
      "Low",
      "Middle",
      "High",
      "Highest",
      "Fallback 4",
      "Fallback 5",
      "Fallback 6"
    ]);
    expect(screen.getAllByRole("heading", { name: "一歌ファン" })).toHaveLength(2);
    expect(container.querySelectorAll("dt")).toHaveLength(14);
    for (const member of variants) {
      expect(screen.getByText(`Requirement ${member.id}`)).toBeTruthy();
    }
    await rerender({
      data: {
        ...pageData,
        uiLocale: "ja-JP",
        i18nMessages: {
          "honor.rarity.low": "低",
          "honor.rarity.middle": "中",
          "honor.rarity.high": "高",
          "honor.rarity.highest": "最高"
        }
      }
    });
    await fireEvent.click(screen.getByRole("button", { name: /一歌ファン/ }));
    await waitFor(() =>
      expect(headings()).toEqual([
        "低",
        "中",
        "高",
        "最高",
        "Fallback 4",
        "Fallback 5",
        "Fallback 6"
      ])
    );
    expect(screen.getAllByRole("heading", { name: "一歌ファン" })).toHaveLength(2);
  });

  it("streams full groups without filtering levels and preserves query controls", async () => {
    let complete!: (value: Awaited<PageData["catalogue"]>) => void;
    const pending = new Promise<Awaited<PageData["catalogue"]>>((resolve) => {
      complete = resolve;
    });
    const { container, rerender } = render(HonorsPage, {
      data: data(pending),
      params: { region: "jp" },
      form: null
    });
    expect(screen.getByRole("status").textContent).toContain("Loading titles");
    complete(result);
    await screen.findByText("Group identity");
    expect(screen.getAllByText("Group identity")).toHaveLength(1);
    await fireEvent.click(screen.getByRole("button", { name: /Group identity/ }));
    const dialog = screen.getByRole("dialog");
    expect(Array.from(dialog.querySelectorAll("h3"), (node) => node.textContent)).toEqual([
      "Variant 9",
      "Variant 2"
    ]);
    expect(dialog.querySelectorAll("dt")).toHaveLength(4);
    expect(within(dialog).getByText("Requirement 9")).toBeTruthy();
    expect(within(dialog).getByText("Requirement 2")).toBeTruthy();
    const search = screen.getByRole("search");
    await fireEvent.input(within(search).getByRole("searchbox"), { target: { value: "stage" } });
    await fireEvent.submit(search);
    expect(goto).toHaveBeenLastCalledWith("/honors/jp?name=stage&sort_by=id&sort_order=asc", {
      keepFocus: true,
      noScroll: true
    });
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe(
      "/honors/en?sort_by=id&sort_order=asc"
    );
    await rerender({ data: data(result, "jp") });
    await waitFor(() =>
      expect((container.querySelector("dialog") as HTMLDialogElement).open).toBe(false)
    );
    await fireEvent.click(screen.getByRole("button", { name: /Group identity/ }));
    await rerender({ data: data(result, "en") });
    await waitFor(() =>
      expect((container.querySelector("dialog") as HTMLDialogElement).open).toBe(false)
    );
  });

  it("renders localized server categories and preserves the selected category in URLs", async () => {
    render(HonorsPage, {
      data: data(
        {
          ...result,
          availableHonorTypes: [
            "achievement",
            "birthday",
            "character",
            "event",
            "rank_match",
            "future_category"
          ]
        },
        "jp",
        "event"
      ),
      params: { region: "jp" },
      form: null
    });

    const tablist = await screen.findByRole("tablist", { name: "Title category" });
    expect(
      within(tablist).getByRole("tab", { name: "All titles" }).getAttribute("aria-selected")
    ).toBe("false");
    expect(within(tablist).getByRole("tab", { name: "Events" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(within(tablist).getByRole("tab", { name: "Achievements" })).toBeTruthy();
    expect(within(tablist).getByRole("tab", { name: "Birthdays" })).toBeTruthy();
    expect(within(tablist).getByRole("tab", { name: "Character" })).toBeTruthy();
    expect(within(tablist).getByRole("tab", { name: "Rank Match" })).toBeTruthy();
    expect(within(tablist).getByRole("tab", { name: "Other titles" })).toBeTruthy();
    expect(within(tablist).queryByRole("tab", { name: "future_category" })).toBeNull();

    await fireEvent.click(within(tablist).getByRole("tab", { name: "All titles" }));
    expect(goto).toHaveBeenLastCalledWith("/honors/jp?sort_by=id&sort_order=asc", {
      keepFocus: true,
      noScroll: true
    });
    await fireEvent.click(within(tablist).getByRole("tab", { name: "Achievements" }));
    expect(goto).toHaveBeenLastCalledWith(
      "/honors/jp?honor_type=achievement&sort_by=id&sort_order=asc",
      { keepFocus: true, noScroll: true }
    );
    await fireEvent.click(screen.getByRole("button", { name: "Title ID order: Descending" }));
    expect(goto).toHaveBeenLastCalledWith(
      "/honors/jp?honor_type=event&sort_by=id&sort_order=desc",
      { keepFocus: true, noScroll: true }
    );
  });

  it("keeps handled and rejected stream errors retryable and supports empty groups", async () => {
    const { rerender } = render(HonorsPage, {
      params: { region: "jp" },
      form: null,
      data: data(Promise.resolve({ ...result, loadFailed: true, items: [] }))
    });
    await screen.findByText("Titles could not be loaded. Please try again.");
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(invalidateAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    await rerender({ data: data(Promise.resolve({ ...result, items: [] })) });
    await screen.findByText("No titles found. Try another region.");
    const rejected = Promise.reject(new Error("Failed"));
    rejected.catch(() => {});
    await rerender({ data: data(rejected) });
    await screen.findByText("Titles could not be loaded. Please try again.");
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(invalidateAll).toHaveBeenCalledTimes(2);
  });
});
