import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { createStreamedTranslator } from "./streamed-translator.svelte";

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

describe("createStreamedTranslator", () => {
  it("uses the local source messages until the streamed bundle resolves", async () => {
    let resolveBundle: (messages: Record<string, string>) => void = () => {};
    const source = $state({
      uiLocale: "en",
      i18nMessages: new Promise<Record<string, string>>((resolve) => (resolveBundle = resolve)) as
        Record<string, string> | Promise<Record<string, string>>
    });
    let i18n: ReturnType<typeof createStreamedTranslator> | null = null;
    const cleanup = $effect.root(() => {
      i18n = createStreamedTranslator(() => source, ["common", "mysekai"]);
    });
    flushSync();

    expect(i18n!.t("navigation.mysekaiFixtures")).toBe("Furniture");

    resolveBundle({ "navigation.mysekaiFixtures": "Meubles" });
    await flush();
    expect(i18n!.t("navigation.mysekaiFixtures")).toBe("Meubles");

    // A new streamed bundle falls back to the source messages again until it resolves.
    source.i18nMessages = Promise.reject(new Error("offline"));
    await flush();
    expect(i18n!.t("navigation.mysekaiFixtures")).toBe("Furniture");

    cleanup();
  });

  it("reads an already resolved bundle", async () => {
    const source = { uiLocale: "en", i18nMessages: { "mysekai.all": "Everything" } };
    let i18n: ReturnType<typeof createStreamedTranslator> | null = null;
    const cleanup = $effect.root(() => {
      i18n = createStreamedTranslator(() => source, ["mysekai"]);
    });
    await flush();

    expect(i18n!.t("mysekai.all")).toBe("Everything");
    cleanup();
  });
});
