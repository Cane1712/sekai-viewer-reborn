import { json } from "@sveltejs/kit";
import type { TitlePreviewKind } from "$lib/domain/title-preview";
import { normalizeRegion } from "$lib/i18n/region";
import { getPositiveInteger } from "$lib/server/catalogue-data";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { fetchTitlePreview } from "$lib/server/title-preview";
import type { RequestHandler } from "./$types";

/** One rewarded title for the title preview dialog: `/honors/{region}/preview/{honor|bonds}/{id}`. */
export const GET: RequestHandler = async ({ params, url }) => {
  const kind: TitlePreviewKind | null =
    params.kind === "honor" || params.kind === "bonds" ? params.kind : null;
  const id = getPositiveInteger(params.id);
  if (kind === null || id === null) return json({ error: true }, { status: 400 });
  const level = getPositiveInteger(url.searchParams.get("level"));

  try {
    const preview = await fetchTitlePreview(
      getMasterApiBaseUrl(),
      normalizeRegion(params.region),
      kind,
      id,
      level
    );
    return preview ? json(preview) : json({ error: true }, { status: 404 });
  } catch {
    return json({ error: true }, { status: 500 });
  }
};
