import { beforeEach, describe, expect, it, vi } from "vitest";

const { contexts } = vi.hoisted(() => ({ contexts: new Map<unknown, unknown>() }));
vi.mock("svelte", async (importOriginal) => ({
  ...(await importOriginal<typeof import("svelte")>()),
  getContext: (key: unknown) => contexts.get(key),
  setContext: (key: unknown, value: unknown) => contexts.set(key, value)
}));

import {
  defaultTitlePreviewLabels,
  getTitlePreviewLabels,
  setTitlePreviewLabels,
  type TitlePreviewLabels
} from "./title-preview-labels";

describe("title preview labels", () => {
  beforeEach(() => {
    contexts.clear();
  });

  it("falls back to the English labels without a provider", () => {
    expect(getTitlePreviewLabels()()).toBe(defaultTitlePreviewLabels);
  });

  it("reads the labels the root layout provides", () => {
    const labels: TitlePreviewLabels = { ...defaultTitlePreviewLabels, dialog: "称号プレビュー" };
    setTitlePreviewLabels(() => labels);

    expect(getTitlePreviewLabels()()).toBe(labels);
  });
});
