type AudioLike = Pick<
  HTMLAudioElement,
  "src" | "currentTime" | "duration" | "paused" | "play" | "pause" | "addEventListener"
>;

/**
 * One track at a time for a list of soundtracks: the list toggles a track by its ID, and
 * the playing row reads the progress. Starting another track stops the current one.
 */
export class SoundtrackPlayer {
  currentId = $state<number | null>(null);
  playing = $state(false);
  failed = $state(false);
  currentTime = $state(0);
  duration = $state(0);
  #audio: AudioLike | null = null;
  readonly #createAudio: () => AudioLike;

  constructor(createAudio: () => AudioLike = () => new Audio()) {
    this.#createAudio = createAudio;
  }

  /** Plays the track, or pauses and resumes it when it is already the current one. */
  toggle(id: number, src: string | null): void {
    if (id === this.currentId && this.#audio && !this.failed) {
      if (this.#audio.paused) this.#play(this.#audio);
      else this.#audio.pause();
      return;
    }

    this.stop();
    this.currentId = id;
    if (!src) {
      this.failed = true;
      return;
    }
    const audio = this.#audioElement();
    audio.src = src;
    this.#play(audio);
  }

  seek(time: number): void {
    if (!this.#audio || !Number.isFinite(time)) return;
    this.#audio.currentTime = Math.max(0, Math.min(time, this.duration || time));
    this.currentTime = this.#audio.currentTime;
  }

  stop(): void {
    // Pausing is enough: the next track's src aborts this one's loading.
    this.#audio?.pause();
    this.currentId = null;
    this.playing = false;
    this.failed = false;
    this.currentTime = 0;
    this.duration = 0;
  }

  #play(audio: AudioLike): void {
    void audio.play().catch(() => {
      this.playing = false;
    });
  }

  #audioElement(): AudioLike {
    if (this.#audio) return this.#audio;
    const audio = this.#createAudio();
    audio.addEventListener("play", () => (this.playing = true));
    audio.addEventListener("pause", () => (this.playing = false));
    audio.addEventListener("ended", () => {
      this.playing = false;
      this.currentTime = 0;
    });
    audio.addEventListener("timeupdate", () => (this.currentTime = audio.currentTime));
    audio.addEventListener("loadedmetadata", () => {
      this.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    });
    audio.addEventListener("error", () => {
      if (this.currentId === null) return;
      this.failed = true;
      this.playing = false;
    });
    this.#audio = audio;
    return audio;
  }
}

/** `m:ss` for a playback position in seconds. */
export const formatPlaybackTime = (seconds: number): string => {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** A file name without characters that file systems reject. */
export const toDownloadFileName = (title: string, extension: string): string => {
  const safe = Array.from(title.trim(), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f || String.raw`<>:"/\|?*`.includes(character)
      ? "-"
      : character;
  })
    .join("")
    .slice(0, 160);
  return `${safe || "soundtrack"}.${extension}`;
};

/**
 * Saves the file under the given name. When the file cannot be fetched (for example a
 * host without CORS), it opens in a new tab instead, where the browser can save it.
 */
export const downloadFile = async (url: string, fileName: string): Promise<void> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  } catch {
    window.open(url, "_blank", "noopener");
  }
};
