import { getMysekaiMusicRecordsByRegionList } from "@platform/sekai-master-api-sdk";
import { TagLib, type Picture } from "taglib-wasm";
import { getMysekaiSoundTrackAudioURL, getMysekaiSoundTrackJacketURL } from "$lib/assets/index";
import type { MusicSoundTrackCategory, MysekaiMusicRecord } from "$lib/domain/mysekai";
import { getMasterApiV1BaseUrl } from "./catalogue-data";
import { fetchMysekaiSoundtrackFilters } from "./mysekai";

// Every region has about two hundred soundtrack records; the master API caches these pages.
const SOUNDTRACK_LOOKUP_PAGE_SIZE = 100;
const MAX_SOUNDTRACK_LOOKUP_PAGES = 10;

/** Finds a sound-track music record by its record ID; the master API has no by-ID route. */
export const findMysekaiSoundtrack = async (
  baseUrl: string,
  region: string,
  recordId: number
): Promise<MysekaiMusicRecord | null> => {
  for (let page = 1; page <= MAX_SOUNDTRACK_LOOKUP_PAGES; page += 1) {
    const response = await getMysekaiMusicRecordsByRegionList({
      baseUrl: getMasterApiV1BaseUrl(baseUrl),
      path: { region },
      query: { page, page_size: SOUNDTRACK_LOOKUP_PAGE_SIZE, track_type: "music_sound_track" }
    });
    if (response.error || !response.data) {
      throw new Error("Failed to load MySekai soundtracks.");
    }
    const record = (response.data.items ?? []).find((item) => item.id === recordId);
    if (record) return record;
    if (!response.data.pagination?.has_next) return null;
  }
  return null;
};

export type SoundtrackTags = {
  title: string;
  /** The soundtrack's category, which the game shows where a song shows its artist. */
  artist: string | null;
  cover: Uint8Array | null;
};

let tagLibPromise: Promise<TagLib> | null = null;
const getTagLib = (): Promise<TagLib> => {
  tagLibPromise ??= TagLib.initialize();
  return tagLibPromise;
};

/** Writes the title, artist and album (the category), and the cover into the MP3. */
export const tagSoundtrack = async (
  audio: Uint8Array,
  tags: SoundtrackTags
): Promise<Uint8Array> => {
  const tagLib = await getTagLib();
  return tagLib.edit(audio, (file) => {
    const tag = file.tag();
    tag.setTitle(tags.title);
    if (tags.artist) {
      tag.setArtist(tags.artist);
      tag.setAlbum(tags.artist);
    }
    if (tags.cover) {
      file.setPictures([
        {
          data: tags.cover,
          mimeType: "image/webp",
          type: "FrontCover",
          description: tags.artist ?? tags.title
        } satisfies Picture
      ]);
    }
    file.save();
  });
};

const fetchBytes = async (fetchFn: typeof fetch, url: string): Promise<Uint8Array | null> => {
  const response = await fetchFn(url);
  return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
};

export type SoundtrackDownload = { title: string; body: Uint8Array };

/**
 * The soundtrack's MP3 with its tags, or null when the region has no such soundtrack or
 * its audio is unavailable. Tagging problems fall back to the untagged audio.
 */
export const buildMysekaiSoundtrackDownload = async ({
  fetchFn,
  baseUrl,
  assetBaseUrl,
  region,
  recordId
}: {
  fetchFn: typeof fetch;
  baseUrl: string;
  assetBaseUrl: string | null;
  region: string;
  recordId: number;
}): Promise<SoundtrackDownload | null> => {
  const [record, filters] = await Promise.all([
    findMysekaiSoundtrack(baseUrl, region, recordId),
    fetchMysekaiSoundtrackFilters(baseUrl, region).catch(() => null)
  ]);
  const track = record?.soundTrack;
  const audioUrl = track
    ? getMysekaiSoundTrackAudioURL(track.assetbundleName, track.assetbundleFileName, assetBaseUrl)
    : null;
  if (!track || !audioUrl) return null;

  const category: MusicSoundTrackCategory | null =
    filters?.soundTrackCategories.find(
      (candidate) => candidate.id === track.musicSoundTrackCategoryId
    ) ?? null;
  const coverUrl = getMysekaiSoundTrackJacketURL(category?.assetbundleName, assetBaseUrl);
  const [audio, cover] = await Promise.all([
    fetchBytes(fetchFn, audioUrl),
    coverUrl ? fetchBytes(fetchFn, coverUrl).catch(() => null) : Promise.resolve(null)
  ]);
  if (!audio) return null;

  const body = await tagSoundtrack(audio, {
    title: track.title,
    artist: category?.name ?? null,
    cover
  }).catch((tagError: unknown) => {
    console.error("Failed to tag a MySekai soundtrack download.", tagError);
    return audio;
  });
  return { title: track.title, body };
};
