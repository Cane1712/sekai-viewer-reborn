import { loadMysekaiDetail } from "$lib/domain/mysekai";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchMysekaiFixtureDetail } from "$lib/server/mysekai";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const region = normalizeRegion(params.region);
  const payload = loadMysekaiDetail(params.id, (id) =>
    fetchMysekaiFixtureDetail(getMasterApiBaseUrl(), region, id)
  );
  return { region, id: params.id, payload };
};
