import { describe, expect, it } from "vitest";
import { titlePreviewKindOf } from "./title-preview";

describe("titlePreviewKindOf", () => {
  it("maps title reward types to their preview kind", () => {
    expect(titlePreviewKindOf("honor")).toBe("honor");
    expect(titlePreviewKindOf("bonds_honor")).toBe("bonds");
  });

  it("returns null for other rewards", () => {
    expect(titlePreviewKindOf("jewel")).toBeNull();
    expect(titlePreviewKindOf(null)).toBeNull();
    expect(titlePreviewKindOf(undefined)).toBeNull();
  });
});
