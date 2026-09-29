import { getContext, setContext } from "svelte";

/** Labels of the title preview dialog, which any reward list can open. */
export type TitlePreviewLabels = {
  dialog: string;
  close: string;
  loading: string;
  error: string;
  retry: string;
  rarity: string;
  levels: string;
  level: string;
  imageUnavailable: string;
  rarities: Record<string, string>;
};

export const defaultTitlePreviewLabels: TitlePreviewLabels = {
  dialog: "Title preview",
  close: "Close",
  loading: "Loading details...",
  error: "The title could not be loaded.",
  retry: "Try again",
  rarity: "Rarity",
  levels: "Levels",
  level: "Level",
  imageUnavailable: "Image unavailable",
  rarities: { low: "Low", middle: "Middle", high: "High", highest: "Highest" }
};

const titlePreviewLabelsKey = Symbol("title-preview-labels");

/** The root layout provides translated labels; components read them lazily. */
export const setTitlePreviewLabels = (labels: () => TitlePreviewLabels): void => {
  setContext(titlePreviewLabelsKey, labels);
};

export const getTitlePreviewLabels = (): (() => TitlePreviewLabels) =>
  getContext<(() => TitlePreviewLabels) | undefined>(titlePreviewLabelsKey) ??
  (() => defaultTitlePreviewLabels);
