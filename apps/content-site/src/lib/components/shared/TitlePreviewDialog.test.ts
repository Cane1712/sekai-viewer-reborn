import { cleanup, render, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import "$lib/icons/mdi";
import type { TitlePreview } from "$lib/domain/title-preview";
import TitlePreviewDialog from "./TitlePreviewDialog.svelte";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const preview: TitlePreview = {
  kind: "honor",
  id: 7,
  name: "Stage master",
  rarity: "high",
  subtitle: "Stage",
  degree: { kind: "normal", assetBundleName: "honor_0007", rarity: "high", level: 2 },
  levels: [
    { level: 1, description: "Clear 10 shows" },
    { level: 2, description: "Clear 50 shows" },
    { level: null, description: null }
  ]
};

const openDialog = async (level: number | null) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(preview), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    )
  );
  // Each test asks for its own level, so the module-level request cache never answers it.
  const { component, container } = render(TitlePreviewDialog, {
    region: "jp",
    kind: "honor",
    id: 7,
    level,
    fallbackName: "Title"
  });
  component.show();
  const dialog = container.querySelector("dialog")!;
  await within(dialog).findByRole("table", { hidden: true });
  return dialog;
};

describe("TitlePreviewDialog", () => {
  it("lists the levels as a level and condition table and highlights the rewarded level", async () => {
    const dialog = await openDialog(2);

    // The table carries the "Levels" name; the dialog shows no separate heading for it.
    const table = within(dialog).getByRole("table", { name: "Levels" });
    expect(within(dialog).queryByRole("heading", { name: "Levels" })).toBeNull();
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent?.trim())
    ).toEqual(["Level", "Condition"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => Array.from(row.children, (cell) => cell.textContent?.trim()))).toEqual(
      [
        ["1", "Clear 10 shows"],
        ["2", "Clear 50 shows"],
        ["—", "—"]
      ]
    );
    expect(rows.map((row) => row.getAttribute("aria-current"))).toEqual([null, "true", null]);
  });

  it("highlights no row when the reward has no level", async () => {
    const dialog = await openDialog(null);

    expect(dialog.querySelector("[aria-current]")).toBeNull();
  });

  it("aligns its content to the start whatever the reward row around it sets", async () => {
    const dialog = await openDialog(1);

    expect(dialog.querySelector(".modal-box")?.classList).toContain("text-start");
  });
});
