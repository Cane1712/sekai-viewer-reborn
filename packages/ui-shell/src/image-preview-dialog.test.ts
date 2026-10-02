import { render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import ImagePreviewDialog from "./image-preview-dialog.svelte";

const caption = createRawSnippet(() => ({ render: () => "<p>Caption text</p>" }));

describe("ImagePreviewDialog content", () => {
  it("shows nothing extra without content", () => {
    const { container } = render(ImagePreviewDialog, { src: "https://cdn.example.test/a.png" });

    expect(container.textContent).not.toContain("Caption text");
    expect(container.querySelector(".modal-box")?.classList).not.toContain("flex-col");
  });

  it("stacks the content below the image, as wide as the image", () => {
    const { container } = render(ImagePreviewDialog, {
      src: "https://cdn.example.test/a.png",
      alt: "Preview",
      children: caption
    });

    const box = container.querySelector(".modal-box");
    expect(box?.classList).toContain("flex-col");
    const text = [...(box?.querySelectorAll("p") ?? [])].find(
      (p) => p.textContent === "Caption text"
    );
    expect(text).toBeTruthy();
    // The content's wrapper takes the image's width instead of widening the box.
    expect(text?.parentElement?.classList).toContain("w-0");
    expect(text?.parentElement?.classList).toContain("min-w-full");
    // It follows the image in document order.
    const image = box?.querySelector("img");
    expect(
      image && text && image.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
