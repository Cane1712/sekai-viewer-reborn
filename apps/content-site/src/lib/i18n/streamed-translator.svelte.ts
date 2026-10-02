import type { I18nMessages } from "@platform/i18n-runtime";
import {
  createI18nTranslator,
  resolveStreamingMessages,
  type ContentSiteTranslator,
  type I18nNamespace
} from "./runtime";

type StreamedI18nSource = {
  uiLocale: string;
  i18nMessages: I18nMessages | Promise<I18nMessages>;
};

/**
 * A page translator over the layout's streamed dictionaries: the local source messages
 * until the remote bundle resolves, then the bundle. Call it during component setup.
 */
export const createStreamedTranslator = (
  source: () => StreamedI18nSource,
  namespaces: readonly I18nNamespace[]
): { readonly t: ContentSiteTranslator } => {
  let resolved = $state<I18nMessages | null>(null);

  $effect(() => {
    const bundle = source().i18nMessages;
    let active = true;
    resolved = null;
    void Promise.resolve(bundle)
      .then((value) => {
        if (active) resolved = value;
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  });

  const t = $derived.by(() => {
    const { uiLocale, i18nMessages } = source();
    return createI18nTranslator(uiLocale, {
      ...resolveStreamingMessages(i18nMessages, namespaces),
      ...resolved
    });
  });

  return {
    get t() {
      return t;
    }
  };
};
