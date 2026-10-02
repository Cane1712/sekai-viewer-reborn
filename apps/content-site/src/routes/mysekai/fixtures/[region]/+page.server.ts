import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchMysekaiFixtureFilters, fetchMysekaiFixtureListPage } from "$lib/server/mysekai";
import { parseMysekaiFixtureListQuery } from "$lib/domain/mysekai";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const query = parseMysekaiFixtureListQuery(url.searchParams);
  const baseUrl = getMasterApiBaseUrl();
  // Both stream; a failed request resolves to null so the page can show its error state.
  const catalogue = fetchMysekaiFixtureListPage(baseUrl, region, query).catch(() => null);
  const filters = fetchMysekaiFixtureFilters(baseUrl, region).catch(() => null);

  return { region, query, catalogue, filters };
};
