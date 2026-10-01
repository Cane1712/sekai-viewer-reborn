import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import RewardItem from "./RewardItem.svelte";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));

afterEach(cleanup);

describe("RewardItem", () => {
  it("shows a game icon with its quantity and names it in the tooltip and label", () => {
    const { container } = render(RewardItem, {
      detail: { resourceType: "jewel", resourceId: null },
      region: "jp",
      label: "Crystals",
      quantityLabel: "×100"
    });

    const item = screen.getByRole("img", { name: "Crystals ×100" });
    expect(item.getAttribute("data-tip")).toBe("Crystals");
    expect(item.classList).toContain("tooltip");
    expect(item.textContent?.trim()).toBe("×100");
    expect(screen.queryByText("Crystals")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://assets.test/sekai-jp-assets/thumbnail/common_material/jewel.webp"
    );
  });

  it("tries the fallback icon, then shows the name as text", async () => {
    const { container } = render(RewardItem, {
      detail: { resourceType: "material", resourceId: 13 },
      region: "tw",
      label: "音樂卡",
      quantityLabel: "×10"
    });

    const image = () => container.querySelector("img");
    expect(image()?.getAttribute("src")).toContain("sekai-tc-assets");
    await fireEvent.error(image()!);
    expect(image()?.getAttribute("src")).toContain("sekai-jp-assets");
    await fireEvent.error(image()!);
    expect(image()).toBeNull();
    expect(screen.getByText("音樂卡")).toBeTruthy();
    expect(screen.getByText("×10")).toBeTruthy();
  });

  it("shows items without a known icon as text", () => {
    render(RewardItem, {
      detail: { resourceType: "honor", resourceId: 1 },
      region: "jp",
      label: "Honor",
      quantityLabel: "×1"
    });

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Honor")).toBeTruthy();
  });

  it("frames a reward row item as a chip with a 40px icon, but not a total", () => {
    const { container } = render(RewardItem, {
      detail: { resourceType: "jewel", resourceId: null },
      region: "jp",
      label: "Crystals",
      quantityLabel: "×100"
    });
    const row = screen.getByRole("img", { name: "Crystals ×100" });
    expect(row.classList).toContain("badge");
    expect(container.querySelector("img")?.classList).toContain("size-10");
    cleanup();

    render(RewardItem, {
      detail: { resourceType: "jewel", resourceId: null },
      region: "jp",
      label: "Crystals",
      quantityLabel: "×20,600",
      size: "lg"
    });
    expect(screen.getByRole("img", { name: "Crystals ×20,600" }).classList).not.toContain("badge");
  });

  it("frames a title reward as a chip button that lifts on hover", () => {
    render(RewardItem, {
      detail: { resourceType: "honor", resourceId: 1, resourceRarity: "high" },
      region: "jp",
      label: "Title",
      quantityLabel: "×1"
    });

    const title = screen.getByRole("button", { name: "Title ×1" });
    expect(title.classList).toContain("btn");
    expect(title.classList).toContain("rounded-selector");
    expect(title.classList).toContain("hover-lift");
    expect(title.querySelector("img")?.classList).toContain("size-10");
  });

  it("opens a stamp reward's image in the image preview, with WebP and PNG downloads", async () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.showModal = showModal;
    const { container } = render(RewardItem, {
      detail: { resourceType: "stamp", resourceId: 33, resourceAssetbundleName: "stamp0038" },
      region: "jp",
      label: "Stamp",
      quantityLabel: "×1"
    });

    const stamp = screen.getByRole("button", { name: "Stamp ×1" });
    expect(stamp.getAttribute("aria-haspopup")).toBe("dialog");
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(false);

    await fireEvent.click(stamp);

    expect(showModal).toHaveBeenCalledTimes(1);
    const dialog = container.querySelector("dialog");
    expect(dialog?.getAttribute("aria-label")).toBe("Stamp");
    expect(dialog?.querySelector("img")?.getAttribute("src")).toBe(
      "https://assets.test/sekai-jp-assets/stamp/stamp0038/stamp0038.webp"
    );
    expect(
      [...(dialog?.querySelectorAll("a[download]") ?? [])].map((a) => a.getAttribute("href"))
    ).toEqual([
      "https://assets.test/sekai-jp-assets/stamp/stamp0038/stamp0038.webp",
      "https://assets.test/sekai-jp-assets/stamp/stamp0038/stamp0038.png"
    ]);
  });

  it("keeps a stamp without an icon, or with previews off, as a plain item", () => {
    render(RewardItem, {
      detail: { resourceType: "stamp", resourceId: 33 },
      region: "jp",
      label: "Stamp",
      quantityLabel: "×1"
    });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Stamp")).toBeTruthy();
    cleanup();

    render(RewardItem, {
      detail: { resourceType: "stamp", resourceId: 33, resourceAssetbundleName: "stamp0038" },
      region: "jp",
      label: "Stamp",
      preview: false
    });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("img", { name: "Stamp" })).toBeTruthy();
  });

  it.each(["md", "lg"] as const)(
    "keeps the %s title button's ::after free for the tooltip arrow",
    (size) => {
      render(RewardItem, {
        detail: { resourceType: "honor", resourceId: 1 },
        region: "jp",
        label: "Title",
        quantityLabel: "×1",
        size
      });

      const title = screen.getByRole("button", { name: "Title ×1" });
      expect(title.classList).toContain("tooltip");
      // touch-target draws its hit area with ::after, which would move the tooltip arrow.
      expect(title.classList).not.toContain("touch-target");
    }
  );
});
