import { json } from "@sveltejs/kit";
import { parseStampListQuery } from "$lib/domain/stamp";
import { normalizeRegion } from "$lib/i18n/region";
import { parsePositivePage } from "$lib/server/catalogue-data";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchStampListPage } from "$lib/server/stamps";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePositivePage(url.searchParams.get("page"));
  const query = parseStampListQuery(url.searchParams);

  try {
    return json(await fetchStampListPage(getMasterApiBaseUrl(), region, query, page));
  } catch {
    return json({ error: true }, { status: 500 });
  }
};
