import type { HonorDegreeInput } from "@platform/ui-shell";

/** A title reward is a regular title (`honor`) or a Kizuna title (`bonds_honor`). */
export type TitlePreviewKind = "honor" | "bonds";

export const titlePreviewKindOf = (
  resourceType: string | null | undefined
): TitlePreviewKind | null => {
  if (resourceType === "honor") return "honor";
  if (resourceType === "bonds_honor") return "bonds";
  return null;
};

/** What the title preview dialog shows: the rendered title and its details. */
export type TitlePreview = {
  kind: TitlePreviewKind;
  id: number;
  name: string | null;
  rarity: string | null;
  /** The title group's name; for a Kizuna title, the word it is shown with. */
  subtitle: string | null;
  degree: HonorDegreeInput;
  levels: { level: number | null; description: string | null }[];
};
