<script lang="ts">
  import { buildHonorDegreeLayout } from "./honor-degree";
  import type { HonorDegreeProps, HonorDegreeSlicedImage } from "./honor-degree.types";

  const componentId = $props.id();
  let {
    honor = null,
    resolveAsset,
    slot = "main",
    size = "L",
    label = "Title",
    title,
    decorative = false,
    class: className = ""
  }: HonorDegreeProps = $props();

  const layout = $derived(buildHonorDegreeLayout(honor, resolveAsset, slot, size));
  const accessibleLabel = $derived(label.trim() || "Title");
  const maskId = (name: string): string => `${componentId}-${name}`;
  const rotation = (image: HonorDegreeSlicedImage): string | undefined => {
    if (!image.rotate) return undefined;
    const first = image.columns[0];
    const last = image.columns.at(-1);
    if (!first || !last) return undefined;
    const centreX = (first.x + last.x + last.width) / 2;
    return `rotate(${image.rotate} ${centreX} ${image.y + image.height / 2})`;
  };
</script>

<!-- One horizontally 9-sliced image: each column crops its source span and stretches it. -->
{#snippet sliced(image: HonorDegreeSlicedImage)}
  <g transform={rotation(image)}>
    {#each image.columns as column, index (index)}
      <svg
        x={column.x}
        y={image.y}
        width={column.width}
        height={image.height}
        viewBox={`${column.sourceX} 0 ${column.sourceWidth} ${image.sourceHeight}`}
        preserveAspectRatio="none"
      >
        <image
          href={image.href}
          width={image.sourceWidth}
          height={image.sourceHeight}
          preserveAspectRatio="none"
        />
      </svg>
    {/each}
  </g>
{/snippet}

{#snippet alphaMask(name: string, image: HonorDegreeSlicedImage)}
  <mask
    id={maskId(name)}
    maskUnits="userSpaceOnUse"
    maskContentUnits="userSpaceOnUse"
    {...{ "mask-type": "alpha" }}
    x={0}
    y={0}
    width={layout.width}
    height={layout.height}
  >
    {@render sliced(image)}
  </mask>
{/snippet}

<svg
  xmlns="http://www.w3.org/2000/svg"
  class={className}
  viewBox={`0 0 ${layout.width} ${layout.height}`}
  width={layout.width}
  height={layout.height}
  style={`width:${Math.round(layout.width * layout.scale)}px;height:${Math.round(layout.height * layout.scale)}px;flex-shrink:0;vertical-align:middle`}
  role={decorative ? undefined : "img"}
  aria-label={decorative ? undefined : accessibleLabel}
  aria-hidden={decorative ? "true" : undefined}
  focusable="false"
>
  {#if !decorative}<title>{title?.trim() || accessibleLabel}</title>{/if}
  {#if layout.layers.length > 0 || layout.bonds}
    <g aria-hidden="true">
      {#if layout.bonds}
        {@const bonds = layout.bonds}
        <defs>
          {#each bonds.backgrounds as background, index (index)}
            {@render alphaMask(`bonds-background-${index}`, background.image)}
          {/each}
          {#if bonds.characterMask}
            {@render alphaMask("bonds-characters", bonds.characterMask)}
          {/if}
          {#each bonds.characters as character, index (index)}
            {#if character.window}
              {@render alphaMask(`bonds-window-${index}`, character.window)}
            {/if}
          {/each}
        </defs>
        {#each bonds.backgrounds as background, index (index)}
          <rect
            data-layer={`bonds-background-${index}`}
            x={0}
            y={0}
            width={layout.width}
            height={layout.height}
            fill={background.color}
            mask={`url(#${maskId(`bonds-background-${index}`)})`}
          />
        {/each}
        {#if bonds.pattern}
          <image
            data-layer="bonds-pattern"
            href={bonds.pattern}
            x={0}
            y={0}
            width={layout.width}
            height={layout.height}
            preserveAspectRatio="none"
          />
        {/if}
        <g mask={bonds.characterMask ? `url(#${maskId("bonds-characters")})` : undefined}>
          {#each bonds.characters as character, index (index)}
            <g mask={character.window ? `url(#${maskId(`bonds-window-${index}`)})` : undefined}>
              <image
                data-layer={`bonds-character-${index}`}
                href={character.href}
                x={character.x}
                y={character.y}
                width={character.width}
                height={character.height}
                preserveAspectRatio="none"
              />
            </g>
          {/each}
        </g>
      {/if}
      {#each layout.layers as layer (layer.name)}
        <image
          data-layer={layer.name}
          href={layer.href}
          x={layer.x}
          y={layer.y}
          width={layer.width}
          height={layer.height}
          preserveAspectRatio={layer.fit === "contain" ? "xMidYMid meet" : "none"}
        />
      {/each}
    </g>
  {:else}
    <text
      x={layout.width / 2}
      y="40"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="currentColor"
      aria-hidden="true">{accessibleLabel}</text
    >
  {/if}
</svg>
