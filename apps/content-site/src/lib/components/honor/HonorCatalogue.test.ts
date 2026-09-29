import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import "$lib/icons/mdi";
import HonorCatalogue, { type HonorCatalogueGroup } from "./HonorCatalogue.svelte";
import type { BondsHonor } from "$lib/domain/honor";
import { toCatalogueBondsHonorDegree, type CatalogueHonorDegree } from "$lib/honor-degree";

const degree = (bundle: string): CatalogueHonorDegree => ({
  main: { kind: "normal", assetBundleName: bundle, rarity: "high", level: 3 },
  sub: { kind: "normal", assetBundleName: bundle, rarity: "high", level: 3 }
});

afterEach(cleanup);

const originalMatchMedia = window.matchMedia;

const setDialogViewport = (matches: boolean): void => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: "(min-width: 768px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  });
};

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia
  });
});

const items: HonorCatalogueGroup[] = [
  {
    key: "10",
    name: "Together on stage",
    degree: degree("group"),
    countLabel: "Honors: 2",
    members: [
      {
        key: "102",
        name: "Gold performer",
        degree: degree("group"),
        levels: [
          { label: "Level 3", description: "Play 300 lives" },
          { label: "Level 1", description: "Play 100 lives" },
          { label: "Honor levels", description: null }
        ]
      },
      {
        key: "101",
        name: "Silver performer",
        degree: degree("silver"),
        levels: [{ label: "Level 2", description: "Play 200 lives" }]
      }
    ]
  },
  {
    key: "20",
    name: "First steps",
    degree: degree("first"),
    countLabel: "Honors: 1",
    members: [
      {
        key: "201",
        name: "First steps",
        degree: degree("first"),
        levels: [{ label: "Level 1", description: "Complete the tutorial" }]
      }
    ]
  }
];

const props = {
  resolveAsset: (bundle: string, resource: string) => `/${bundle}/${resource}`,
  items,
  catalogueKey: "jp:1",
  imageUnavailableLabel: "Image unavailable",
  levelsLabel: "Honor levels",
  closeLabel: "Close",
  resultsLabel: "Honor results",
  homeHref: "/",
  regions: [
    { key: "jp", label: "JP", active: true, href: "/honors/jp" },
    { key: "en", label: "EN", active: false, href: "/honors/en" }
  ],
  labels: {
    title: "Honors",
    home: "Home",
    search: "",
    searchAction: "",
    loading: "Loading honors...",
    empty: "No honors found. Try another region.",
    error: "Honors could not be loaded.",
    retry: "Try again",
    previous: "Previous",
    next: "Next"
  }
};

describe("HonorCatalogue", () => {
  it("shows page identity and labels the results region", () => {
    const { container } = render(HonorCatalogue, props);

    const heading = screen.getByRole("heading", { name: "Honors", level: 1 });
    expect(heading).toBeTruthy();
    // The header region switch already marks the active region; the title does not repeat it.
    expect(screen.getAllByText("JP")).toHaveLength(1);
    expect(
      screen.getByText("JP").closest("[data-region-active]")?.getAttribute("data-region-active")
    ).toBe("true");
    expect(screen.getByRole("region", { name: "Honor results" })).toBeTruthy();
    expect(container.querySelector('[aria-label="Honor results"]')).toBeTruthy();
  });

  it("shows one aggregate card summary and keeps full levels behind the dialog", async () => {
    const { container } = render(HonorCatalogue, {
      ...props,
      items: [
        {
          ...items[0],
          members: items[0].members.map((member) => ({
            ...member,
            variantLabel: member.key === "102" ? "High" : "Middle"
          }))
        }
      ]
    });
    expect(container.querySelector("details")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Together on stage, Honor levels: 4" });
    expect(within(trigger).getAllByText("Honor levels: 4")).toHaveLength(1);
    expect(within(trigger).queryByText("High")).toBeNull();
    expect(within(trigger).queryByText("Middle")).toBeNull();
    expect(within(trigger).queryByText("Gold performer")).toBeNull();
    expect(within(trigger).queryByText("Silver performer")).toBeNull();
    expect(screen.queryByText("Play 300 lives")).toBeNull();
    await fireEvent.click(trigger);
    expect(screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual([
      "High",
      "Middle"
    ]);
    expect(container.querySelector('svg[aria-label="Silver performer"]')).toBeTruthy();
    expect(container.querySelector('image[href="/honor/silver/degree_main.png"]')).toBeTruthy();
    expect(container.querySelectorAll("dt")).toHaveLength(4);
    expect(screen.getByText("Play 200 lives")).toBeTruthy();
  });

  it("renders group identity once and exposes all members and levels only in the dialog", async () => {
    const { container } = render(HonorCatalogue, props);
    expect(screen.getAllByText("Together on stage")).toHaveLength(1);
    expect(container.querySelectorAll("details")).toHaveLength(0);
    const trigger = screen.getByRole("button", { name: "Together on stage, Honor levels: 4" });
    expect(trigger.querySelectorAll('svg[viewBox="0 0 380 80"]')).toHaveLength(1);
    expect(screen.queryByText("Play 300 lives")).toBeNull();
    await fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog)
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent)
    ).toEqual(["Gold performer", "Silver performer"]);
    expect(Array.from(dialog.querySelectorAll("dt"), (node) => node.textContent)).toEqual([
      "Level 3",
      "Level 1",
      "Honor levels",
      "Level 2"
    ]);
    for (const description of ["Play 300 lives", "Play 100 lives", "Play 200 lives"]) {
      expect(within(dialog).getByText(description)).toBeTruthy();
    }
    expect(dialog.querySelectorAll('svg[viewBox="0 0 380 80"]')).toHaveLength(2);
    expect(dialog.querySelector(".overflow-y-auto")).toBeTruthy();
  });

  it("uses an accessible native dialog on desktop and restores trigger focus", async () => {
    setDialogViewport(true);
    render(HonorCatalogue, props);
    const trigger = await screen.findByRole("button", { name: /Together on stage/ });

    expect(document.querySelector("details")).toBeNull();
    expect(trigger.classList).toContain("cursor-pointer");
    expect(trigger.classList).toContain("hover-lift");
    expect(trigger.parentElement?.classList).toContain("lg:grid-cols-3");
    expect(trigger.parentElement?.classList).toContain("2xl:grid-cols-4");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    await fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Together on stage" })).toBeTruthy();
    expect(
      within(dialog)
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent)
    ).toEqual(["Gold performer", "Silver performer"]);
    expect(dialog.querySelector("button button")).toBeNull();

    await fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await fireEvent.click(trigger);
    await fireEvent.click(within(dialog).getByTitle("Close"));
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps full honor levels out of the card and opens the same dialog on mobile", async () => {
    setDialogViewport(false);
    render(HonorCatalogue, props);
    const trigger = screen.getByRole("button", { name: /Together on stage/ });
    expect(trigger).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Play 300 lives")).toBeNull();
    await fireEvent.click(trigger);
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: "Silver performer" })
    ).toBeTruthy();
  });

  it("shows singleton summaries in the card and full level details in the dialog", async () => {
    const { container } = render(HonorCatalogue, props);
    expect(screen.getAllByText("First steps")).toHaveLength(1);
    const trigger = screen.getByRole("button", { name: "First steps, Honor levels: 1" });
    expect(within(trigger).getAllByText("Honor levels: 1")).toHaveLength(1);
    expect(screen.queryByText("Complete the tutorial")).toBeNull();
    await fireEvent.click(trigger);
    expect(within(screen.getByRole("dialog")).getByText("Complete the tutorial")).toBeTruthy();
    expect(container.querySelector("details")).toBeNull();
  });

  it("closes the dialog on page and region changes, not label updates", async () => {
    const { container, rerender } = render(HonorCatalogue, props);
    const trigger = screen.getByRole("button", { name: /Together on stage/ });
    await fireEvent.click(trigger);
    await rerender({ ...props, levelsLabel: "Levels" });
    expect((screen.getByRole("dialog") as HTMLDialogElement).open).toBe(true);
    await rerender({ ...props, catalogueKey: "jp:2" });
    expect((container.querySelector("dialog") as HTMLDialogElement).open).toBe(false);
    await fireEvent.click(screen.getByRole("button", { name: /Together on stage/ }));
    await rerender({ ...props, catalogueKey: "en:2" });
    expect((container.querySelector("dialog") as HTMLDialogElement).open).toBe(false);
    expect(container.querySelector("details")).toBeNull();
  });

  it("preserves region links and page callbacks", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(HonorCatalogue, { ...props, onPrevious, onNext, pageLabel: "Page 2 of 3" });
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe("/honors/en");
    await fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("reserves twelve group panels while loading and disables page navigation", () => {
    const { container } = render(HonorCatalogue, {
      ...props,
      items: [],
      status: "loading",
      onNext: vi.fn()
    });
    expect(screen.getByRole("status").textContent).toBe("Loading honors...");
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"] > .grid')?.children).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
    expect(container.querySelector("details")).toBeNull();
  });

  it("preserves retry and empty feedback without suggesting search", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(HonorCatalogue, { ...props, status: "error", items: [], onRetry });
    expect(screen.getByRole("status").textContent).toContain("Honors could not be loaded.");
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    await rerender({ ...props, status: "ready", items: [] });
    expect(screen.getByRole("status").textContent).toContain(
      "No honors found. Try another region."
    );
    expect(screen.queryByRole("search")).toBeNull();
  });

  it("keeps category navigation visible for an empty filtered result", async () => {
    const onHonorTypeChange = vi.fn();
    const { container } = render(HonorCatalogue, {
      ...props,
      items: [],
      honorTypes: ["event", "future_category"],
      selectedHonorType: "event",
      categoryLabel: "Honor category",
      getHonorTypeLabel: (honorType) =>
        honorType === null ? "All honors" : honorType === "event" ? "Events" : "Other honors",
      onHonorTypeChange
    });

    const tablist = screen.getByRole("tablist", { name: "Honor category" });
    const resultsId = within(tablist)
      .getByRole("tab", { name: "Events" })
      .getAttribute("aria-controls");
    expect(screen.getByRole("status").textContent).toBe("No honors found. Try another region.");
    expect(resultsId).toBeTruthy();
    expect(document.getElementById(resultsId!)).toBeTruthy();
    expect(within(tablist).getByRole("tab", { name: "Events" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(within(tablist).getByRole("tab", { name: "Other honors" })).toBeTruthy();
    expect(container.querySelector("details")).toBeNull();

    await fireEvent.click(within(tablist).getByRole("tab", { name: "All honors" }));
    expect(onHonorTypeChange).toHaveBeenCalledWith(null);
  });

  it("keeps the category target mounted while loading and after an error", async () => {
    const { rerender } = render(HonorCatalogue, {
      ...props,
      items: [],
      status: "loading",
      honorTypes: ["event"],
      categoryLabel: "Honor category",
      getHonorTypeLabel: (honorType) => (honorType === null ? "All honors" : "Events"),
      onHonorTypeChange: vi.fn()
    });

    const tab = screen.getByRole("tab", { name: "Events" });
    const resultsId = tab.getAttribute("aria-controls");
    expect(resultsId).toBeTruthy();
    expect(document.getElementById(resultsId!)).toBeTruthy();

    await rerender({
      ...props,
      items: [],
      status: "error",
      honorTypes: ["event"],
      categoryLabel: "Honor category",
      getHonorTypeLabel: (honorType) => (honorType === null ? "All honors" : "Events"),
      onHonorTypeChange: vi.fn()
    });
    expect(document.getElementById(resultsId!)).toBeTruthy();
  });

  it("drops unsubmitted search text when the catalogue changes", async () => {
    const { rerender } = render(HonorCatalogue, { ...props, onSearch: vi.fn() });
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "draft" } });
    expect(input.value).toBe("draft");

    await rerender({ ...props, onSearch: vi.fn(), catalogueKey: "jp:event" });

    expect(input.value).toBe("");
  });

  it("uses one toggle sort control in the shared deck without a combobox", async () => {
    const onSortOrderChange = vi.fn();
    const { container, rerender } = render(HonorCatalogue, {
      ...props,
      onSearch: vi.fn(),
      honorTypes: ["event"],
      categoryLabel: "Honor category",
      getHonorTypeLabel: (honorType) => (honorType === null ? "All honors" : "Events"),
      onHonorTypeChange: vi.fn(),
      sortOrder: "asc",
      sortOrderLabel: "Honor ID order",
      sortAscendingLabel: "Ascending",
      sortDescendingLabel: "Descending",
      onSortOrderChange
    });

    const deck = container.querySelector(".content-card-elevated");
    expect(deck).toBeTruthy();
    // Search has its own row, so its width does not depend on the category tabs.
    expect(deck?.classList).not.toContain("lg:flex-row");
    const search = deck?.querySelector('[role="search"]');
    expect(search?.parentElement).toBe(deck);
    expect(search?.classList).toContain("sm:max-w-md");
    expect(search?.querySelector("div.flex")?.classList).not.toContain("flex-wrap");
    const controlsRow = deck?.querySelector('[role="tablist"]')?.parentElement?.parentElement;
    expect(controlsRow?.parentElement).toBe(deck);
    expect(controlsRow?.classList).toContain("lg:flex-row");
    expect(controlsRow?.querySelector('[role="group"]')).toBeTruthy();
    expect(deck?.querySelector('[role="search"]')?.classList).not.toContain(
      "content-card-elevated"
    );
    expect(container.querySelectorAll(".content-card-elevated")).toHaveLength(1);
    expect(deck?.querySelector('[role="tablist"]')).toBeTruthy();
    expect(deck?.querySelector('[role="group"]')).toBeTruthy();
    const sortGroup = deck?.querySelector('[role="group"]');
    expect(sortGroup?.closest("fieldset")?.classList).toContain("flex-row");
    expect(sortGroup?.closest("fieldset")?.getAttribute("aria-label")).toBe("Honor ID order");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Honor ID order", { exact: true })).toBeNull();
    expect(screen.getAllByRole("button", { name: /Honor ID order:/ })).toHaveLength(1);
    const descending = screen.getByRole("button", { name: "Honor ID order: Descending" });
    expect(descending.title).toBe("Honor ID order: Descending");
    expect(descending.classList).toContain("btn-primary");

    await fireEvent.click(descending);
    expect(onSortOrderChange).toHaveBeenCalledWith("desc");

    await rerender({
      ...props,
      onSearch: vi.fn(),
      honorTypes: ["event"],
      categoryLabel: "Honor category",
      getHonorTypeLabel: (honorType) => (honorType === null ? "All honors" : "Events"),
      onHonorTypeChange: vi.fn(),
      sortOrder: "desc",
      sortOrderLabel: "Honor ID order",
      sortAscendingLabel: "Ascending",
      sortDescendingLabel: "Descending",
      onSortOrderChange
    });

    const ascending = screen.getByRole("button", { name: "Honor ID order: Ascending" });
    expect(screen.getAllByRole("button", { name: /Honor ID order:/ })).toHaveLength(1);
    expect(ascending.title).toBe("Honor ID order: Ascending");
    expect(ascending.classList).toContain("btn-primary");

    await fireEvent.click(ascending);
    expect(onSortOrderChange).toHaveBeenLastCalledWith("asc");
  });

  describe("Bonds display options", () => {
    const shihoAndMiku = (id: number, honorRarity: string): BondsHonor => ({
      id,
      bondsGroupId: 10421,
      name: "Shiho and Miku",
      honorRarity,
      levels: [{ level: 1, description: "Reach Kizuna rank 5" }],
      words: [
        {
          id: 1,
          seq: 1,
          assetBundleName: "honorname_0421_default_0421",
          name: "Shiho & Miku fan",
          description: "Reach Kizuna rank 5"
        },
        {
          id: 2,
          seq: 2,
          assetBundleName: "honorname_0421_01",
          name: "Cool at times",
          description: "Reach Kizuna rank 26"
        }
      ],
      units: [
        { id: 4, gameCharacterId: 4, unit: "light_sound", colorCode: "#bbdd22" },
        { id: 21, gameCharacterId: 21, unit: "piapro", colorCode: "#33ccbb" }
      ],
      configurableUnitVirtualSinger: true
    });
    const viewData = { characterUnitIds: { "21:light_sound": 27 }, unitNames: {} };
    const bondsGroup = (outfit: boolean): HonorCatalogueGroup => {
      const honors = [shihoAndMiku(1042101, "low"), shihoAndMiku(1042102, "middle")];
      return {
        key: "bonds-10421",
        name: "Shiho and Miku",
        degree: toCatalogueBondsHonorDegree(honors[0]!),
        countLabel: "Titles: 2",
        bondsView: {
          words: honors[0]!.words.map(({ id, name, description }) => ({
            id,
            name: name ?? "",
            description
          })),
          outfit: outfit ? { defaultLabel: "VIRTUAL SINGER", unitLabel: "Leo/need" } : null
        },
        members: honors.map((honor) => ({
          key: String(honor.id),
          name: "Shiho and Miku",
          variantLabel: honor.honorRarity ?? undefined,
          degree: toCatalogueBondsHonorDegree(honor),
          degreeFor: (view) => toCatalogueBondsHonorDegree(honor, view, viewData),
          levels: [{ label: "Level 1", description: "Reach Kizuna rank 5" }]
        }))
      };
    };
    const openBondsDialog = async (outfit = true) => {
      render(HonorCatalogue, { ...props, items: [bondsGroup(outfit)] });
      await fireEvent.click(screen.getByRole("button", { name: /Shiho and Miku/ }));
      return screen.getByRole("dialog") as HTMLDialogElement;
    };
    // Every drawn title's image names, in paint order, per rarity.
    const titleImages = (dialog: HTMLElement, layer: string) =>
      Array.from(dialog.querySelectorAll('svg[viewBox="0 0 380 80"]'), (svg) =>
        Array.from(svg.querySelectorAll(`image[data-layer^="${layer}"]`), (image) =>
          image.getAttribute("href")?.split("/").pop()
        )
      );

    it("applies the chosen word, outfit, and side to every rarity", async () => {
      const dialog = await openBondsDialog();
      const options = within(dialog).getByRole("group", { name: "Display" });

      expect(titleImages(dialog, "word")).toEqual([
        ["honorname_0421_default_0421_01"],
        ["honorname_0421_default_0421_02"]
      ]);
      expect(titleImages(dialog, "bonds-character")[0]).toEqual(["chr_sd_04_01", "chr_sd_21_01"]);

      const words = within(options).getByRole("radiogroup", { name: "Word" });
      expect(
        within(words)
          .getAllByRole("radio")
          .map((radio) => (radio as HTMLInputElement).checked)
      ).toEqual([true, false]);
      await fireEvent.click(within(words).getByRole("radio", { name: "Cool at times" }));
      expect(titleImages(dialog, "word")).toEqual([
        ["honorname_0421_01_01"],
        ["honorname_0421_01_02"]
      ]);
      expect(within(options).getByText("Reach Kizuna rank 26")).toBeTruthy();

      const outfit = within(options).getByRole("radiogroup", { name: "Virtual Singer outfit" });
      expect(
        within(outfit)
          .getAllByRole("radio")
          .map((radio) => (radio as HTMLInputElement).checked)
      ).toEqual([true, false]);
      await fireEvent.click(within(outfit).getByRole("radio", { name: "Leo/need" }));
      expect(titleImages(dialog, "bonds-character")[1]).toEqual(["chr_sd_04_01", "chr_sd_27_01"]);

      await fireEvent.click(within(options).getByRole("checkbox", { name: "Swap sides" }));
      expect(titleImages(dialog, "bonds-character")[1]).toEqual(["chr_sd_27_01", "chr_sd_04_01"]);
    });

    it("opens each pair with the default display", async () => {
      const dialog = await openBondsDialog();
      const options = within(dialog).getByRole("group", { name: "Display" });
      await fireEvent.click(within(options).getByRole("radio", { name: "Cool at times" }));
      await fireEvent.click(within(options).getByRole("checkbox", { name: "Swap sides" }));
      await fireEvent.keyDown(dialog, { key: "Escape" });

      await fireEvent.click(screen.getByRole("button", { name: /Shiho and Miku/ }));

      expect(
        (within(dialog).getByRole("radio", { name: "Shiho & Miku fan" }) as HTMLInputElement)
          .checked
      ).toBe(true);
      expect(
        (within(dialog).getByRole("checkbox", { name: "Swap sides" }) as HTMLInputElement).checked
      ).toBe(false);
      expect(titleImages(dialog, "word")[0]).toEqual(["honorname_0421_default_0421_01"]);
    });

    it("leaves out the outfit option when the pair has none", async () => {
      const dialog = await openBondsDialog(false);

      expect(
        within(dialog).queryByRole("radiogroup", { name: "Virtual Singer outfit" })
      ).toBeNull();
      expect(within(dialog).getByRole("radiogroup", { name: "Word" })).toBeTruthy();
      expect(within(dialog).getByRole("checkbox", { name: "Swap sides" })).toBeTruthy();
    });

    it("shows no display options for regular titles", async () => {
      render(HonorCatalogue, props);
      await fireEvent.click(screen.getByRole("button", { name: /Together on stage/ }));

      expect(
        within(screen.getByRole("dialog")).queryByRole("group", { name: "Display" })
      ).toBeNull();
    });
  });
});
