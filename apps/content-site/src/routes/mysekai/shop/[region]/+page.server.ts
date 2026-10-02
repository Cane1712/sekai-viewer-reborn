import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchMysekaiShopItems } from "$lib/server/mysekai";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const region = normalizeRegion(params.region);
  // The shop sells a few dozen items, so the page filters them in the browser.
  const items = fetchMysekaiShopItems(getMasterApiBaseUrl(), region).catch(() => null);
  return { region, items };
};
