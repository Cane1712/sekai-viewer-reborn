import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import UnitIconBadge from "./unit-icon-badge.svelte";

describe("UnitIconBadge", () => {
  it.each(["sm", "default", "lg"] as const)(
    "keeps the %s icon on the fixed asset backdrop in every theme",
    (variant) => {
      const { container } = render(UnitIconBadge, { unit: "idol", variant });

      const frame = container.querySelector(".unit-icon-frame")!;
      expect(frame.classList).toContain("bg-(--archive-surface-asset-backdrop)");
      expect(frame.classList).not.toContain("bg-base-100");
      expect(frame.querySelector("img")).not.toBeNull();
    }
  );

  it("falls back to the text pill without an icon", () => {
    const { container } = render(UnitIconBadge, { unit: "unknown", fallbackLabel: "?" });

    expect(container.querySelector(".unit-icon-frame")).toBeNull();
    expect(container.textContent?.trim()).toBe("?");
  });
});
