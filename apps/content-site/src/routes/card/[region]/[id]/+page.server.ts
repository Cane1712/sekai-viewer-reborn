import { dev } from "$app/environment";
import {
  getCardsByRegionByIdDetail,
  getCardsRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "$lib/i18n/runtime";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import type {
  CardDetail,
  CardDetailEpisode,
  CardDetailParams,
  CardGachaBanner,
  CardRelatedEvent
} from "$lib/domain/card-detail";
import {
  parseCardDetail,
  parseCardDetailEpisodes,
  parseCardDetailParams,
  parseCardGachaBanners,
  parseCardRelatedEvents
} from "$lib/server/card-detail";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchUnitProfiles, toUnitProfileMap } from "$lib/server/unit-profiles";
import { getCardFullAssetURL } from "$lib/assets/index";
import { createPageTitle } from "$lib/page-title";
import {
  buildCardDescription,
  buildCardMetaLine,
  buildCanonicalUrl,
  buildDiscordEmbedSeo,
  isDiscordCrawler,
  parseTrainedParam,
  resolveAbsoluteUrl,
  resolveSeoWithBudget,
  type DiscordEmbedSeo
} from "$lib/seo/discord-embed";
import type { PageServerLoad } from "./$types";

type CardPayload = {
  card: CardDetail | null;
  debugCardJson: string | null;
  error: string | null;
};

type CardDetailFetchResult = {
  card: CardDetail | null;
  cardExists: boolean;
  loadFailed: boolean;
  debugCardJson: string | null;
  params: CardDetailParams;
  episodes: CardDetailEpisode[];
  relatedEvents: CardRelatedEvent[];
  gachas: CardGachaBanner[];
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const normalizeAvailableRegions = (payload: unknown): SupportedRegion[] => {
  const root = getObject(payload);

  const toSupportedRegionList = (value: unknown): SupportedRegion[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (region): region is SupportedRegion =>
        typeof region === "string" && supportedRegions.includes(region as SupportedRegion)
    );
  };

  const fromRootArray = toSupportedRegionList(payload);
  if (fromRootArray.length > 0) {
    return fromRootArray;
  }

  if (!root) {
    return [];
  }

  for (const key of ["availableRegions", "regions"]) {
    const regions = toSupportedRegionList(root[key]);
    if (regions.length > 0) {
      return regions;
    }
  }

  const dataNode = getObject(root.data);
  if (dataNode) {
    const nestedRegions = normalizeAvailableRegions(dataNode);
    if (nestedRegions.length > 0) {
      return nestedRegions;
    }
  }

  return [];
};

const fetchCardDetail = async ({
  baseUrl,
  region,
  cardId
}: {
  baseUrl: string;
  region: SupportedRegion;
  cardId: string;
}): Promise<CardDetailFetchResult> => {
  const empty: CardDetailFetchResult = {
    card: null,
    cardExists: false,
    loadFailed: true,
    debugCardJson: null,
    params: parseCardDetailParams(null),
    episodes: [],
    relatedEvents: [],
    gachas: []
  };

  try {
    const response = await getCardsByRegionByIdDetail({
      baseUrl,
      path: { region, id: cardId }
    });

    if (response.error) {
      return empty;
    }

    const data = response.data;
    const card = parseCardDetail(data?.card);
    const cardExists = card !== null;

    return {
      card,
      cardExists,
      loadFailed: false,
      debugCardJson: dev ? JSON.stringify(data, null, 2) : null,
      params: parseCardDetailParams(data?.params),
      episodes: parseCardDetailEpisodes(data?.episodes),
      relatedEvents: parseCardRelatedEvents(data?.events),
      gachas: parseCardGachaBanners(data?.gachas)
    };
  } catch {
    return empty;
  }
};

const fetchAvailableRegions = async ({
  baseUrl,
  cardId,
  region,
  detailPromise
}: {
  baseUrl: string;
  cardId: string;
  region: SupportedRegion;
  detailPromise: Promise<CardDetailFetchResult>;
}): Promise<SupportedRegion[]> => {
  try {
    const [detailResult, availabilityResponse] = await Promise.all([
      detailPromise,
      getCardsRegionsByIdAvailability({
        baseUrl,
        path: { id: cardId }
      })
    ]);
    const detectedRegions = availabilityResponse.error
      ? []
      : normalizeAvailableRegions(availabilityResponse.data);

    if (detailResult.cardExists && !detectedRegions.includes(region)) {
      return [region, ...detectedRegions];
    }

    return detectedRegions.includes(region) ? detectedRegions : [region, ...detectedRegions];
  } catch {
    return [region];
  }
};

const fetchCardPayload = async ({
  detailPromise,
  invalidCardIdMessage,
  failedToLoadCardDataMessage
}: {
  detailPromise: Promise<CardDetailFetchResult>;
  invalidCardIdMessage: string | null;
  failedToLoadCardDataMessage: string;
}): Promise<CardPayload> => {
  if (invalidCardIdMessage) {
    return {
      card: null,
      debugCardJson: null,
      error: invalidCardIdMessage
    };
  }

  try {
    const detail = await detailPromise;
    return {
      card: detail.card,
      debugCardJson: detail.debugCardJson,
      error: detail.loadFailed ? failedToLoadCardDataMessage : null
    };
  } catch {
    return {
      card: null,
      debugCardJson: null,
      error: failedToLoadCardDataMessage
    };
  }
};

export const load: PageServerLoad = async ({ params, url, request, cookies, fetch }) => {
  const cardId = params.id?.trim() ?? "";
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const [invalidCardIdMessage, cardUnavailableInCurrentRegionMessage, failedToLoadCardDataMessage] =
    await Promise.all([
      getServerI18nText(uiLocale, "invalidCardId", fetch),
      getServerI18nText(uiLocale, "cardUnavailableInCurrentRegion", fetch),
      getServerI18nText(uiLocale, "failedToLoadCardData", fetch)
    ]);
  const region = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const invalidMessage = cardId ? null : invalidCardIdMessage;
  const detailPromise = cardId
    ? fetchCardDetail({ baseUrl, region, cardId })
    : Promise.resolve({
        card: null,
        cardExists: false,
        loadFailed: false,
        debugCardJson: null,
        params: parseCardDetailParams(null),
        episodes: [],
        relatedEvents: [],
        gachas: []
      } satisfies CardDetailFetchResult);

  // Discord's crawler never executes JavaScript, so streaming `{#await}` titles
  // are invisible to it. Resolve the SEO bundle server-side for crawlers only;
  // browsers keep the fast streaming path. The budget guard keeps slow
  // upstream responses from blowing Discord's 10s unfurl window.
  const trained = parseTrainedParam(url?.searchParams.get("trained"));
  let seo: DiscordEmbedSeo | null = null;
  if (isDiscordCrawler(request?.headers.get("user-agent")) && cardId && !invalidMessage) {
    seo = await resolveSeoWithBudget(async () => {
      const detail = await detailPromise;
      if (!detail.card) {
        return null;
      }
      const card = detail.card;
      // Relative asset bases (dev `/storage` proxy) resolve against the
      // page origin so Discord can fetch them.
      const resolveImageUrl = (): string => {
        try {
          return card.assetBundleName
            ? resolveAbsoluteUrl(
                getCardFullAssetURL(card.assetBundleName, trained, region),
                url?.origin
              )
            : "";
        } catch {
          return "";
        }
      };
      return buildDiscordEmbedSeo({
        pageTitle: createPageTitle(card.title, "Cards"),
        title: card.title,
        metaLine: buildCardMetaLine(
          {
            title: card.title,
            attr: card.attr,
            rarityType: card.rarityType,
            characterFirstName: card.character?.firstName,
            characterGivenName: card.character?.givenName,
            flavorText: card.flavorText
          },
          trained
        ),
        description: buildCardDescription({
          title: card.title,
          attr: card.attr,
          rarityType: card.rarityType,
          flavorText: card.flavorText
        }),
        imageUrl: resolveImageUrl(),
        canonicalUrl: buildCanonicalUrl(url?.origin, url?.pathname, trained)
      });
    });
  }

  return {
    cardId,
    region,
    regionLabel: regionLabels[region],
    trained,
    seo,
    cardUnavailableInCurrentRegionMessage,
    failedToLoadCardDataMessage,
    availableRegions: cardId
      ? fetchAvailableRegions({
          baseUrl,
          cardId,
          region,
          detailPromise
        })
      : Promise.resolve([region] satisfies SupportedRegion[]),
    cardPayload: fetchCardPayload({
      detailPromise,
      invalidCardIdMessage: invalidMessage,
      failedToLoadCardDataMessage
    }),
    params: invalidMessage
      ? Promise.resolve(parseCardDetailParams(null))
      : detailPromise.then((d) => d.params),
    episodes: invalidMessage ? Promise.resolve([]) : detailPromise.then((d) => d.episodes),
    relatedEvents: invalidMessage
      ? Promise.resolve([])
      : detailPromise.then((d) => d.relatedEvents),
    gachas: invalidMessage ? Promise.resolve([]) : detailPromise.then((d) => d.gachas),
    unitProfiles: fetchUnitProfiles(baseUrl, region).then(toUnitProfileMap)
  };
};
