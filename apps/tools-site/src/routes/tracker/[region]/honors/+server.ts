import { json } from "@sveltejs/kit";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { isTrackerRegion } from "$lib/server/event-tracker";
import {
  MAX_HONOR_LOOKUP_IDS,
  getTrackerHonorLookup,
  parseIdList
} from "$lib/server/tracker-profile";
import type { RequestHandler } from "./$types";

const emptyLookup = { honors: [], bondsHonors: [], bondsViewData: null };

/** Master data for the titles one ranked player shows on their profile. */
export const GET: RequestHandler = async ({ params, url }) => {
  const honorIds = parseIdList(url.searchParams.get("honors"), MAX_HONOR_LOOKUP_IDS);
  const bondsHonorIds = parseIdList(url.searchParams.get("bonds"), MAX_HONOR_LOOKUP_IDS);
  if (
    !isTrackerRegion(params.region) ||
    honorIds === null ||
    bondsHonorIds === null ||
    honorIds.length + bondsHonorIds.length > MAX_HONOR_LOOKUP_IDS
  ) {
    return json({ status: "invalid-request", ...emptyLookup });
  }
  if (honorIds.length + bondsHonorIds.length === 0) {
    return json({ status: "available", ...emptyLookup });
  }

  return json({
    status: "available",
    ...(await getTrackerHonorLookup(getMasterApiBaseUrl(), params.region, honorIds, bondsHonorIds))
  });
};
