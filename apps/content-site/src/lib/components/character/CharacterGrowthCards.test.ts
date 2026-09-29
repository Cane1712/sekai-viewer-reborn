import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import "$lib/icons/mdi";
import type { CharacterRankReference, Mission } from "$lib/domain/mission";
import CharacterMissionsCard from "./CharacterMissionsCard.svelte";
import CharacterRankCard from "./CharacterRankCard.svelte";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const text = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, " ").trim() ?? "";

const t = (_key: string, fallback: string): string => fallback;

const rank = (
  characterRank: number,
  rewards: [string, number][],
  powerBonusRate = 0.1
): CharacterRankReference => ({
  characterRank,
  powerBonusRate,
  rewards: [
    {
      id: characterRank,
      resourceBoxPurpose: "character_rank_reward",
      resourceBoxType: "expand",
      details: rewards.map(([resourceType, resourceQuantity], index) => ({
        resourceBoxId: characterRank,
        resourceBoxPurpose: "character_rank_reward",
        resourceId: null,
        resourceLevel: null,
        resourceQuantity,
        resourceType,
        seq: index + 1
      }))
    }
  ]
});

const mission = (id: number, type: string, sentence: string): Mission => ({
  id,
  family: "characterMissionV2s",
  characterId: 1,
  characterMissionType: type,
  eventId: null,
  isAchievementMission: true,
  normalMissionType: null,
  parameterGroup: {
    id,
    levels: [{ seq: 1, requirement: 10, exp: 1, quantity: 0 }],
    lastLevel: { seq: 140, requirement: 50000, exp: 1, quantity: 0 },
    totalLevels: 140
  },
  parameterGroupId: id,
  progressSentence: null,
  requirement: null,
  resourceBoxId: null,
  rewards: [],
  sentence,
  seq: id,
  storyMissionType: null
});

describe("CharacterRankCard", () => {
  const ranks = [
    rank(1, [["jewel", 100]]),
    rank(2, [["jewel", 100]]),
    rank(3, [["jewel", 100]]),
    rank(5, [
      ["honor", 1],
      ["jewel", 300]
    ]),
    rank(8, [["stamp", 1]], 5)
  ].map((item) => ({
    ...item,
    totalExp: [0, 1, 2, 7, 18][[1, 2, 3, 5, 8].indexOf(item.characterRank!)]
  }));

  it("summarizes totals and shows milestone ranks until every rank is requested", async () => {
    render(CharacterRankCard, {
      ranks: Promise.resolve({ items: ranks, loadFailed: false }),
      region: "jp",
      locale: "en",
      t
    });

    expect(await screen.findByText("5 ranks · Max power bonus +5%")).toBeTruthy();
    const totals = screen.getByLabelText("Rewards across all ranks");
    const totalPairs = Array.from(totals.querySelectorAll("dt"), (term) => [
      text(term),
      text(term.nextElementSibling)
    ]);
    expect(totalPairs).toContainEqual(["Crystals", "Crystals ×600"]);
    expect(totalPairs.map(([name]) => name)).toContain("Stamps");

    expect(screen.getByRole("heading", { name: "Milestone ranks" })).toBeTruthy();
    expect(screen.getByText("Rank 5")).toBeTruthy();
    const rank5Rewards = screen.getByText("Rank 5").closest("li")!.lastElementChild as HTMLElement;
    expect(Array.from(rank5Rewards.children, (reward) => text(reward))).toEqual([
      "Title ×1",
      "Crystals ×300"
    ]);
    // Only honor ranks are milestones; the EXP a rank needs sits under its label.
    expect(text(screen.getByText("Rank 5").parentElement)).toBe("Rank 5 7 EXP total");
    expect(screen.queryByText("Rank 8")).toBeNull();
    expect(screen.queryByText("Rank 1")).toBeNull();

    const milestoneList = screen.getByText("Rank 5").closest("ul")!;
    expect(milestoneList.classList).toContain("columns-[17rem]");

    const toggle = screen.getByRole("button", { name: "Show all 5 ranks" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(toggle);
    expect(screen.getByRole("heading", { name: "All ranks" })).toBeTruthy();
    expect(screen.getByText("Rank 1").closest("ul")!.classList).toContain("columns-[17rem]");
    expect(screen.getByText("Rank 1").closest("li")!.hasAttribute("data-milestone")).toBe(false);
    expect(screen.getByText("Rank 8").closest("li")!.hasAttribute("data-milestone")).toBe(false);
    expect(text(screen.getByText("Rank 8").parentElement)).toBe("Rank 8 18 EXP total");
    expect(screen.getByText("Rank 5").closest("li")!.getAttribute("data-milestone")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Show milestone ranks only" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("keeps the title while loading and reports failures", async () => {
    let resolveRanks!: (value: { items: CharacterRankReference[]; loadFailed: boolean }) => void;
    render(CharacterRankCard, {
      region: "jp",
      ranks: new Promise<{ items: CharacterRankReference[]; loadFailed: boolean }>(
        (resolve) => (resolveRanks = resolve)
      ),
      locale: "en",
      t
    });

    expect(screen.getByRole("heading", { name: "Character Rank" })).toBeTruthy();
    expect(screen.getByRole("status").textContent?.trim()).toBe(
      "Character Rank rewards are loading..."
    );
    resolveRanks({ items: [], loadFailed: true });
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

describe("CharacterMissionsCard", () => {
  it("shows each mission as a card and opens its level goals with rewards", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const page = new URL(String(input), "http://localhost").searchParams.get("page");
      return Promise.resolve(
        new Response(
          JSON.stringify(
            page === "1"
              ? {
                  items: [
                    { seq: 1, requirement: 10, exp: 1, quantity: 0 },
                    { seq: 2, requirement: 20, exp: 2, quantity: 0 }
                  ],
                  pagination: { page: 1, hasNext: true }
                }
              : {
                  items: [
                    {
                      seq: 3,
                      requirement: 50,
                      exp: 0,
                      quantity: 100,
                      reward: { resourceType: "material", resourceQuantity: 100 }
                    }
                  ],
                  pagination: { page: 2, hasNext: false }
                }
          ),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(CharacterMissionsCard, {
      missions: Promise.resolve({
        items: [
          mission(1001, "play_live", "Clear {requirement} lives with Ichika"),
          mission(1101, "play_live_ex", "Clear {requirement} lives with Ichika")
        ],
        loadFailed: false
      }),
      region: "jp",
      locale: "en",
      viewAllHref: "/missions/jp?family=characterMissionV2s&character=1",
      t
    });

    expect(await screen.findByText("2 missions · 280 level goals")).toBeTruthy();
    const cards = screen.getAllByRole("button", { name: /Clear … lives with Ichika/ });
    expect(cards).toHaveLength(2);
    expect(text(cards[1])).toBe("EX Clear … lives with Ichika");
    expect(screen.queryByText(/10 → 50,000/)).toBeNull();
    expect(screen.getByRole("link", { name: "View all (2)" }).getAttribute("href")).toBe(
      "/missions/jp?family=characterMissionV2s&character=1"
    );

    await fireEvent.click(cards[1]!);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByRole("heading").textContent).toContain("Clear … lives with Ichika");
    expect(within(dialog).getByText("140 goals")).toBeTruthy();
    expect(await within(dialog).findByText("Level 3 · 50")).toBeTruthy();
    expect(text(within(dialog).getByText("Level 1 · 10").closest("li"))).toBe(
      "Level 1 · 10 EXP +1"
    );
    expect(text(within(dialog).getByText("Level 2 · 20").closest("li"))).toBe(
      "Level 2 · 20 EXP +2"
    );
    expect(text(within(dialog).getByText("Level 3 · 50").closest("li"))).toBe(
      "Level 3 · 50 Material ×100"
    );
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "/missions/jp/parameter-groups/1101/levels?page=1",
      "/missions/jp/parameter-groups/1101/levels?page=2"
    ]);
  });

  it("previews the first six missions and links to the rest", async () => {
    render(CharacterMissionsCard, {
      missions: Promise.resolve({
        items: Array.from({ length: 8 }, (_, index) =>
          mission(1001 + index, "play_live", `Mission ${index + 1} {requirement}`)
        ),
        loadFailed: false
      }),
      region: "jp",
      locale: "en",
      viewAllHref: "/missions/jp?family=characterMissionV2s&character=1",
      t
    });

    expect(await screen.findByText("8 missions · 1,120 level goals")).toBeTruthy();
    const cards = screen.getAllByRole("button", { name: /^Mission \d/ });
    expect(cards.map((card) => text(card))).toEqual(
      Array.from({ length: 6 }, (_, index) => `Mission ${index + 1} …`)
    );
    const link = screen.getByRole("link", { name: "View all (8)" });
    expect(link.getAttribute("href")).toBe("/missions/jp?family=characterMissionV2s&character=1");
    expect(link.className).toContain("btn-ghost");
    // The link sits in the card header, like the Latest cards "View all".
    expect(link.closest("div")?.querySelector("h2")).toBeTruthy();
  });

  it("shows a skeleton while loading and an error when loading fails", async () => {
    let resolveMissions!: (value: { items: Mission[]; loadFailed: boolean }) => void;
    const { container } = render(CharacterMissionsCard, {
      missions: new Promise<{ items: Mission[]; loadFailed: boolean }>(
        (resolve) => (resolveMissions = resolve)
      ),
      region: "jp",
      locale: "en",
      viewAllHref: "/missions/jp?family=characterMissionV2s&character=1",
      t
    });

    expect(screen.getByRole("status").textContent?.trim()).toBe(
      "Character missions are loading..."
    );
    expect(container.querySelectorAll('ul[aria-hidden="true"] > li')).toHaveLength(6);
    resolveMissions({ items: [], loadFailed: true });
    expect((await screen.findByRole("alert")).textContent?.trim()).toBe(
      "Character missions could not be loaded."
    );
  });
});
