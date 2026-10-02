import { getServerI18nText, type ContentSiteServerMessageKey } from "$lib/i18n/runtime";
import type { I18nFetcher } from "@platform/i18n-runtime";

const SIMPLE_LABEL_KEYS = {
  open: "discordEmbedOpen",
  trained: "discordEmbedTrained",
  birthday: "discordEmbedBirthday",
  composer: "discordEmbedComposer",
  arranger: "discordEmbedArranger",
  lyricist: "discordEmbedLyricist",
  // Template containing a `{title}` placeholder.
  featuring: "discordEmbedFeaturing",
  titleCards: "discordEmbedTitleCards",
  titleMusic: "discordEmbedTitleMusic",
  titleEvents: "discordEmbedTitleEvents"
} as const satisfies Record<string, ContentSiteServerMessageKey>;

/** Card attribute API values mapped to their message keys. */
const ATTRIBUTE_KEYS = {
  cool: "discordEmbedAttrCool",
  cute: "discordEmbedAttrCute",
  happy: "discordEmbedAttrHappy",
  mysterious: "discordEmbedAttrMysterious",
  pure: "discordEmbedAttrPure"
} as const satisfies Record<string, ContentSiteServerMessageKey>;

/** Event type API values mapped to their message keys. */
const EVENT_TYPE_KEYS = {
  marathon: "discordEmbedEventMarathon",
  cheerful_carnival: "discordEmbedEventCheerfulCarnival",
  world_bloom: "discordEmbedEventWorldLink"
} as const satisfies Record<string, ContentSiteServerMessageKey>;

export type DiscordEmbedLabels = Record<keyof typeof SIMPLE_LABEL_KEYS, string> & {
  attributes: Record<string, string>;
  eventTypes: Record<string, string>;
};

export const loadDiscordEmbedLabels = async (
  locale: string,
  fetcher?: I18nFetcher
): Promise<DiscordEmbedLabels> => {
  const loadGroup = async (
    keys: Record<string, ContentSiteServerMessageKey>
  ): Promise<Record<string, string>> =>
    Object.fromEntries(
      await Promise.all(
        Object.entries(keys).map(
          async ([name, key]) => [name, await getServerI18nText(locale, key, fetcher)] as const
        )
      )
    );

  const [simple, attributes, eventTypes] = await Promise.all([
    loadGroup(SIMPLE_LABEL_KEYS),
    loadGroup(ATTRIBUTE_KEYS),
    loadGroup(EVENT_TYPE_KEYS)
  ]);

  return { ...(simple as Record<keyof typeof SIMPLE_LABEL_KEYS, string>), attributes, eventTypes };
};
