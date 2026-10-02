import { error, type RequestHandler } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/i18n/region";
import { getInternalRemoteAssetBaseUrl, getMasterApiBaseUrl } from "$lib/server/config";
import { buildMysekaiSoundtrackDownload } from "$lib/server/mysekai-soundtrack-download";
import { toDownloadFileName } from "$lib/soundtrack-player.svelte";

/** A soundtrack's MP3 with its title, category (artist and album), and jacket tagged in. */
export const GET: RequestHandler = async ({ params, fetch }) => {
  const recordId = /^\d+$/.test(params.id ?? "") ? Number(params.id) : 0;
  if (!Number.isSafeInteger(recordId) || recordId <= 0) error(404, "Soundtrack not found.");

  const download = await buildMysekaiSoundtrackDownload({
    fetchFn: fetch,
    baseUrl: getMasterApiBaseUrl(),
    assetBaseUrl: getInternalRemoteAssetBaseUrl(),
    region: normalizeRegion(params.region),
    recordId
  });
  if (!download) error(404, "Soundtrack not found.");

  const fileName = toDownloadFileName(download.title, "mp3");
  return new Response(Uint8Array.from(download.body), {
    headers: {
      "content-type": "audio/mpeg",
      "content-disposition": `attachment; filename="soundtrack-${recordId}.mp3"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "cache-control": "no-store",
      "content-length": String(download.body.byteLength)
    }
  });
};
