import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { DiscordEmbedSeo } from "$lib/seo/discord-embed";
import DiscordEmbedHead from "./DiscordEmbedHead.svelte";

afterEach(cleanup);

const seo: DiscordEmbedSeo = {
  pageTitle: "Card title | Sekai Viewer",
  title: "Card title",
  description: "Flavor text",
  imageUrl: "https://assets.example.test/card.webp",
  canonicalUrl: "https://viewer.example/card/jp/1",
  componentJson: '{"component":{"type":17}}',
  inlineScriptHtml:
    '<script id="discord:component-embed" type="application/json">{"component":{"type":17}}</script>'
};

const meta = (container: HTMLElement, name: string): string | null =>
  container
    .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
    ?.getAttribute("content") ?? null;

describe("DiscordEmbedHead", () => {
  it("renders the page title and Open Graph tags", () => {
    const { container } = render(DiscordEmbedHead, { seo });

    expect(container.querySelector("title")?.textContent).toBe("Card title | Sekai Viewer");
    expect(meta(container, "og:site_name")).toBe("Sekai Viewer");
    expect(meta(container, "og:title")).toBe("Card title");
    expect(meta(container, "og:description")).toBe("Flavor text");
    expect(meta(container, "og:image")).toBe("https://assets.example.test/card.webp");
    expect(meta(container, "og:url")).toBe("https://viewer.example/card/jp/1");
    expect(meta(container, "og:type")).toBe("article");
    expect(meta(container, "twitter:card")).toBe("summary_large_image");
  });

  it("omits the description and image tags when they are empty", () => {
    const { container } = render(DiscordEmbedHead, {
      seo: { ...seo, description: "", imageUrl: "" }
    });

    expect(meta(container, "og:description")).toBe(null);
    expect(meta(container, "og:image")).toBe(null);
  });

  it("injects the Discord component script when present", () => {
    const { container } = render(DiscordEmbedHead, { seo });

    const script = container.querySelector('script[id="discord:component-embed"]');
    expect(script?.getAttribute("type")).toBe("application/json");
    expect(JSON.parse(script?.textContent ?? "{}")).toEqual({ component: { type: 17 } });
  });

  it("renders no component script for non-Discord crawlers", () => {
    const { container } = render(DiscordEmbedHead, { seo: { ...seo, inlineScriptHtml: "" } });

    expect(container.querySelector('script[id="discord:component-embed"]')).toBe(null);
    expect(meta(container, "og:title")).toBe("Card title");
  });
});
