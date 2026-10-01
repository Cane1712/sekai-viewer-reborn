import { env } from "$env/dynamic/public";
import { isTrackerSupportedRegion, type TrackerSupportedRegion } from "$lib/regions";

const assetBucketByRegion: Record<TrackerSupportedRegion, string> = {
  jp: "sekai-jp-assets",
  en: "sekai-en-assets",
  tw: "sekai-tc-assets",
  kr: "sekai-kr-assets"
};

const trimTrailingSlashes = (value: string): string => {
  const trimmed = value.trim();
  let end = trimmed.length;
  while (end > 0 && trimmed[end - 1] === "/") end -= 1;
  return trimmed.slice(0, end);
};

const trimBoundarySlashes = (value: string): string => {
  const trimmed = value.trim();
  let start = 0;
  let end = trimmed.length;
  while (start < end && trimmed[start] === "/") start += 1;
  while (end > start && trimmed[end - 1] === "/") end -= 1;
  return trimmed.slice(start, end);
};

/** Matches content-site's confirmed event-banner endpoint and regional asset buckets. */
export const getEventBannerAssetURL = (
  assetBundleName: string,
  region: TrackerSupportedRegion,
  baseUrl = env.PUBLIC_REMOTE_ASSET_BASE_URL ?? ""
): string | null => {
  const bundle = trimBoundarySlashes(assetBundleName);
  const baseUrlValue = trimTrailingSlashes(baseUrl);
  if (!bundle || !baseUrlValue) return null;

  return `${baseUrlValue}/${assetBucketByRegion[region]}/home/banner/${bundle}/${bundle}.webp`;
};

const localHonorDirectories: Record<string, string> = {
  "local/honor": "/degree",
  "local/bonds-honor": "/degree/bonds",
  "local/live-master": "/degree/live-master"
};

/** Resolve renderer sprite names without fetching or requiring remote configuration for local art. */
export const getHonorAssetURL = (
  bundlePath: string | null | undefined,
  resourceName: string | null | undefined,
  region: string,
  baseUrl: string | null = env.PUBLIC_REMOTE_ASSET_BASE_URL ?? ""
): string | null => {
  const bundle = trimBoundarySlashes(bundlePath ?? "");
  const resource = trimBoundarySlashes(resourceName ?? "");
  if (
    !bundle ||
    !resource ||
    !bundle.split("/").every((part) => /^[\w-]+$/.test(part)) ||
    !/^[\w-]+(?:\.png|\.webp)?$/.test(resource)
  )
    return null;

  const sprite = resource.replace(/\.(?:png|webp)$/, "");
  const localDirectory = localHonorDirectories[bundle];
  if (localDirectory !== undefined) return `${localDirectory}/${sprite}.png`;
  const base = trimTrailingSlashes(baseUrl ?? "");
  if (!base || !isTrackerSupportedRegion(region)) return null;
  const url = `${base}/${assetBucketByRegion[region]}/${bundle}/${sprite}.webp`;
  // Matches content-site: Bonds art was re-exported untrimmed on 2026-09-27, and the
  // query skips trimmed copies still held by the CDN and browser caches.
  return /^bonds_honor\/(character|word)$/.test(bundle) ? `${url}?v=2` : url;
};

/**
 * A ranked player's avatar: their leader card's art. The square thumbnail suits list rows;
 * `member_small` is the wide art the game's profile page shows.
 */
export const getLeaderCardAssetURL = (
  variant: "thumbnail" | "member-small",
  assetBundleName: string | null | undefined,
  trained: boolean,
  region: TrackerSupportedRegion,
  baseUrl = env.PUBLIC_REMOTE_ASSET_BASE_URL ?? ""
): string | null => {
  const bundle = trimBoundarySlashes(assetBundleName ?? "");
  const base = trimTrailingSlashes(baseUrl);
  if (!/^[\w-]+$/.test(bundle) || !base) return null;

  const state = trained ? "after_training" : "normal";
  const path =
    variant === "thumbnail"
      ? `thumbnail/chara/${bundle}_${state}`
      : `character/member_small/${bundle}/card_${state}`;
  return `${base}/${assetBucketByRegion[region]}/${path}.webp`;
};
