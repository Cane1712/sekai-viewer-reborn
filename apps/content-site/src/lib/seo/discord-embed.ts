// English-only Discord link preview helpers (standard Open Graph fallback +
// inline component embed) for content-site detail pages.
//
// See https://github.com/discord/discord-api-docs/pull/8606 — a component
// embed replaces the standard preview with a layout built from Discord
// message components. The payload is exposed inline via
// `<script id="discord:component-embed" type="application/json">` because a
// single fetch is faster than the linked-JSON variant (no second round trip
// inside Discord's 10s unfurl budget).
//
// These helpers are intentionally pure (no $env imports) so they can run in
// `+page.server.ts` loads and in unit tests.

export const DISCORD_COMPONENT_EMBED_SCRIPT_ID = "discord:component-embed";

// Raw response byte limit for the component-embed JSON document.
export const DISCORD_COMPONENT_EMBED_JSON_LIMIT_BYTES = 3000;

// Server-side time budget for resolving the SEO bundle. Discord's whole
// unfurl (page + images) must finish within 10s; when upstream data is
// slower than this, the page falls back to its generic title instead of
// making Discord's fetch time out.
export const DISCORD_SEO_BUDGET_MS = 6000;

/**
 * Resolve an SEO bundle within Discord's fetch budget. Returns null on
 * timeout or task failure so the page still serves fast with its fallback
 * title. The underlying fetch keeps running for the streaming page body.
 */
export const resolveSeoWithBudget = async <T>(
  task: () => Promise<T | null>,
  budgetMs: number = DISCORD_SEO_BUDGET_MS
): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), budgetMs);
    });
    return await Promise.race([task(), timeout]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

// Open Graph trimming limits applied by Discord (counted in bytes).
export const DISCORD_OG_TITLE_LIMIT_BYTES = 70;
export const DISCORD_OG_DESCRIPTION_LIMIT_BYTES = 350;

// Discord blurple, used as the container accent color.
export const DISCORD_ACCENT_COLOR = 5793266;

export const DISCORD_SITE_NAME = "Sekai Viewer";

export type DiscordEmbedSeo = {
  /** Full `<title>` value, e.g. `Card title | Sekai Viewer`. */
  pageTitle: string;
  /** `og:title` value. */
  title: string;
  /** `og:description` value. */
  description: string;
  /** Absolute `https://` image URL, or empty when unavailable. */
  imageUrl: string;
  /** Absolute canonical page URL, used for `og:url` and link buttons. */
  canonicalUrl: string;
  /**
   * Component-embed JSON document, escaped for inline `<script>` use
   * (`<` encoded so `</script>` can never break out of the tag).
   */
  componentJson: string;
  /** Full `<script>` tag HTML to render with `{@html}` in `<svelte:head>`. */
  inlineScriptHtml: string;
};

const textEncoder = new TextEncoder();

export const utf8ByteLength = (value: string): number => textEncoder.encode(value).length;

/** Truncate to a byte budget without splitting a UTF-8 sequence. */
export const truncateByBytes = (value: string, maxBytes: number): string => {
  const text = value.trim();
  if (utf8ByteLength(text) <= maxBytes) {
    return text;
  }

  let result = "";
  for (const char of text) {
    if (utf8ByteLength(result + char) > maxBytes) {
      break;
    }
    result += char;
  }

  return result.trim();
};

/** True when the request comes from Discord's link-preview crawler. */
export const isDiscordCrawler = (userAgent: string | null | undefined): boolean =>
  typeof userAgent === "string" && userAgent.toLowerCase().includes("discordbot");

/**
 * Resolve an asset URL to an absolute URL Discord can fetch. Absolute URLs
 * pass through untouched; root-relative URLs (e.g. dev `/storage` proxy
 * paths) resolve against the page origin.
 */
export const resolveAbsoluteUrl = (
  value: string | null | undefined,
  origin: string | null | undefined
): string => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const publicOrigin = normalizePublicOrigin(origin);
  if (!publicOrigin || !trimmed.startsWith("/")) {
    return "";
  }

  return `${publicOrigin}${trimmed}`;
}; /**
 * Parse the card `?trained` query flag. Presence-based: missing means the
 * normal art; a present flag means trained art unless it explicitly says
 * `0`, `no`, or `false` (so `?trained`, `?trained=1`, `?trained=yes`,
 * `?trained=true` all select trained art).
 */
export const parseTrainedParam = (value: string | null | undefined): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized !== "0" && normalized !== "no" && normalized !== "false";
};

/**
 * Normalize a request origin for public embeds. Dev servers behind a
 * TLS-terminating tunnel/proxy (e.g. Cloudflare quick tunnels) see an
 * internal `http://` origin while the public URL is `https://`; upgrade to
 * https for any non-loopback host so Discord receives fetchable URLs.
 */
const normalizePublicOrigin = (origin: string | null | undefined): string | null => {
  const trimmed = origin?.trim() ?? "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (parsed.protocol === "http:" && !isLoopback) {
      parsed.protocol = "https:";
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

/** Build the canonical URL from SvelteKit's `url` (origin + path params stay). */
export const buildCanonicalUrl = (
  origin: string | null | undefined,
  pathname: string | null | undefined,
  trained: boolean
): string | null => {
  const publicOrigin = normalizePublicOrigin(origin);
  if (!publicOrigin || !pathname) {
    return null;
  }

  const normalizedPath = pathname.trim().startsWith("/") ? pathname.trim() : `/${pathname.trim()}`;
  return `${publicOrigin}${normalizedPath}${trained ? "?trained=true" : ""}`;
};

const isAbsoluteHttpsUrl = (value: string): boolean => /^https:\/\//i.test(value.trim());

/** Strip markdown link syntax hazards from link text. */
const sanitizeLinkText = (value: string): string =>
  value.replace(/\[/g, "").replace(/\]/g, "").replace(/\s+/g, " ").trim();

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

/** Remove master-API template placeholders (e.g. skill text `{{4;v}}`). */
const stripPlaceholders = (value: string): string =>
  collapseWhitespace(value.replace(/\{\{[^}]*\}\}/g, " "));

type ComponentPayloadInput = {
  title: string;
  metaLine: string | null;
  description: string | null;
  imageUrl: string;
  canonicalUrl: string;
};

const buildComponentObject = (input: ComponentPayloadInput): Record<string, unknown> => {
  const linkText = sanitizeLinkText(input.title) || "Open";
  const headingLines = [`# [${linkText}](${input.canonicalUrl})`];
  if (input.metaLine) {
    headingLines.push(input.metaLine);
  }
  const heading = { type: 10, content: headingLines.join("\n") };

  const components: unknown[] = [heading];
  if (input.imageUrl) {
    // Media Gallery renders the artwork full-width; the Thumbnail accessory
    // (type 11) is too small for card/music/event art.
    components.push({
      type: 12,
      items: [{ media: { url: input.imageUrl } }]
    });
  }

  if (input.description) {
    components.push({ type: 10, content: input.description });
  }

  components.push({
    type: 1,
    components: [{ type: 2, style: 5, label: "Open", url: input.canonicalUrl }]
  });

  return {
    component: {
      type: 17,
      accent_color: DISCORD_ACCENT_COLOR,
      components
    }
  };
};

const serializeComponentJson = (payload: Record<string, unknown>): string | null => {
  const raw = JSON.stringify(payload);
  if (utf8ByteLength(raw) <= DISCORD_COMPONENT_EMBED_JSON_LIMIT_BYTES) {
    return raw;
  }

  return null;
};

export type BuildDiscordEmbedSeoInput = {
  pageTitle: string;
  title: string;
  metaLine?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  canonicalUrl: string | null;
};

/**
 * Build the full SEO bundle, or null when no useful preview is possible
 * (missing title/canonical, or payload over Discord's 3000-byte limit).
 * Shrinks the description until the payload fits before giving up.
 */
export const buildDiscordEmbedSeo = (input: BuildDiscordEmbedSeoInput): DiscordEmbedSeo | null => {
  const title = truncateByBytes(input.title, DISCORD_OG_TITLE_LIMIT_BYTES);
  const canonicalUrl = input.canonicalUrl?.trim() ?? "";
  if (!title || !canonicalUrl || !/^https?:\/\//i.test(canonicalUrl)) {
    return null;
  }

  const pageTitle = input.pageTitle.trim() || `${title} | ${DISCORD_SITE_NAME}`;
  const rawImage = input.imageUrl?.trim() ?? "";
  const imageUrl = rawImage.length > 0 && isAbsoluteHttpsUrl(rawImage) ? rawImage : "";
  const metaLine = input.metaLine ? collapseWhitespace(input.metaLine) : "";

  let description = input.description
    ? truncateByBytes(
        stripPlaceholders(collapseWhitespace(input.description)),
        DISCORD_OG_DESCRIPTION_LIMIT_BYTES
      )
    : "";

  // Shrink the description until the whole JSON document fits Discord's limit.
  let componentRaw: string | null = null;
  let budget = DISCORD_OG_DESCRIPTION_LIMIT_BYTES;
  while (budget >= 0) {
    const candidate = buildComponentObject({
      title,
      metaLine: metaLine || null,
      description: description || null,
      imageUrl,
      canonicalUrl
    });
    componentRaw = serializeComponentJson(candidate);
    if (componentRaw) {
      break;
    }
    if (!description) {
      return null;
    }
    budget = Math.floor(budget / 2);
    description = truncateByBytes(description, budget);
    if (budget === 0) {
      description = "";
    }
  }

  if (!componentRaw) {
    return null;
  }

  // Encode `<` so a payload value can never close the inline script tag.
  const componentJson = componentRaw.replace(/</g, "\\u003c");
  const inlineScriptHtml =
    `<script id="${DISCORD_COMPONENT_EMBED_SCRIPT_ID}" type="application/json">` +
    `${componentJson}</script>`;

  return {
    pageTitle,
    title,
    description,
    imageUrl,
    canonicalUrl,
    componentJson,
    inlineScriptHtml
  };
};

const RARITY_STAR_COUNT_BY_TYPE: Record<string, number> = {
  rarity_1: 1,
  rarity_2: 2,
  rarity_3: 3,
  rarity_4: 4,
  rarity_birthday: 4,
  rarity_4_birthday: 4
};

const capitalize = (value: string): string =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

const formatRarity = (rarityType: string | null): string | null => {
  if (!rarityType) {
    return null;
  }

  const count = RARITY_STAR_COUNT_BY_TYPE[rarityType.trim().toLowerCase()];
  if (count) {
    return `★${count}`;
  }

  return rarityType.trim();
};

export const formatCharacterName = (
  firstName: string | null | undefined,
  givenName: string | null | undefined
): string | null => {
  const parts = [firstName, givenName]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(" ") : null;
};

export type CardEmbedSource = {
  title: string;
  attr: string | null;
  rarityType: string | null;
  characterFirstName?: string | null;
  characterGivenName?: string | null;
  flavorText?: string | null;
};

export const buildCardMetaLine = (card: CardEmbedSource, trained: boolean): string => {
  const parts: string[] = [];
  const rarity = formatRarity(card.rarityType);
  if (rarity) {
    parts.push(rarity);
  }
  if (card.attr) {
    parts.push(capitalize(card.attr.trim()));
  }
  const characterName = formatCharacterName(card.characterFirstName, card.characterGivenName);
  if (characterName) {
    parts.push(characterName);
  }
  if (trained) {
    parts.push("Trained");
  }

  return parts.join(" · ");
};

/** Dash-only placeholder text (e.g. flavor text `"-"`) counts as missing. */
const isPlaceholderText = (value: string): boolean => /^[-—–\s]*$/.test(value);

export const buildCardDescription = (card: CardEmbedSource): string | null => {
  // Flavor text only. Skill text carries `{{...}}` templates needing
  // effect-level resolution, so it is excluded rather than shown raw.
  const text = card.flavorText?.trim() ?? "";
  if (text && !isPlaceholderText(text)) {
    return text;
  }

  return null;
};

export type MusicEmbedSource = {
  title: string;
  composer: string | null;
  arranger: string | null;
  lyricist: string | null;
  creatorName?: string | null;
};

export const buildMusicMetaLine = (music: MusicEmbedSource): string => {
  const credit = (role: string, value: string | null | undefined): string | null => {
    const name = value?.trim() ?? "";
    return name && !isPlaceholderText(name) ? `${role}: ${name}` : null;
  };
  const credits = [
    credit("Composer", music.composer),
    credit("Arranger", music.arranger),
    credit("Lyricist", music.lyricist)
  ].filter((entry): entry is string => entry !== null);

  return credits.join(" · ");
};

export const buildMusicDescription = (music: MusicEmbedSource): string | null => {
  const creator = music.creatorName?.trim() ?? "";
  const composer = music.composer?.trim() ?? "";
  if (creator && !isPlaceholderText(creator) && creator.toLowerCase() !== composer.toLowerCase()) {
    return creator;
  }

  return null;
};

export type EventEmbedSource = {
  title: string;
  unitName?: string | null;
  eventType?: string | null;
};

export const buildEventMetaLine = (event: EventEmbedSource): string => {
  const parts: string[] = [];
  if (event.unitName) {
    parts.push(event.unitName.trim());
  }
  if (event.eventType) {
    parts.push(capitalize(event.eventType.trim()));
  }

  return parts.join(" · ");
};
