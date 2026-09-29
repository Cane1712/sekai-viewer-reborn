import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mission, MissionCharacterOption, MissionFamily } from "$lib/domain/mission";
import "$lib/icons/mdi";
import MissionsPage from "./+page.svelte";

const { goto, invalidateAll } = vi.hoisted(() => ({
  goto: vi.fn(),
  invalidateAll: vi.fn()
}));
vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$app/navigation", () => ({ goto, invalidateAll }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const makeMission = (family: MissionFamily, id: number, sentence: string | null): Mission => ({
  id,
  family,
  characterId: null,
  characterMissionType: null,
  eventId: null,
  isAchievementMission: null,
  normalMissionType: null,
  parameterGroup: null,
  parameterGroupId: null,
  progressSentence: null,
  requirement: id,
  resourceBoxId: null,
  rewards: [],
  sentence,
  seq: id,
  storyMissionType: null
});

const rewardOf = (resourceType: string, resourceQuantity: number): Mission["rewards"][number] => ({
  id: null,
  missionId: null,
  missionType: null,
  resourceBox: {
    id: 1,
    resourceBoxPurpose: "mission_reward",
    resourceBoxType: "expand",
    details: [
      {
        resourceBoxId: 1,
        resourceBoxPurpose: "mission_reward",
        resourceId: null,
        resourceLevel: null,
        resourceQuantity,
        resourceType,
        seq: 1
      }
    ]
  },
  resourceBoxId: 1,
  resourceBoxIds: [],
  resourceBoxPurpose: "mission_reward",
  resourceId: null,
  resourceLevel: null,
  resourceQuantity: null,
  resourceType: null,
  seq: 1,
  status: "resolved"
});

type PageData = ComponentProps<typeof MissionsPage>["data"];
type Catalogue = Awaited<NonNullable<PageData["catalogue"]>>;
type SuccessfulCatalogue = Extract<Catalogue, { loadFailed: false }>;
type FamilyOverview = PageData["familyOverviews"][number];

type StoryLadder = { story: { items: Mission[]; loadFailed: boolean } };

type CharacterPicker = {
  characters: { items: MissionCharacterOption[]; loadFailed: boolean };
};

const defaultCharacters: MissionCharacterOption[] = [
  { id: 1, name: "Ichika Hoshino", unit: "light_sound", unitName: "Leo/need" },
  { id: 2, name: "Saki Tenma", unit: "light_sound", unitName: "Leo/need" },
  { id: 21, name: "Hatsune Miku", unit: "piapro", unitName: "VIRTUAL SINGER" }
];

const data = (
  catalogue: Catalogue | FamilyOverview[] | StoryLadder | CharacterPicker,
  family: MissionFamily | null = null,
  region: PageData["region"] = "jp",
  // Character Missions list a catalogue only once a character is chosen.
  character: number | null = family === "characterMissionV2s" && !("characters" in catalogue)
    ? 1
    : null
): PageData => ({
  region,
  query: { family, character },
  ...(Array.isArray(catalogue)
    ? { catalogue: null, familyOverviews: catalogue, storyMissions: null }
    : "story" in catalogue
      ? { catalogue: null, familyOverviews: [], storyMissions: Promise.resolve(catalogue.story) }
      : "characters" in catalogue
        ? { catalogue: null, familyOverviews: [], storyMissions: null }
        : { catalogue: Promise.resolve(catalogue), familyOverviews: [], storyMissions: null }),
  uiLocale: "en",
  preferredRegion: region,
  globalNotices: [],
  siteVersion: "test",
  i18nMessages: {
    "navigation.missions": "Missions",
    home: "Home",
    "mission.familyLabel": "Mission family",
    "mission.family.all": "All missions",
    "mission.family.storyMissions": "Story missions",
    "mission.family.characterMissionV2s": "Character missions",
    "mission.family.normalMissions": "Normal missions",
    "mission.browseFamily": "View all {family}",
    "mission.loading": "Loading missions...",
    "mission.loadingMore": "Loading more missions...",
    "mission.loadMore": "Load more missions",
    "mission.loadMoreError": "More missions could not be loaded.",
    "mission.empty": "No missions found. Try another region.",
    "mission.error": "Missions could not be loaded.",
    "mission.retry": "Try again",
    "mission.rewards": "Rewards",
    "mission.reward": "Reward",
    "mission.storyUnnamed": "Story mission #{id}",
    "mission.targetUnavailable": "Target data unavailable for this region",
    "mission.unnamed": "Mission",
    "mission.requirement": "Target: {count}",
    "mission.targetLevel": "Level {level} · {count}",
    "mission.shownCount": "{count} missions shown",
    "mission.totalCount": "{count} missions",
    "mission.totalCountOne": "1 mission",
    "mission.totalUnavailable": "Total unavailable",
    "mission.resource.coin": "Coins",
    "mission.resource.jewel": "Crystals",
    "mission.resource.material": "Material",
    "mission.resource.honor": "Honor",
    "mission.resource.bonds_honor": "Bonds honor",
    "mission.resource.virtual_coin": "Virtual coins"
  }
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Serves the picker's character list endpoint and passes every other request to the
// fetch a test already stubbed.
const stubCharacterList = (characters: CharacterPicker["characters"]) => {
  const next = globalThis.fetch;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    String(input) === "/missions/jp/characters"
      ? Promise.resolve(
          characters.loadFailed ? json({ error: true }, 500) : json({ items: characters.items })
        )
      : init === undefined
        ? next(input)
        : next(input, init)
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const characterListCalls = (fetchMock: ReturnType<typeof stubCharacterList>): number =>
  fetchMock.mock.calls.filter(([input]) => String(input) === "/missions/jp/characters").length;

const renderPage = (
  catalogue: Catalogue | FamilyOverview[] | StoryLadder | CharacterPicker,
  family: MissionFamily | null = null,
  character?: number | null
) => {
  if (family === "characterMissionV2s") {
    stubCharacterList(
      "characters" in catalogue
        ? catalogue.characters
        : { items: defaultCharacters, loadFailed: false }
    );
  }
  return render(MissionsPage, {
    data: data(catalogue, family, "jp", character),
    params: { region: "jp" },
    form: null
  });
};

const page = (
  items: Mission[],
  pagination: { page: number; hasNext: boolean }
): SuccessfulCatalogue => ({
  items,
  pagination: {
    ...pagination,
    pageSize: 24,
    total: null,
    totalPages: null
  },
  loadFailed: false
});

describe("Missions page", () => {
  it("keeps one family in the URL state and preserves it across regions", async () => {
    const normal = makeMission("normalMissions", 1, "Play a live");
    renderPage(page([normal], { page: 1, hasNext: false }), "normalMissions");

    const tablist = await screen.findByRole("tablist", { name: "Mission family" });
    expect(withinTab(tablist, "Normal").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Play a live")).toBeTruthy();
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe(
      "/missions/en?family=normalMissions"
    );

    await fireEvent.click(withinTab(tablist, "All"));
    expect(goto).toHaveBeenLastCalledWith("/missions/jp", { keepFocus: true, noScroll: true });
  });

  it("appends and de-duplicates later pages for a selected family", async () => {
    const firstNormal = makeMission("characterMissionV2s", 1, "First normal");
    const secondNormal = makeMission("characterMissionV2s", 2, "Second normal");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [firstNormal, secondNormal, secondNormal],
          pagination: { page: 2, hasNext: false }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    renderPage(page([firstNormal], { page: 1, hasNext: true }), "characterMissionV2s");
    await screen.findByText("First normal");
    await fireEvent.click(screen.getByRole("button", { name: "Load more missions" }));

    expect(screen.getAllByText("First normal")).toHaveLength(1);
    expect(await screen.findByText("Second normal")).toBeTruthy();
    expect(screen.getAllByText("Second normal")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/missions/jp/data?page=2&family=characterMissionV2s&character=1"
    );
    expect(screen.queryByRole("button", { name: "Load more missions" })).toBeNull();
  });

  it("shows only the character picker until a character is chosen", async () => {
    renderPage(
      { characters: { items: defaultCharacters, loadFailed: false } },
      "characterMissionV2s"
    );

    expect(
      await screen.findByText("Choose a character to see their character missions.")
    ).toBeTruthy();
    const leoNeed = await screen.findByRole("list", { name: "Leo/need" });
    expect(within(leoNeed).getAllByRole("button")).toHaveLength(2);
    // The character filter has its own card, apart from the family tabs.
    const tabsCard = screen
      .getByRole("tablist", { name: "Mission family" })
      .closest(".content-card-elevated");
    const filterCard = leoNeed.closest(".content-card-elevated");
    expect(filterCard).toBeTruthy();
    expect(filterCard).not.toBe(tabsCard);
    expect(
      Array.from(
        screen.getByRole("tablist", { name: "Mission family" }).querySelectorAll('[role="tab"]'),
        (tab) => tab.textContent?.trim()
      )
    ).toEqual(["All", "Story", "Character", "Normal"]);
    expect(screen.getByRole("list", { name: "VIRTUAL SINGER" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more missions" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change character" })).toBeNull();
    const saki = screen.getByRole("button", { name: "Saki Tenma" });
    expect(saki.getAttribute("aria-pressed")).toBe("false");

    await fireEvent.click(saki);
    expect(goto).toHaveBeenLastCalledWith("/missions/jp?family=characterMissionV2s&character=2", {
      keepFocus: true,
      noScroll: true
    });
  });

  it("marks the chosen character and keeps it across regions", async () => {
    renderPage(
      page([makeMission("characterMissionV2s", 1, "Clear a live with Ichika")], {
        page: 1,
        hasNext: false
      }),
      "characterMissionV2s",
      1
    );

    expect(await screen.findByText("Clear a live with Ichika")).toBeTruthy();
    expect(
      (await screen.findByRole("button", { name: "Ichika Hoshino" })).getAttribute("aria-pressed")
    ).toBe("true");
    // No "Showing" line or profile link under the picker.
    expect(screen.queryByText(/Showing/)).toBeNull();
    expect(screen.queryByRole("link", { name: "View character profile" })).toBeNull();
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe(
      "/missions/en?family=characterMissionV2s&character=1"
    );

    // Small screens collapse the grid to the chosen character's unit and avatar, which
    // reopens it.
    const toggle = screen.getByRole("button", { name: "Change character: Ichika Hoshino" });
    const grid = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.parentElement?.classList).toContain("sm:hidden");
    expect(within(toggle.parentElement!).getByRole("img", { name: "Leo/need" })).toBeTruthy();
    expect(grid.classList).toContain("hidden");
    expect(grid.classList).toContain("sm:grid");
    await fireEvent.click(toggle);
    expect(grid.classList).not.toContain("hidden");
    expect(screen.queryByRole("button", { name: /^Change character/ })).toBeNull();
  });

  it("shows avatars in grey until hovered, focused, or chosen", async () => {
    renderPage(
      page([makeMission("characterMissionV2s", 1, "Clear a live with Ichika")], {
        page: 1,
        hasNext: false
      }),
      "characterMissionV2s",
      1
    );

    const avatarOf = async (name: string) =>
      (await screen.findByRole("button", { name })).firstElementChild as HTMLElement;
    const chosen = await avatarOf("Ichika Hoshino");
    expect(chosen.classList).toContain("grayscale-0");
    expect(chosen.classList).not.toContain("grayscale");
    const other = await avatarOf("Saki Tenma");
    expect(other.classList).toContain("grayscale");
    expect(other.classList).toContain("group-hover:grayscale-0");
    expect(other.classList).toContain("group-focus-visible:grayscale-0");
  });

  it("fetches the character list once per region while switching characters", async () => {
    const view = renderPage(
      page([makeMission("characterMissionV2s", 1, "Clear a live with Ichika")], {
        page: 1,
        hasNext: false
      }),
      "characterMissionV2s",
      1
    );
    const fetchMock = vi.mocked(globalThis.fetch) as ReturnType<typeof stubCharacterList>;
    await screen.findByRole("button", { name: "Saki Tenma" });

    await view.rerender({
      data: data(
        page([makeMission("characterMissionV2s", 2, "Clear a live with Saki")], {
          page: 1,
          hasNext: false
        }),
        "characterMissionV2s",
        "jp",
        2
      ),
      params: { region: "jp" },
      form: null
    });

    expect(await screen.findByText("Clear a live with Saki")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Saki Tenma" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.queryByText("Loading characters...")).toBeNull();
    expect(characterListCalls(fetchMock)).toBe(1);
  });

  it("offers a retry when the character picker fails to load", async () => {
    renderPage({ characters: { items: [], loadFailed: true } }, "characterMissionV2s");

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Characters could not be loaded."
    );
    const fetchMock = stubCharacterList({ items: defaultCharacters, loadFailed: false });
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Saki Tenma" })).toBeTruthy();
    expect(characterListCalls(fetchMock)).toBe(1);
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("shows bounded, count-led previews in All mode as each family arrives", async () => {
    const items = [1, 2, 3, 4].map((id) => makeMission("storyMissions", id, `Story ${id}`));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderPage([
      {
        family: "storyMissions",
        summary: Promise.resolve({ items, total: 120, loadFailed: false })
      },
      { family: "characterMissionV2s", summary: new Promise(() => {}) },
      {
        family: "normalMissions",
        summary: Promise.resolve({ items: [], total: null, loadFailed: true })
      }
    ]);

    expect(await screen.findByRole("button", { name: "View all Story missions" })).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "View all Story missions" }).textContent?.trim()
      ).toBe("View all (120)")
    );
    expect(screen.getByText("Story 1")).toBeTruthy();
    expect(screen.getByText("Story 2")).toBeTruthy();
    expect(screen.getByText("Story 3")).toBeTruthy();
    expect(screen.queryByText("Story 4")).toBeNull();

    const characterSection = screen
      .getByRole("heading", { name: "Character missions" })
      .closest("section")!;
    expect(characterSection.getAttribute("aria-busy")).toBe("true");
    expect(characterSection.textContent).toContain("Loading missions...");

    const normalSection = screen
      .getByRole("heading", { name: /Normal missions/ })
      .closest("section")!;
    expect(normalSection.textContent).toContain("Missions could not be loaded.");
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(invalidateAll).toHaveBeenCalledOnce();

    for (const family of ["Story missions", "Character missions", "Normal missions"]) {
      expect(screen.getByRole("button", { name: `View all ${family}` })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Load more missions" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change character" })).toBeNull();
    expect(screen.queryByText("You have reached the end.")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the page error in All mode only when every family fails", async () => {
    renderPage(
      (["storyMissions", "characterMissionV2s", "normalMissions"] as const).map((family) => ({
        family,
        summary: Promise.resolve({ items: [], total: null, loadFailed: true })
      }))
    );

    expect(await screen.findByText("Missions could not be loaded.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Story missions/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);
  });

  it("shows character missions as cards and opens level goals with rewards in a dialog", async () => {
    const mission = makeMission("characterMissionV2s", 5, "Complete {requirement} tasks");
    mission.characterMissionType = "play_live_ex";
    mission.parameterGroup = {
      id: 9,
      totalLevels: 3,
      levels: [1, 2].map((seq) => ({ seq, requirement: seq * 10, exp: 1, quantity: 0 })),
      lastLevel: { seq: 3, requirement: 50, exp: 0, quantity: 100 }
    };
    const levels = [
      { seq: 1, requirement: 10, exp: 1, quantity: 0 },
      { seq: 2, requirement: 20, exp: 2, quantity: 0 },
      {
        seq: 3,
        requirement: 50,
        exp: 0,
        quantity: 100,
        reward: { resourceType: "material", resourceQuantity: 100 }
      }
    ];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const requestPage = new URL(String(input), "http://localhost").searchParams.get("page");
      return Promise.resolve(
        json({
          items: requestPage === "1" ? levels.slice(0, 2) : levels.slice(2),
          pagination: { page: Number(requestPage), hasNext: requestPage === "1" }
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(page([mission], { page: 1, hasNext: false }), "characterMissionV2s");

    const card = await screen.findByRole("button", { name: /Complete … tasks/ });
    expect(card.textContent?.replace(/\s+/g, " ").trim()).toBe("EX Complete … tasks");
    expect(screen.queryByText(/Level 1/)).toBeNull();

    await fireEvent.click(card);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByText("3 level goals")).toBeTruthy();
    expect(await within(dialog).findByText("Level 3 · 50")).toBeTruthy();
    const row = (label: string) =>
      within(dialog).getByText(label).closest("li")?.textContent?.replace(/\s+/g, " ").trim();
    expect(row("Level 1 · 10")).toBe("Level 1 · 10 EXP +1");
    expect(row("Level 2 · 20")).toBe("Level 2 · 20 EXP +2");
    expect(row("Level 3 · 50")).toBe("Level 3 · 50 Material ×100");
    expect(
      fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes("parameter-groups"))
    ).toEqual([
      "/missions/jp/parameter-groups/9/levels?page=1",
      "/missions/jp/parameter-groups/9/levels?page=2"
    ]);
  });

  it("explains missing level data instead of loading it", async () => {
    const mission = makeMission("characterMissionV2s", 2, "Complete {requirement} tasks");
    mission.parameterGroup = null;
    mission.parameterGroupId = null;
    renderPage(page([mission], { page: 1, hasNext: false }), "characterMissionV2s");

    await fireEvent.click(await screen.findByRole("button", { name: /Complete … tasks/ }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByText("Target data unavailable for this region")).toBeTruthy();
    expect(within(dialog).queryByRole("status")).toBeNull();
  });

  it("shows normal mission text with resolved rewards and no repeated target", async () => {
    const mission = makeMission("normalMissions", 3, "Clear 3 lives");
    mission.rewards = [rewardOf("jewel", 50)];
    renderPage(page([mission], { page: 1, hasNext: false }), "normalMissions");

    expect(await screen.findByText("Clear 3 lives")).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Rewards" }).textContent?.replace(/\s+/g, " ").trim()
    ).toBe("Crystals ×50");
    expect(screen.queryByText("Target: 3")).toBeNull();
  });

  it("renders story missions as a target ladder with reward totals and milestones", async () => {
    const story = [10, 20, 30, 40].map((requirement, index) => {
      const mission = makeMission("storyMissions", index + 1, null);
      mission.requirement = requirement;
      mission.rewards = [requirement === 40 ? rewardOf("jewel", 100) : rewardOf("gacha_ticket", 1)];
      return mission;
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPage({ story: { items: story, loadFailed: false } }, "storyMissions");

    expect(await screen.findByText("4 goals · 10 → 40 episodes")).toBeTruthy();
    expect(
      screen.getByText(
        "Read main and event story episodes to the end without skipping or fast-forwarding. Each goal is reached when your total number of fully read episodes gets there."
      )
    ).toBeTruthy();
    const totals = screen.getByLabelText("Rewards across all goals");
    expect(
      Array.from(totals.querySelectorAll("dt"), (term) => [
        term.textContent?.trim(),
        term.nextElementSibling?.textContent?.replace(/\s+/g, " ").trim()
      ])
    ).toEqual([
      ["Crystals", "Crystals ×100"],
      ["Gacha tickets", "Gacha tickets ×3"]
    ]);
    expect(screen.getByRole("heading", { name: "Milestone goals" })).toBeTruthy();
    expect(screen.getByText("Read 40 episodes")).toBeTruthy();
    expect(screen.queryByText("Read 10 episodes")).toBeNull();
    expect(screen.queryByText(/Story mission #/)).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Show all 4 goals" }));
    expect(screen.getByText("Read 10 episodes")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more missions" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change character" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("previews story missions in All mode by target and reward", async () => {
    const mission = makeMission("storyMissions", 1, null);
    mission.requirement = 10;
    mission.rewards = [rewardOf("gacha_ticket", 1)];
    renderPage([
      {
        family: "storyMissions",
        summary: Promise.resolve({ items: [mission], total: 200, loadFailed: false })
      }
    ]);

    expect(await screen.findByText("Read 10 episodes · Gacha tickets ×1")).toBeTruthy();
  });

  it("shows the localized loading state while fetching the next page", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi
      .fn()
      .mockImplementation(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));
    vi.stubGlobal("fetch", fetchMock);

    renderPage(
      page([makeMission("storyMissions", 1, "First story")], { page: 1, hasNext: true }),
      "storyMissions"
    );
    await screen.findByText("First story");
    await fireEvent.click(screen.getByRole("button", { name: "Load more missions" }));

    expect(screen.getByRole("status").textContent).toContain("Loading more missions...");
    expect(fetchMock).toHaveBeenCalledWith("/missions/jp/data?page=2&family=storyMissions");
    resolveFetch(
      new Response(JSON.stringify({ items: [], pagination: { page: 2, hasNext: false } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    await waitFor(() => expect(screen.queryByText("Loading more missions...")).toBeNull());
    expect(screen.queryByRole("button", { name: "Load more missions" })).toBeNull();
  });
});

const withinTab = (tablist: HTMLElement, name: string): HTMLElement =>
  Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]')).find(
    (tab) => tab.textContent?.trim() === name
  )!;
