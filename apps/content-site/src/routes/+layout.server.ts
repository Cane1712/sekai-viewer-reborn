import type { LayoutServerLoad } from "./$types";
import {
  loadI18nMessageBundle,
  resolveI18nMessageBundle,
  type I18nNamespace
} from "$lib/i18n/runtime";
import {
  normalizeRegion,
  normalizeUiLocale,
  PREFERRED_REGION_COOKIE_NAME,
  UI_LOCALE_COOKIE_NAME
} from "$lib/i18n/region";
import { fetchGlobalNotices } from "$lib/server/notifications";
import packageJson from "../../package.json";

const getRouteI18nNamespaces = (pathname: string): readonly I18nNamespace[] => {
  // always include "error" so +error.svelte can resolve its keys on any path
  if (pathname.startsWith("/card/") || pathname.startsWith("/cards/")) {
    return ["common", "card", "event", "error"];
  }

  if (pathname.startsWith("/music/") || pathname.startsWith("/musics/")) {
    return ["common", "music", "error"];
  }

  if (pathname.startsWith("/event/") || pathname.startsWith("/events/")) {
    return ["common", "event", "error"];
  }

  if (pathname.startsWith("/gacha/") || pathname.startsWith("/gachas/")) {
    return ["common", "gacha", "error"];
  }

  if (pathname.startsWith("/virtual-live/") || pathname.startsWith("/virtual-lives/")) {
    return ["common", "virtual-live", "music", "error"];
  }

  if (pathname.startsWith("/character/") || pathname.startsWith("/characters/")) {
    return ["common", "character", "card", "error"];
  }

  if (pathname.startsWith("/unit/")) {
    return ["common", "unit", "error"];
  }

  if (pathname.startsWith("/news/")) {
    return ["common", "home", "error"];
  }

  if (pathname === "/support") {
    return ["common", "home", "error"];
  }

  if (pathname.startsWith("/missions/")) {
    return ["common", "mission", "error"];
  }

  if (pathname.startsWith("/honors/")) {
    return ["common", "honor", "error"];
  }

  if (pathname.startsWith("/mysekai/")) {
    return ["common", "mysekai", "error"];
  }

  if (pathname.startsWith("/stamps/")) {
    return ["common", "stamp", "error"];
  }

  return pathname === "/" ? ["common", "home", "event", "error"] : ["common", "error"];
};

export const load: LayoutServerLoad = async ({ cookies, fetch, url }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const namespaces = getRouteI18nNamespaces(url.pathname);
  const [i18nMessages, globalNotices] = await Promise.all([
    resolveI18nMessageBundle(() => loadI18nMessageBundle(uiLocale, namespaces, fetch), namespaces),
    fetchGlobalNotices(fetch)
  ]);

  return {
    i18nMessages,
    uiLocale,
    preferredRegion: normalizeRegion(cookies.get(PREFERRED_REGION_COOKIE_NAME)),
    globalNotices,
    siteVersion: packageJson.version
  };
};
