import { getServerI18nText } from "$lib/i18n/runtime";
import type { I18nFetcher } from "@platform/i18n-runtime";

export type DiscordEmbedLabels = {
  open: string;
  trained: string;
  birthday: string;
  composer: string;
  arranger: string;
  lyricist: string;
  /** Template containing a `{title}` placeholder. */
  featuring: string;
  titleCards: string;
  titleMusic: string;
  titleEvents: string;
};

export const loadDiscordEmbedLabels = async (
  locale: string,
  fetcher?: I18nFetcher
): Promise<DiscordEmbedLabels> => {
  const [
    open,
    trained,
    birthday,
    composer,
    arranger,
    lyricist,
    featuring,
    titleCards,
    titleMusic,
    titleEvents
  ] = await Promise.all([
    getServerI18nText(locale, "discordEmbedOpen", fetcher),
    getServerI18nText(locale, "discordEmbedTrained", fetcher),
    getServerI18nText(locale, "discordEmbedBirthday", fetcher),
    getServerI18nText(locale, "discordEmbedComposer", fetcher),
    getServerI18nText(locale, "discordEmbedArranger", fetcher),
    getServerI18nText(locale, "discordEmbedLyricist", fetcher),
    getServerI18nText(locale, "discordEmbedFeaturing", fetcher),
    getServerI18nText(locale, "discordEmbedTitleCards", fetcher),
    getServerI18nText(locale, "discordEmbedTitleMusic", fetcher),
    getServerI18nText(locale, "discordEmbedTitleEvents", fetcher)
  ]);

  return {
    open,
    trained,
    birthday,
    composer,
    arranger,
    lyricist,
    featuring,
    titleCards,
    titleMusic,
    titleEvents
  };
};
