import { json } from "@sveltejs/kit";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { isTrackerRegion } from "$lib/server/event-tracker";
import { MAX_CARD_LOOKUP_IDS, getTrackerCardArt, parseIdList } from "$lib/server/tracker-profile";
import type { RequestHandler } from "./$types";

/** Leader card art for the ranking avatars currently on screen. */
export const GET: RequestHandler = async ({ params, url }) => {
  const ids = parseIdList(url.searchParams.get("ids"), MAX_CARD_LOOKUP_IDS);
  if (!isTrackerRegion(params.region) || ids === null) {
    return json({ status: "invalid-request", cards: [] });
  }
  if (ids.length === 0) return json({ status: "available", cards: [] });

  return json({
    status: "available",
    cards: await getTrackerCardArt(getMasterApiBaseUrl(), params.region, ids)
  });
};
