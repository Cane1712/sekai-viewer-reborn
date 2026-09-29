import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadFile,
  formatPlaybackTime,
  SoundtrackPlayer,
  toDownloadFileName
} from "./soundtrack-player.svelte";

/** An audio element stand-in that fires its listeners on demand. */
class FakeAudio {
  src = "";
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  playResult: Promise<void> = Promise.resolve();
  readonly listeners = new Map<string, (() => void)[]>();

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  play(): Promise<void> {
    this.paused = false;
    this.emit("play");
    return this.playResult;
  }

  pause(): void {
    this.paused = true;
    this.emit("pause");
  }
}

const createPlayer = () => {
  const audio = new FakeAudio();
  const player = new SoundtrackPlayer(() => audio as unknown as HTMLAudioElement);
  return { audio, player };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SoundtrackPlayer", () => {
  it("plays a track, pauses and resumes it, and tracks its progress", () => {
    const { audio, player } = createPlayer();

    player.toggle(1, "/a.mp3");
    expect(audio.src).toBe("/a.mp3");
    expect(player).toMatchObject({ currentId: 1, playing: true, failed: false });

    audio.duration = 90;
    audio.emit("loadedmetadata");
    audio.currentTime = 12;
    audio.emit("timeupdate");
    expect(player).toMatchObject({ duration: 90, currentTime: 12 });

    player.toggle(1, "/a.mp3");
    expect(player.playing).toBe(false);
    player.toggle(1, "/a.mp3");
    expect(player.playing).toBe(true);

    player.seek(200);
    expect(audio.currentTime).toBe(90);
    player.seek(-5);
    expect(player.currentTime).toBe(0);

    audio.emit("ended");
    expect(player).toMatchObject({ playing: false, currentTime: 0 });
  });

  it("stops the current track when another starts", () => {
    const { audio, player } = createPlayer();
    player.toggle(1, "/a.mp3");
    audio.duration = 90;
    audio.emit("loadedmetadata");

    player.toggle(2, "/b.mp3");

    expect(audio.src).toBe("/b.mp3");
    expect(player).toMatchObject({ currentId: 2, playing: true, duration: 0, currentTime: 0 });
  });

  it("marks a track without audio, or whose audio fails, as failed", async () => {
    const { audio, player } = createPlayer();

    player.toggle(1, null);
    expect(player).toMatchObject({ currentId: 1, failed: true });

    player.toggle(2, "/b.mp3");
    audio.emit("error");
    expect(player).toMatchObject({ currentId: 2, failed: true, playing: false });

    audio.playResult = Promise.reject(new Error("blocked"));
    player.toggle(3, "/c.mp3");
    await Promise.resolve();
    await Promise.resolve();
    expect(player.playing).toBe(false);

    // An error after a stop belongs to no track.
    player.stop();
    audio.emit("error");
    expect(player).toMatchObject({ currentId: null, failed: false });
  });

  it("ignores seeking without audio or with a bad position", () => {
    const { audio, player } = createPlayer();
    player.seek(10);
    player.toggle(1, "/a.mp3");
    player.seek(Number.NaN);
    expect(audio.currentTime).toBe(0);
  });
});

describe("soundtrack helpers", () => {
  it("formats playback positions", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(90.7)).toBe("1:30");
    expect(formatPlaybackTime(Number.NaN)).toBe("0:00");
  });

  it("builds a safe file name", () => {
    expect(toDownloadFileName(' A/B: "C" ', "mp3")).toBe("A-B- -C-.mp3");
    expect(toDownloadFileName("  ", "mp3")).toBe("soundtrack.mp3");
  });

  it("saves the fetched file, or opens it when it cannot be fetched", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:1"),
      revokeObjectURL: vi.fn()
    });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("mp3"))
        .mockResolvedValueOnce(new Response("", { status: 404 }))
    );

    await downloadFile("/a.mp3", "a.mp3");
    expect(click).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();

    await downloadFile("/b.mp3", "b.mp3");
    expect(open).toHaveBeenCalledWith("/b.mp3", "_blank", "noopener");
  });
});
