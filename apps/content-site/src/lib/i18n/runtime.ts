import { browser, dev } from "$app/environment";
import { env } from "$env/dynamic/public";
import {
  createScopedI18nLoader,
  createRemoteI18nRuntime,
  resolveI18nMessageBundle as resolveSharedI18nMessageBundle,
  type I18nFetcher,
  type I18nMessages,
  type I18nTranslator
} from "@platform/i18n-runtime";
import cardSourceMessages from "@platform/i18n-source/content-site/card.json";
import characterSourceMessages from "@platform/i18n-source/content-site/character.json";
import commonSourceMessages from "@platform/i18n-source/content-site/common.json";
import errorSourceMessages from "@platform/i18n-source/content-site/error.json";
import eventSourceMessages from "@platform/i18n-source/content-site/event.json";
import gachaSourceMessages from "@platform/i18n-source/content-site/gacha.json";
import homeSourceMessages from "@platform/i18n-source/content-site/home.json";
import honorSourceMessages from "@platform/i18n-source/content-site/honor.json";
import missionSourceMessages from "@platform/i18n-source/content-site/mission.json";
import musicSourceMessages from "@platform/i18n-source/content-site/music.json";
import mysekaiSourceMessages from "@platform/i18n-source/content-site/mysekai.json";
import stampSourceMessages from "@platform/i18n-source/content-site/stamp.json";
import serverSourceMessages from "@platform/i18n-source/content-site/server.json";
import virtualLiveSourceMessages from "@platform/i18n-source/content-site/virtual-live.json";
import unitSourceMessages from "@platform/i18n-source/content-site/unit.json";
import { repoLocaleByUiLocale, type SupportedUiLocale } from "$lib/i18n/config";
import { normalizeUiLocale } from "$lib/i18n/region";

const toRepoLocale = (uiLocale: SupportedUiLocale): string =>
  repoLocaleByUiLocale[uiLocale] ?? "en";

export const contentSiteI18nNamespaces = [
  "common",
  "home",
  "card",
  "character",
  "event",
  "gacha",
  "music",
  "honor",
  "mission",
  "mysekai",
  "stamp",
  "error",
  "server",
  "virtual-live",
  "unit"
] as const;

export type I18nNamespace = (typeof contentSiteI18nNamespaces)[number];
export type ContentSiteTranslator = I18nTranslator;
export type ContentSiteServerMessageKey =
  | "homeEventDataUnavailable"
  | "homeEventDataRequestFailed"
  | "invalidEventId"
  | "eventUnavailableInCurrentRegion"
  | "failedToLoadEventData"
  | "invalidCardId"
  | "cardUnavailableInCurrentRegion"
  | "failedToLoadCardData"
  | "invalidGachaId"
  | "gachaUnavailableInCurrentRegion"
  | "failedToLoadGachaData"
  | "invalidMusicId"
  | "musicUnavailableInCurrentRegion"
  | "failedToLoadMusicData"
  | "invalidVirtualLiveId"
  | "virtualLiveUnavailableInCurrentRegion"
  | "failedToLoadVirtualLiveData";

const DEFAULT_SEKAI_I18N_BASE_URL = "https://sekai-world.github.io/sekai-i18n-reborn";
export const SERVER_I18N_BUNDLE_TIMEOUT_MS = 2_500;
const FALLBACK_UI_LOCALE: SupportedUiLocale = "en";
const LEGACY_COMMON_COMPAT_NAMESPACES = new Set<I18nNamespace>([
  "home",
  "card",
  "character",
  "event",
  "gacha",
  "music",
  "virtual-live",
  "error"
]);
const localSourceMessagesByNamespace: Record<I18nNamespace, I18nMessages> = {
  card: cardSourceMessages,
  character: characterSourceMessages,
  common: commonSourceMessages,
  error: errorSourceMessages,
  event: eventSourceMessages,
  gacha: gachaSourceMessages,
  home: homeSourceMessages,
  honor: honorSourceMessages,
  mission: missionSourceMessages,
  music: musicSourceMessages,
  mysekai: mysekaiSourceMessages,
  server: serverSourceMessages,
  stamp: stampSourceMessages,
  unit: unitSourceMessages,
  "virtual-live": virtualLiveSourceMessages
};

const getI18nBaseUrl = (): string => {
  const value = env.PUBLIC_SEKAI_I18N_BASE_URL?.trim() || DEFAULT_SEKAI_I18N_BASE_URL;
  return value.replace(/\/+$/, "");
};

const i18nRuntime = createRemoteI18nRuntime({
  baseUrl: getI18nBaseUrl(),
  fallbackLocale: "en",
  isBrowser: () => browser,
  normalizeLocale: (localeValue) => normalizeUiLocale(localeValue),
  toRemoteLocale: (localeValue) => toRepoLocale(normalizeUiLocale(localeValue))
});

/**
 * In dev, English resolves from the local source files instead of the remote
 * dictionary so source edits show up without waiting for a dictionary sync.
 */
const loadRemoteMessagesWithDevLocalEnglish = (
  localeValue: string,
  namespace: I18nNamespace,
  fetcher?: I18nFetcher
): Promise<I18nMessages> => {
  if (dev && toRepoLocale(normalizeUiLocale(localeValue)) === "en") {
    return Promise.resolve(localSourceMessagesByNamespace[namespace] ?? {});
  }
  return i18nRuntime.loadMessages(localeValue, namespace, fetcher);
};

export const isLocaleLoading = i18nRuntime.isLocaleLoading;

const scopedI18nLoader = createScopedI18nLoader<I18nNamespace>({
  commonNamespace: "common",
  fallbackLocale: FALLBACK_UI_LOCALE,
  legacyCommonCompatNamespaces: LEGACY_COMMON_COMPAT_NAMESPACES,
  localSourceMessagesByNamespace,
  loadRemoteMessages: loadRemoteMessagesWithDevLocalEnglish,
  normalizeLocale: (localeValue) => normalizeUiLocale(localeValue),
  toRemoteLocale: (localeValue) => toRepoLocale(normalizeUiLocale(localeValue))
});

export const loadI18nMessages = (
  localeValue: string,
  namespace: I18nNamespace,
  fetcher?: I18nFetcher
): Promise<I18nMessages> => scopedI18nLoader.loadMessages(localeValue, namespace, fetcher);

export const loadI18nMessageBundle = (
  localeValue: string,
  namespaces: readonly I18nNamespace[],
  fetcher?: I18nFetcher
): Promise<I18nMessages> => scopedI18nLoader.loadMessageBundle(localeValue, namespaces, fetcher);

/** Resolves a server bundle within a bounded SSR/navigation budget. */
export const resolveI18nMessageBundle = async (
  loadBundle: () => Promise<I18nMessages>,
  namespaces: readonly I18nNamespace[],
  timeoutMs = SERVER_I18N_BUNDLE_TIMEOUT_MS
): Promise<I18nMessages> => {
  return resolveSharedI18nMessageBundle(loadBundle, getLocalI18nMessages(namespaces), timeoutMs);
};

export const resolveStreamingMessages = (
  messagesOrPromise: I18nMessages | Promise<I18nMessages>,
  namespaces: readonly I18nNamespace[]
): I18nMessages => {
  if (
    messagesOrPromise &&
    typeof (messagesOrPromise as PromiseLike<I18nMessages>).then === "function"
  ) {
    return namespaces.reduce<I18nMessages>(
      (messages, namespace) => ({ ...messages, ...localSourceMessagesByNamespace[namespace] }),
      {}
    );
  }
  return messagesOrPromise as I18nMessages;
};

export const getLocalI18nMessages = (namespaces: readonly I18nNamespace[]): I18nMessages =>
  namespaces.reduce<I18nMessages>(
    (messages, namespace) => ({ ...messages, ...localSourceMessagesByNamespace[namespace] }),
    {}
  );

export const createI18nTranslator = (
  localeValue: string,
  messages: I18nMessages
): ContentSiteTranslator => i18nRuntime.createPureTranslator(localeValue, messages);

export const requestI18nLocale = (): ReturnType<typeof i18nRuntime.requestLocale> =>
  i18nRuntime.requestLocale();

export const getServerI18nText = async (
  localeValue: string,
  key: ContentSiteServerMessageKey,
  fetcher?: I18nFetcher
): Promise<string> => {
  const messages = await scopedI18nLoader.loadMessages(localeValue, "server", fetcher);
  return messages[key] ?? key;
};

export const setI18nLocale = (
  localeValue: string,
  messages?: I18nMessages,
  requestToken?: ReturnType<typeof i18nRuntime.requestLocale>
): Promise<SupportedUiLocale> =>
  Promise.resolve(messages ?? scopedI18nLoader.loadMessages(localeValue, "common"))
    .then((resolvedMessages) =>
      i18nRuntime.setLocale(
        localeValue,
        scopedI18nLoader.mergeCommonMessages(resolvedMessages),
        requestToken?.isCurrent
      )
    )
    .then((locale) => normalizeUiLocale(locale));

export const tCommon = (localeValue: string, key: string, fallback?: string): string =>
  createI18nTranslator(localeValue, localSourceMessagesByNamespace.common)(key, fallback);
