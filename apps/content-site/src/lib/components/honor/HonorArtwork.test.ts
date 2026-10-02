import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import HonorArtwork from "./HonorArtwork.svelte";
import {
  createHonorDegreeAssetResolver,
  toCatalogueHonorDegree,
  type CatalogueHonorDegree
} from "$lib/honor-degree";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const degree: CatalogueHonorDegree = {
  main: {
    kind: "normal",
    honorType: "event",
    assetBundleName: "body",
    rankAsset: { bundlePath: "honor/rank", resourceName: "rank_main.png" }
  },
  sub: {
    kind: "normal",
    honorType: "event",
    assetBundleName: "body",
    rankAsset: { bundlePath: "honor/rank", resourceName: "rank_sub.png" }
  }
};
const props = {
  degree,
  resolveAsset: (bundle: string, resource: string) => `/${bundle}/${resource}`,
  label: "Event honor",
  imageUnavailableLabel: "Image unavailable"
};

describe("HonorArtwork", () => {
  it.each([
    [254, "0 0 380 80"],
    [200, "0 0 380 80"],
    [199, "0 0 180 80"]
  ])("draws a %ipx container with the %s slot", async (width, viewBox) => {
    let resize: ((entries: { contentRect: { width: number } }[]) => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: typeof resize) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    render(HonorArtwork, props);
    resize?.([{ contentRect: { width } }]);
    await tick();

    expect(screen.getByRole("img", { name: "Event honor" }).getAttribute("viewBox")).toBe(viewBox);
  });

  it("scales the main slot to its container, up to the full 380px title", async () => {
    const { container } = render(HonorArtwork, props);
    await tick();

    const frame = container.firstElementChild as HTMLElement;
    expect(frame.classList).toContain("max-w-95");
    expect(frame.classList).toContain("aspect-19/4");
    const title = screen.getByRole("img", { name: "Event honor" });
    expect(title.getAttribute("viewBox")).toBe("0 0 380 80");
    expect(title.classList).toContain("w-full!");
  });

  it("renders a no-frameName catalogue honor body then local frame in both responsive slots", async () => {
    let resize!: (entries: { contentRect: { width: number } }[]) => void;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: typeof resize) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const catalogueDegree = toCatalogueHonorDegree(
      {
        id: 1,
        name: null,
        assetBundleName: "honor_0001",
        group: null,
        groupId: 1,
        honorMissionType: null,
        honorRarity: "low",
        honorType: "normal",
        honorTypeId: null,
        seq: null,
        levels: []
      },
      {
        id: 1,
        name: null,
        honorType: "normal",
        backgroundAssetBundleName: null,
        frameName: null
      }
    );
    const { container } = render(HonorArtwork, {
      ...props,
      degree: catalogueDegree,
      resolveAsset: createHonorDegreeAssetResolver("jp")
    });
    for (const [width, slot, frameSize] of [
      [268, "main", "m"],
      [180, "sub", "s"]
    ] as const) {
      resize([{ contentRect: { width } }]);
      await tick();
      const images = Array.from(container.querySelectorAll("svg image"));
      expect(images.map((image) => image.getAttribute("data-layer"))).toEqual(["body", "frame"]);
      expect(images[0].getAttribute("href")).toContain(`/honor/honor_0001/degree_${slot}.webp`);
      expect(images[1].getAttribute("href")).toBe(`/degree/frame_degree_${frameSize}_1.png`);
    }
  });
  it("gates image requests on visibility and selects only the fitting slot", async () => {
    let intersect!: (entries: { isIntersecting: boolean }[]) => void;
    let resize!: (entries: { contentRect: { width: number } }[]) => void;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof intersect) {
          intersect = callback;
        }
        observe() {}
        disconnect = disconnect;
      }
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: typeof resize) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      }
    );
    const { container, unmount } = render(HonorArtwork, props);
    expect(container.querySelector("image")).toBeNull();
    resize([{ contentRect: { width: 180 } }]);
    intersect([{ isIntersecting: true }]);
    await tick();
    expect(screen.getByRole("img").getAttribute("viewBox")).toBe("0 0 180 80");
    expect(container.querySelector('[data-layer="rank"]')?.getAttribute("href")).toBe(
      "/honor/rank/rank_sub.png"
    );
    resize([{ contentRect: { width: 268 } }]);
    await tick();
    expect(screen.getByRole("img").getAttribute("viewBox")).toBe("0 0 380 80");
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(3);
  });
  it("keeps layer failures inside the artwork boundary and recovers for new input", async () => {
    const { container, rerender } = render(HonorArtwork, props);
    await fireEvent.error(container.querySelector("image")!);
    expect(screen.getByText("Image unavailable")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    await rerender({ ...props, degree: { ...degree } });
    expect(screen.getByRole("img", { name: "Event honor" })).toBeTruthy();
  });
});
