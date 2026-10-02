import { describe, expect, it } from "vitest";
import {
  buildCardDescription,
  buildCardMetaLine,
  buildDiscordEmbedSeo,
  buildEventMetaLine,
  buildMusicDescription,
  buildMusicMetaLine,
  DISCORD_COMPONENT_EMBED_JSON_LIMIT_BYTES,
  isDiscordCrawler,
  isSEOCrawler,
  resolveEffectiveTrained,
  resolveEmbedImageUrl,
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

describe("isSEOCrawler", () => {
  it.each([
    "Twitterbot/1.0",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "TelegramBot (like TwitterBot)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) meta-externalagent/1.1"
  ])("detects the link-preview crawler %s", (userAgent) => {
    expect(isSEOCrawler(userAgent)).toBe(true);
  });

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
    expect(isSEOCrawler("")).toBe(false);
  });
});

describe("isDiscordCrawler", () => {
  it("matches only Discord, case-insensitively", () => {
    expect(isDiscordCrawler("Mozilla/5.0 (compatible; Discordbot/2.0)")).toBe(true);
    expect(isDiscordCrawler("DISCORDBOT")).toBe(true);
    expect(isDiscordCrawler("Twitterbot/1.0")).toBe(false);
    expect(isDiscordCrawler("Mozilla/5.0 AppleWebKit")).toBe(false);
    expect(isDiscordCrawler(null)).toBe(false);
    expect(isDiscordCrawler(undefined)).toBe(false);
  });
});

describe("resolveEffectiveTrained", () => {
  const card = (rarityType: string | null, initialSpecialTrainingStatus: string | null) =>
    ({ rarityType, initialSpecialTrainingStatus }) as Parameters<typeof resolveEffectiveTrained>[0];

  it.each(["rarity_1", "rarity_2", "rarity_birthday", null])(
    "never trains a non-trainable card (%s) even when requested",
    (rarity) => {
      expect(resolveEffectiveTrained(card(rarity, null), true)).toBe(false);
      expect(resolveEffectiveTrained(card(rarity, "done"), true)).toBe(false);
    }
  );

  it.each(["rarity_3", "rarity_4"])("honors the request for a trainable %s card", (rarity) => {
    expect(resolveEffectiveTrained(card(rarity, null), true)).toBe(true);
    expect(resolveEffectiveTrained(card(rarity, null), false)).toBe(false);
  });

  it("forces trained art for a trained-only card regardless of the request", () => {
    expect(resolveEffectiveTrained(card("rarity_4", "done"), false)).toBe(true);
    expect(resolveEffectiveTrained(card("rarity_4", "done"), true)).toBe(true);
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

  it.each(["http://localhost:4101", "http://[::1]:4101", "http://name.trycloudflare.com"])(
    "keeps the request protocol for %s instead of rewriting it",
    (origin) => {
      expect(buildCanonicalUrl(origin, "/card/jp/1", false)).toBe(`${origin}/card/jp/1`);
    }
  );

  it("drops any path or query carried on the origin", () => {
    expect(buildCanonicalUrl("https://viewer.example/ignored?x=1", "/card/jp/1", false)).toBe(
      "https://viewer.example/card/jp/1"
    );
  });

  it("rejects an unparsable origin", () => {
    expect(buildCanonicalUrl("https://", "/card/jp/1", false)).toBe(null);
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
  const attributeLabels = {
    cool: "Cool",
    cute: "Cute",
    happy: "Happy",
    mysterious: "Mysterious",
    pure: "Pure"
  };
  const cardLabels = { trained: "Trained", birthday: "Birthday", attributes: attributeLabels };
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
        cardLabels
      )
    ).toBe("★4 · Cool · Hatsune Miku · Trained");
  });

  it.each([
    ["rarity_1", "★1"],
    ["rarity_2", "★2"],
    ["rarity_3", "★3"],
    ["rarity_4", "★4"],
    ["rarity_birthday", "Birthday"]
  ])("formats %s as %s", (rarityType, expected) => {
    expect(
      buildCardMetaLine({ title: "T", attr: null, rarityType, flavorText: null }, false, cardLabels)
    ).toBe(expected);
  });

  it("localizes the birthday label and never shows a star count for it", () => {
    const line = buildCardMetaLine(
      { title: "T", attr: "cool", rarityType: "rarity_birthday", flavorText: null },
      false,
      { trained: "特訓後", birthday: "誕生日", attributes: { cool: "クール" } }
    );
    expect(line).toBe("誕生日 · クール");
    expect(line).not.toContain("★");
  });

  it("omits unknown rarity types instead of showing a raw identifier", () => {
    expect(
      buildCardMetaLine(
        { title: "T", attr: "cool", rarityType: "rarity_4_birthday", flavorText: null },
        false,
        cardLabels
      )
    ).toBe("Cool");
  });

  it("localizes the attribute and omits unknown attributes", () => {
    const labels = { ...cardLabels, attributes: { cute: "キュート" } };
    expect(
      buildCardMetaLine(
        { title: "T", attr: " CUTE ", rarityType: "rarity_3", flavorText: null },
        false,
        labels
      )
    ).toBe("★3 · キュート");
    expect(
      buildCardMetaLine(
        { title: "T", attr: "unheard_of", rarityType: "rarity_3", flavorText: null },
        false,
        labels
      )
    ).toBe("★3");
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
      buildCardMetaLine({ title: "T", attr: null, rarityType: null, flavorText: null }, true, {
        trained: "特訓後",
        birthday: "誕生日",
        attributes: {}
      })
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

  it("formats event unit and localized type", () => {
    const eventTypes = {
      marathon: "Marathon",
      cheerful_carnival: "Cheerful Carnival",
      world_bloom: "World Link"
    };
    expect(
      buildEventMetaLine(
        { title: "Event", unitName: "Leo/need", eventType: "marathon" },
        { eventTypes }
      )
    ).toBe("Leo/need · Marathon");
    expect(buildEventMetaLine({ title: "E", eventType: "cheerful_carnival" }, { eventTypes })).toBe(
      "Cheerful Carnival"
    );
    expect(
      buildEventMetaLine(
        { title: "E", eventType: "cheerful_carnival" },
        { eventTypes: { cheerful_carnival: "チアフルカーニバル" } }
      )
    ).toBe("チアフルカーニバル");
  });

  it("omits an unknown event type instead of showing a raw identifier", () => {
    expect(
      buildEventMetaLine(
        { title: "E", unitName: "Leo/need", eventType: "brand_new_type" },
        { eventTypes: {} }
      )
    ).toBe("Leo/need");
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

  it("keeps the request protocol when resolving proxy paths", () => {
    expect(
      resolveAbsoluteUrl("/storage/sekai-jp-assets/card.webp", "http://name.trycloudflare.com")
    ).toBe("http://name.trycloudflare.com/storage/sekai-jp-assets/card.webp");
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

describe("resolveEmbedImageUrl", () => {
  const build = (name: string) => `https://assets.example.test/${name}/art.webp`;

  it("builds an absolute URL from the asset bundle", () => {
    expect(resolveEmbedImageUrl("bundle-1", build, "https://viewer.example")).toBe(
      "https://assets.example.test/bundle-1/art.webp"
    );
  });

  it("resolves a relative asset base against the page origin", () => {
    expect(
      resolveEmbedImageUrl("bundle-1", (name) => `/storage/${name}.webp`, "https://viewer.example")
    ).toBe("https://viewer.example/storage/bundle-1.webp");
  });

  it.each([null, undefined, ""])("returns empty for a missing bundle name (%s)", (name) => {
    expect(resolveEmbedImageUrl(name, build, "https://viewer.example")).toBe("");
  });

  it("returns empty instead of throwing when the asset base is not configured", () => {
    const throwing = () => {
      throw new Error("PUBLIC_REMOTE_ASSET_BASE_URL is not set");
    };
    expect(resolveEmbedImageUrl("bundle-1", throwing, "https://viewer.example")).toBe("");
  });
});
