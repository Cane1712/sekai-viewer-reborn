import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIGNED_GET_RETRY_POLICY } from "./image-retry";
import CardThumbnail from "./card-thumbnail.svelte";

const flushEffects = async (): Promise<void> => {
  await Promise.resolve();
  await tick();
};

const getContentImage = (container: HTMLElement): HTMLImageElement => {
  const image = Array.from(container.querySelectorAll("img")).find(
    (candidate) => candidate.getAttribute("alt") !== ""
  );
  if (!(image instanceof HTMLImageElement)) {
    throw new Error("Expected a card thumbnail image to be rendered");
  }

  return image;
};

describe("CardThumbnail retry and visibility behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses a same-origin 404 probe to move to its fallback image", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 404 } as Response);
    const { container } = render(CardThumbnail, {
      src: "/missing-thumbnail.png",
      fallbackSrc: "/fallback-thumbnail.png",
      alt: "Card",
      loadMode: "immediate"
    });

    await fireEvent.error(getContentImage(container));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/missing-thumbnail.png",
      expect.objectContaining({ method: "HEAD", cache: "no-store" })
    );
    expect(getContentImage(container).getAttribute("src")).toBe("/fallback-thumbnail.png");
  });

  it("exhausts a same-origin thumbnail without leaving a broken image visible", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 200 } as Response);
    const { container } = render(CardThumbnail, {
      src: "/missing-thumbnail.png",
      alt: "Card",
      fallbackLabel: "Card unavailable",
      loadMode: "immediate"
    });

    await fireEvent.error(getContentImage(container));
    await flushEffects();
    await vi.advanceTimersByTimeAsync(360);
    await flushEffects();
    await fireEvent.error(getContentImage(container));
    await vi.advanceTimersByTimeAsync(1080);
    await flushEffects();
    await fireEvent.error(getContentImage(container));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Card unavailable");
    expect(getContentImage(container).className).toContain("sr-only");
  });

  it("delays a cross-origin retry without issuing a HEAD probe", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { container } = render(CardThumbnail, {
      src: "https://cdn.example.test/card.png",
      alt: "Card",
      loadMode: "immediate"
    });

    await fireEvent.error(getContentImage(container));
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(360);
    await flushEffects();
    expect(getContentImage(container).getAttribute("src")).toContain("__image_retry=");
  });

  it("preserves a same-origin signed URL and skips HEAD probes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    vi.spyOn(Math, "random").mockReturnValue(0);
    const signedUrl =
      "/signed/thumbnail.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=def456#thumbnail";
    const { container } = render(CardThumbnail, {
      src: signedUrl,
      alt: "Signed thumbnail",
      loadMode: "immediate",
      retryPolicy: SIGNED_GET_RETRY_POLICY
    });

    await fireEvent.error(getContentImage(container));
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await flushEffects();
    expect(getContentImage(container).getAttribute("src")).toBe(signedUrl);
  });

  it("does not render a nullable thumbnail source", () => {
    const { container } = render(CardThumbnail, {
      src: null,
      alt: "Missing card",
      fallbackLabel: "Card unavailable",
      loadMode: "immediate"
    });

    expect(container.querySelector("img[alt='Missing card']")).toBeNull();
    expect(container.textContent).toContain("Card unavailable");
  });

  it("keeps a thumbnail hidden until its visible observer fires", async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let callback: IntersectionObserverCallback | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(nextCallback: IntersectionObserverCallback) {
          callback = nextCallback;
        }

        observe = observe;
        disconnect = disconnect;
      }
    );

    const { container } = render(CardThumbnail, {
      src: "/visible-thumbnail.png",
      alt: "Visible card",
      loadMode: "visible"
    });
    await flushEffects();

    expect(observe).toHaveBeenCalledTimes(1);
    expect(container.querySelector("img[alt='Visible card']")).toBeNull();

    callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    await flushEffects();
    expect(container.querySelector("img[alt='Visible card']")).not.toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });

  it("cancels a stale probe when its source changes", async () => {
    let probeSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      probeSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const { container, rerender } = render(CardThumbnail, {
      src: "/old-thumbnail.png",
      alt: "Card",
      loadMode: "immediate"
    });

    await fireEvent.error(getContentImage(container));
    await rerender({ src: "/new-thumbnail.png" });
    await flushEffects();

    expect(probeSignal?.aborted).toBe(true);
    expect(getContentImage(container).getAttribute("src")).toBe("/new-thumbnail.png");
  });

  it("cancels a same-origin probe when unmounted", async () => {
    let probeSignal: AbortSignal | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      probeSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const { container, unmount } = render(CardThumbnail, {
      src: "/unmounted-thumbnail.png",
      alt: "Card",
      loadMode: "immediate"
    });

    await fireEvent.error(getContentImage(container));
    unmount();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(probeSignal?.aborted).toBe(true);
  });
});

describe("CardThumbnail icons", () => {
  it("pins the attribute icon to the top-left corner with its top-left artwork", () => {
    const { container } = render(CardThumbnail, {
      src: "/thumbnail.png",
      alt: "Card",
      attr: "cool",
      rarityCount: 4,
      loadMode: "immediate"
    });

    const attrIcon = Array.from(container.querySelectorAll("svg image")).find((image) =>
      image.getAttribute("href")?.includes("icon_attribute_cool")
    );
    expect(attrIcon?.getAttribute("href")).toContain("icon_attribute_cool_64");
    expect(attrIcon?.getAttribute("x")).toBe("0");
    expect(attrIcon?.getAttribute("y")).toBe("0");
  });
});
