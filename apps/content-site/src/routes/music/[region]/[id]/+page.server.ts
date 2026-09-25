import { dev } from "$app/environment";
import {
  getMusicsByRegionByIdDetail,
  getMusicsRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "$lib/i18n/runtime";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parseMusicDetail, type MusicDetail } from "$lib/server/music-detail";
import { fetchUnitProfiles, toUnitProfileMap } from "$lib/server/unit-profiles";
import { getMusicJacketAssetURL } from "$lib/assets/index";
import { createPageTitle } from "$lib/page-title";
import {
  buildCanonicalUrl,
  buildDiscordEmbedSeo,
  buildMusicDescription,
  buildMusicMetaLine,
  isDiscordCrawler,
  resolveAbsoluteUrl,
  resolveSeoWithBudget,
  type DiscordEmbedSeo
} from "$lib/seo/discord-embed";
import type { PageServerLoad } from "./$types";

type RegionMusicLookup = {
  region: SupportedRegion;
  music: MusicDetail | null;
  exists: boolean;
  rawPayloadJson: string | null;
};

type MusicPayload = {
  music: MusicDetail | null;
  debugMusicJson: string | null;
  error: string | null;
};

const normalizeAvailableRegions = (payload: unknown): SupportedRegion[] => {
  if (Array.isArray(payload)) {
    return payload.filter(
      (region): region is SupportedRegion =>
        typeof region === "string" && supportedRegions.includes(region as SupportedRegion)
    );
  }

  const root =
    payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : null;

  if (!root) {
    return [];
  }

  const toSupportedRegionList = (value: unknown): SupportedRegion[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (region): region is SupportedRegion =>
        typeof region === "string" && supportedRegions.includes(region as SupportedRegion)
    );
  };

  const toSupportedRegionMap = (value: unknown): SupportedRegion[] => {
    const record =
      value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
    if (!record) {
      return [];
    }

    return supportedRegions.filter((region) => {
      const regionValue = record[region];
      if (regionValue === true) {
        return true;
      }

      const nested =
        regionValue !== null && typeof regionValue === "object"
          ? (regionValue as Record<string, unknown>)
          : null;
      return nested?.available === true || nested?.exists === true;
    });
  };

  for (const key of ["availableRegions", "regions"]) {
    const regions = toSupportedRegionList(root[key]);
    if (regions.length > 0) {
      return regions;
    }
  }

  for (const key of ["availability", "availableRegions", "regions"]) {
    const regions = toSupportedRegionMap(root[key]);
    if (regions.length > 0) {
      return regions;
    }
  }

  const dataNode =
    root.data !== null && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : null;
  if (dataNode) {
    const nestedRegions = normalizeAvailableRegions(dataNode);
    if (nestedRegions.length > 0) {
      return nestedRegions;
    }
  }

  return [];
};

const fetchMusicDetail = async (
  baseUrl: string,
  region: SupportedRegion,
  musicId: string
): Promise<RegionMusicLookup> => {
  try {
    const response = await getMusicsByRegionByIdDetail({
      baseUrl,
      path: { region, id: musicId }
    });

    if (response.error) {
      return { region, music: null, exists: false, rawPayloadJson: null };
    }

    const data = response.data as Record<string, unknown> | null;
    const music = parseMusicDetail(data ?? {});
    return {
      region,
      music,
      exists: music !== null,
      rawPayloadJson: dev ? JSON.stringify(data, null, 2) : null
    };
  } catch {
    return { region, music: null, exists: false, rawPayloadJson: null };
  }
};

const fetchAvailableRegions = async ({
  baseUrl,
  musicId,
  region,
  currentLookupPromise
}: {
  baseUrl: string;
  musicId: string;
  region: SupportedRegion;
  currentLookupPromise: Promise<RegionMusicLookup>;
}): Promise<SupportedRegion[]> => {
  try {
    const [currentLookup, availabilityResponse] = await Promise.all([
      currentLookupPromise,
      getMusicsRegionsByIdAvailability({
        baseUrl,
        path: { id: musicId }
      })
    ]);

    const detectedRegions = availabilityResponse.error
      ? []
      : normalizeAvailableRegions(availabilityResponse.data);

    if (currentLookup.exists && !detectedRegions.includes(region)) {
      return [region, ...detectedRegions];
    }

    return detectedRegions.includes(region) ? detectedRegions : [region, ...detectedRegions];
  } catch {
    return [region];
  }
};

const fetchMusicPayload = async ({
  currentLookupPromise,
  invalidMusicIdMessage
}: {
  currentLookupPromise: Promise<RegionMusicLookup>;
  invalidMusicIdMessage: string | null;
}): Promise<MusicPayload> => {
  if (invalidMusicIdMessage) {
    return { music: null, debugMusicJson: null, error: invalidMusicIdMessage };
  }

  try {
    const currentLookup = await currentLookupPromise;

    return {
      music: currentLookup.music,
      debugMusicJson: dev ? currentLookup.rawPayloadJson : null,
      error: null
    };
  } catch {
    return { music: null, debugMusicJson: null, error: null };
  }
};

export const load: PageServerLoad = async ({ params, url, request, cookies, fetch }) => {
  const musicId = params.id?.trim() ?? "";
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const [
    invalidMusicIdMessage,
    musicUnavailableInCurrentRegionMessage,
    failedToLoadMusicDataMessage
  ] = await Promise.all([
    getServerI18nText(uiLocale, "invalidMusicId", fetch),
    getServerI18nText(uiLocale, "musicUnavailableInCurrentRegion", fetch),
    getServerI18nText(uiLocale, "failedToLoadMusicData", fetch)
  ]);

  const region: SupportedRegion = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();

  const unitProfiles = await fetchUnitProfiles(baseUrl, region).then(toUnitProfileMap);

  const currentLookupPromise = musicId
    ? fetchMusicDetail(baseUrl, region, musicId)
    : Promise.resolve({
        region,
        music: null,
        exists: false,
        rawPayloadJson: null
      } satisfies RegionMusicLookup);

  // Server-render the link preview for Discord's crawler (no JS execution);
  // browsers keep the streaming path. The budget guard keeps slow upstream
  // responses from blowing Discord's 10s unfurl window.
  let seo: DiscordEmbedSeo | null = null;
  if (isDiscordCrawler(request?.headers.get("user-agent")) && musicId) {
    seo = await resolveSeoWithBudget(async () => {
      const lookup = await currentLookupPromise;
      if (!lookup.music) {
        return null;
      }
      const music = lookup.music;
      const resolveImageUrl = (): string => {
        try {
          return music.assetBundleName
            ? resolveAbsoluteUrl(getMusicJacketAssetURL(music.assetBundleName, region), url?.origin)
            : "";
        } catch {
          return "";
        }
      };
      return buildDiscordEmbedSeo({
        pageTitle: createPageTitle(music.title, "Music"),
        title: music.title,
        metaLine: buildMusicMetaLine({
          title: music.title,
          composer: music.composer,
          arranger: music.arranger,
          lyricist: music.lyricist,
          creatorName: music.creatorArtist?.name
        }),
        description: buildMusicDescription({
          title: music.title,
          composer: music.composer,
          arranger: music.arranger,
          lyricist: music.lyricist,
          creatorName: music.creatorArtist?.name
        }),
        imageUrl: resolveImageUrl(),
        canonicalUrl: buildCanonicalUrl(url?.origin, url?.pathname, false)
      });
    });
  }

  return {
    musicId,
    region,
    regionLabel: regionLabels[region],
    seo,
    musicUnavailableInCurrentRegionMessage,
    failedToLoadMusicDataMessage,
    availableRegions: musicId
      ? fetchAvailableRegions({
          baseUrl,
          musicId,
          region,
          currentLookupPromise
        })
      : Promise.resolve([region] satisfies SupportedRegion[]),
    musicPayload: fetchMusicPayload({
      currentLookupPromise,
      invalidMusicIdMessage: musicId ? null : invalidMusicIdMessage
    }),
    unitProfiles
  };
};
