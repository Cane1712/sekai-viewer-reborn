import { parseMysekaiSoundtrackListQuery } from "$lib/domain/mysekai";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchMysekaiSoundtrackFilters, fetchMysekaiSoundtrackListPage } from "$lib/server/mysekai";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query = parseMysekaiSoundtrackListQuery(url.searchParams);
  const baseUrl = getMasterApiBaseUrl();
  // Both stream; a failed request resolves to null so the page can show its error state.
  const catalogue = fetchMysekaiSoundtrackListPage(baseUrl, region, query).catch(() => null);
  const filters = fetchMysekaiSoundtrackFilters(baseUrl, region).catch(() => null);

  return { region, query, catalogue, filters };
};
