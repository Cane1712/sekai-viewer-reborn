import { json } from "@sveltejs/kit";
import { parseMysekaiSoundtrackListQuery } from "$lib/domain/mysekai";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parsePositivePage } from "$lib/server/catalogue-data";
import { fetchMysekaiSoundtrackListPage } from "$lib/server/mysekai";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePositivePage(url.searchParams.get("page"));
  const query = parseMysekaiSoundtrackListQuery(url.searchParams);

  try {
    return json(await fetchMysekaiSoundtrackListPage(getMasterApiBaseUrl(), region, query, page));
  } catch {
    return json({ error: true }, { status: 500 });
  }
};
