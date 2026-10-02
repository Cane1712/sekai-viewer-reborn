import { describe, expect, it } from "vitest";
import {
  buildCardDescription,
  buildCardMetaLine,
  buildDiscordEmbedSeo,
  buildEventMetaLine,
  buildMusicDescription,
  buildMusicMetaLine,
  DISCORD_COMPONENT_EMBED_JSON_LIMIT_BYTES,
  isSEOCrawler,
  parseTrainedParam,
  buildCanonicalUrl,
  resolveAbsoluteUrl,
  resolveSeoWithBudget,
  truncateByBytes,
  utf8ByteLength
} from "./discord-embed";

describe("truncateByBytes", () => {
  it("keeps values within budget untouched", () => {
    expect(truncateByBytes("hello", 70)).toBe("hello");
  });

  it("truncates without splitting multibyte characters", () => {
    const truncated = truncateByBytes("あいうえお", 10);
    expect(utf8ByteLength(truncated)).toBeLessThanOrEqual(10);
    expect("あいうえお".startsWith(truncated)).toBe(true);
  });
});

describe("isDiscordCrawler", () => {
  it("detects the Discordbot user agent", () => {
    expect(isSEOCrawler("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)")).toBe(
      true
    );
    expect(isSEOCrawler("Discordbot/2.0")).toBe(true);
  });

  it("rejects browsers and missing values", () => {
    expect(isSEOCrawler("Mozilla/5.0 AppleWebKit")).toBe(false);
    expect(isSEOCrawler(null)).toBe(false);
    expect(isSEOCrawler(undefined)).toBe(false);
  });
});

describe("parseTrainedParam", () => {
  it.each(["", "true", "TRUE", "1", "yes", "trained", "anything"])(
    "treats present flag %s as trained",
    (value) => {
      expect(parseTrainedParam(value)).toBe(true);
    }
  );

  it.each(["0", "no", "false", "NO", "False"])("treats %s as normal", (value) => {
    expect(parseTrainedParam(value)).toBe(false);
  });

  it("treats a missing flag as normal", () => {
    expect(parseTrainedParam(null)).toBe(false);
    expect(parseTrainedParam(undefined)).toBe(false);
  });
});

describe("buildCanonicalUrl", () => {
  it("builds an absolute URL from SvelteKit origin and pathname", () => {
    expect(buildCanonicalUrl("https://viewer.example", "/card/jp/1", false)).toBe(
      "https://viewer.example/card/jp/1"
    );
  });

  it("preserves the trained flag for card art variants", () => {
    expect(buildCanonicalUrl("https://viewer.example", "/card/jp/1", true)).toBe(
      "https://viewer.example/card/jp/1?trained=true"
    );
  });

  it("rejects non-http origins", () => {
    expect(buildCanonicalUrl(null, "/card/jp/1", false)).toBe(null);
    expect(buildCanonicalUrl("ftp://viewer.example", "/card/jp/1", false)).toBe(null);
  });

  it("upgrades tunnel http origins to public https", () => {
    expect(buildCanonicalUrl("http://name.trycloudflare.com", "/card/jp/1", false)).toBe(
      "https://name.trycloudflare.com/card/jp/1"
    );
  });

  it("keeps loopback http origins untouched", () => {
    expect(buildCanonicalUrl("http://localhost:4101", "/card/jp/1", false)).toBe(
      "http://localhost:4101/card/jp/1"
    );
  });
});

describe("buildDiscordEmbedSeo", () => {
  const base = {
    pageTitle: "Card title | Sekai Viewer",
    title: "Card title",
    metaLine: "★4 · Cool · Hatsune Miku",
    description: "Flavor text",
    imageUrl: "https://assets.example.test/sekai-jp-assets/card.webp",
    canonicalUrl: "https://viewer.example/card/jp/1",
    openLabel: "Open"
  };

  it("uses the localized open label for the link button", () => {
    const seo = buildDiscordEmbedSeo({ ...base, openLabel: "開く" });
    const payload = JSON.parse(seo?.componentJson ?? "{}");
    const buttons = payload.component.components.find((c: { type: number }) => c.type === 1);
    expect(buttons.components[0].label).toBe("開く");
  });

  it("omits the component script when includeComponent is false", () => {
    const seo = buildDiscordEmbedSeo({ ...base, includeComponent: false });
    expect(seo?.title).toBe("Card title");
    expect(seo?.inlineScriptHtml).toBe("");
    expect(seo?.componentJson).toBe("");
  });

  it("builds a valid container payload with link button", () => {
    const seo = buildDiscordEmbedSeo(base);
    expect(seo).not.toBe(null);

    const payload = JSON.parse(seo!.componentJson) as {
      component: { type: number; components: Array<{ type: number }> };
    };
    expect(payload.component.type).toBe(17);
    expect(payload.component.components.length).toBeGreaterThanOrEqual(3);
    expect(utf8ByteLength(seo!.componentJson)).toBeLessThanOrEqual(
      DISCORD_COMPONENT_EMBED_JSON_LIMIT_BYTES
    );
    expect(seo!.inlineScriptHtml).toContain('id="discord:component-embed"');
    expect(seo!.inlineScriptHtml).not.toContain("</script><script");
  });

  it("renders the artwork as a full-width media gallery", () => {
    const seo = buildDiscordEmbedSeo(base);
    const payload = JSON.parse(seo!.componentJson) as {
      component: { components: Array<{ type: number; items?: Array<{ media: { url: string } }> }> };
    };
    const gallery = payload.component.components.find((component) => component.type === 12);
    expect(gallery?.items?.[0]?.media.url).toBe(base.imageUrl);
  });

  it("omits the gallery when the image URL is not absolute https", () => {
    const seo = buildDiscordEmbedSeo({ ...base, imageUrl: "/storage/card.webp" });
    expect(seo?.imageUrl).toBe("");
    const payload = JSON.parse(seo!.componentJson) as {
      component: { components: Array<{ type: number }> };
    };
    expect(payload.component.components.some((component) => component.type === 12)).toBe(false);
  });

  it("escapes script-breaking markup in payload values", () => {
    const seo = buildDiscordEmbedSeo({ ...base, description: "</script><b>hi</b>" });
    expect(seo!.componentJson).not.toContain("</script>");
    expect(seo!.componentJson).toContain("\\u003c/script>");
  });

  it("strips master-API template placeholders from descriptions", () => {
    const seo = buildDiscordEmbedSeo({ ...base, description: "Score +{{4;v}}%." });
    expect(seo!.description).toBe("Score + %.");
  });

  it("returns null without a usable title or canonical URL", () => {
    expect(buildDiscordEmbedSeo({ ...base, title: "   " })).toBe(null);
    expect(buildDiscordEmbedSeo({ ...base, canonicalUrl: null })).toBe(null);
  });
});

describe("embed meta lines", () => {
  const creditLabels = { composer: "Composer", arranger: "Arranger", lyricist: "Lyricist" };

  it("formats card rarity, attribute, character, and trained state", () => {
    expect(
      buildCardMetaLine(
        {
          title: "Title",
          attr: "cool",
          rarityType: "rarity_4",
          characterFirstName: "Hatsune",
          characterGivenName: "Miku",
          flavorText: null
        },
        true,
        "Trained"
      )
    ).toBe("★4 · Cool · Hatsune Miku · Trained");
  });

  it("prefers flavor text for card descriptions", () => {
    expect(
      buildCardDescription({
        title: "T",
        attr: null,
        rarityType: null,
        flavorText: "Flavor"
      })
    ).toBe("Flavor");
    expect(
      buildCardDescription({ title: "T", attr: null, rarityType: null, flavorText: " - " })
    ).toBe(null);
  });

  it("formats music composer, arranger, and lyricist credits", () => {
    expect(
      buildMusicMetaLine(
        {
          title: "Song",
          composer: "Composer",
          arranger: "Arranger",
          lyricist: "Lyricist",
          creatorName: "Artist"
        },
        creditLabels
      )
    ).toBe("Composer: Composer · Arranger: Arranger · Lyricist: Lyricist");
  });

  it("uses the supplied localized labels", () => {
    expect(
      buildMusicMetaLine(
        { title: "Song", composer: "A", arranger: "B", lyricist: null },
        { composer: "作曲", arranger: "編曲", lyricist: "作詞" }
      )
    ).toBe("作曲: A · 編曲: B");
    expect(
      buildCardMetaLine(
        { title: "T", attr: null, rarityType: null, flavorText: null },
        true,
        "特訓後"
      )
    ).toBe("特訓後");
  });

  it("skips missing music credits", () => {
    expect(
      buildMusicMetaLine(
        {
          title: "Song",
          composer: "Composer",
          arranger: null,
          lyricist: null
        },
        creditLabels
      )
    ).toBe("Composer: Composer");
  });

  it("skips placeholder dash credits", () => {
    expect(
      buildMusicMetaLine(
        { title: "Song", composer: "EasyPop", arranger: "-", lyricist: "EasyPop" },
        creditLabels
      )
    ).toBe("Composer: EasyPop · Lyricist: EasyPop");
  });

  it("uses the creator name as music description unless it matches the composer", () => {
    expect(
      buildMusicDescription({
        title: "Song",
        composer: "Composer",
        arranger: null,
        lyricist: null,
        creatorName: "Artist"
      })
    ).toBe("Artist");
    expect(
      buildMusicDescription({
        title: "Song",
        composer: "Composer",
        arranger: null,
        lyricist: null,
        creatorName: "composer"
      })
    ).toBe(null);
    expect(
      buildMusicDescription({
        title: "Song",
        composer: "Composer",
        arranger: null,
        lyricist: null
      })
    ).toBe(null);
  });

  it("formats event unit and type", () => {
    expect(
      buildEventMetaLine({ title: "Event", unitName: "Leo/need", eventType: "marathon" })
    ).toBe("Leo/need · Marathon");
  });
});

describe("resolveAbsoluteUrl", () => {
  it("passes absolute URLs through untouched", () => {
    expect(
      resolveAbsoluteUrl("https://assets.example.test/card.webp", "https://viewer.example")
    ).toBe("https://assets.example.test/card.webp");
  });

  it("resolves root-relative proxy paths against the page origin", () => {
    expect(resolveAbsoluteUrl("/storage/sekai-jp-assets/card.webp", "https://viewer.example")).toBe(
      "https://viewer.example/storage/sekai-jp-assets/card.webp"
    );
  });

  it("upgrades tunnel http origins to public https", () => {
    expect(
      resolveAbsoluteUrl("/storage/sekai-jp-assets/card.webp", "http://name.trycloudflare.com")
    ).toBe("https://name.trycloudflare.com/storage/sekai-jp-assets/card.webp");
  });

  it("returns empty when nothing fetchable can be built", () => {
    expect(resolveAbsoluteUrl("", "https://viewer.example")).toBe("");
    expect(resolveAbsoluteUrl("/storage/card.webp", null)).toBe("");
    expect(resolveAbsoluteUrl("images/card.webp", "https://viewer.example")).toBe("");
  });
});
describe("placeholder descriptions", () => {
  it("treats dash-only flavor text as missing", () => {
    expect(
      buildCardDescription({ title: "T", attr: null, rarityType: null, flavorText: "-" })
    ).toBe(null);
    expect(
      buildCardDescription({ title: "T", attr: null, rarityType: null, flavorText: " - " })
    ).toBe(null);
  });
});

describe("resolveSeoWithBudget", () => {
  it("resolves fast tasks within budget", async () => {
    await expect(resolveSeoWithBudget(async () => "seo", 50)).resolves.toBe("seo");
  });

  it("returns null when the task exceeds the budget", async () => {
    const slow = () =>
      new Promise<string | null>((resolve) => setTimeout(() => resolve("late"), 500));
    await expect(resolveSeoWithBudget(slow, 20)).resolves.toBe(null);
  });

  it("returns null when the task rejects", async () => {
    const failing = async (): Promise<string | null> => {
      throw new Error("upstream failure");
    };
    await expect(resolveSeoWithBudget(failing, 50)).resolves.toBe(null);
  });
});
