import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchMysekaiMaterials } from "$lib/server/mysekai";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const region = normalizeRegion(params.region);
  // Every region has under a hundred materials, so the page filters them in the browser.
  const materials = fetchMysekaiMaterials(getMasterApiBaseUrl(), region).catch(() => null);
  return { region, materials };
};
