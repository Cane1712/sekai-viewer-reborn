import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import "$lib/icons/mdi";
import type { CharacterRankReference } from "$lib/domain/mission";
import type { TitlePreview } from "$lib/domain/title-preview";
import CharacterRankCard from "./CharacterRankCard.svelte";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const t = (_key: string, fallback: string): string => fallback;

const rank = (
  characterRank: number,
  title: { level: number; name?: string; rarity?: string } | null
): CharacterRankReference => ({
  characterRank,
  powerBonusRate: 0.1,
  rewards: [
    {
      id: 1000 + characterRank,
      resourceBoxPurpose: "character_rank_reward",
      resourceBoxType: "expand",
      details: [
        {
          resourceBoxId: 1000 + characterRank,
          resourceBoxPurpose: "character_rank_reward",
          resourceId: title === null ? null : 1,
          resourceLevel: title?.level ?? null,
          resourceQuantity: title === null ? 100 : 1,
          resourceType: title === null ? "jewel" : "honor",
          seq: 1,
          resourceName: title?.name ?? null,
          resourceRarity: title?.rarity ?? null
        }
      ]
    }
  ]
});

const preview: TitlePreview = {
  kind: "honor",
  id: 1,
  name: "Ichika fan",
  rarity: "low",
  subtitle: "Ichika fan",
  degree: { kind: "normal", assetBundleName: "honor_0001", rarity: "low", level: 2 },
  levels: [
    { level: 1, description: "Reach character rank 5" },
    { level: 2, description: "Reach character rank 10" }
  ]
};

describe("CharacterRankCard title rewards", () => {
  it("shows a title reward as its rarity icon and previews the title on click", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(preview), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    render(CharacterRankCard, {
      ranks: Promise.resolve({
        items: [
          rank(1, null),
          rank(2, null),
          rank(5, { level: 1, name: "Ichika fan", rarity: "low" }),
          rank(10, { level: 2, name: "Ichika fan", rarity: "low" })
        ],
        loadFailed: false
      }),
      region: "jp",
      locale: "en",
      t
    });

    const titles = await screen.findAllByRole("button", { name: "Ichika fan ×1" });
    expect(titles).toHaveLength(2);
    expect(titles[1]?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(titles[1]?.querySelector("img")?.getAttribute("src")).toMatch(
      /thumbnail\/common_material\/honor_1\.webp$/
    );

    await fireEvent.click(titles[1]!);
    expect(fetchMock).toHaveBeenCalledWith("/honors/jp/preview/honor/1?level=2");
    const dialog = screen
      .getAllByRole("dialog", { hidden: true })
      .find((node) => (node as HTMLDialogElement).open)!;
    expect(await within(dialog).findByRole("img", { name: "Ichika fan" })).toBeTruthy();
    expect(within(dialog).getByText("Low")).toBeTruthy();
    const rewarded = within(dialog).getByRole("rowheader", { name: "2" }).closest("tr");
    expect(rewarded?.getAttribute("aria-current")).toBe("true");
    expect(rewarded?.textContent).toContain("Reach character rank 10");
    expect(
      within(dialog)
        .getByRole("rowheader", { name: "1" })
        .closest("tr")
        ?.hasAttribute("aria-current")
    ).toBe(false);
  });

  it("names a title reward by its type when the API gives no name", async () => {
    render(CharacterRankCard, {
      ranks: Promise.resolve({
        items: [rank(1, null), rank(2, null), rank(5, { level: 1 })],
        loadFailed: false
      }),
      region: "jp",
      locale: "en",
      t
    });

    expect(await screen.findByRole("button", { name: "Title ×1" })).toBeTruthy();
  });
});
