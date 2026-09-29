<script lang="ts">
  import {
    REWARD_CHIP_BUTTON_CLASS,
    REWARD_CHIP_CLASS,
    REWARD_CHIP_ICON_CLASS,
    REWARD_CHIP_QUANTITY_CLASS
  } from "$lib/styles/reward-chip";

  let {
    name,
    iconSrc,
    quantityLabel = null,
    href = null
  }: {
    /** The material's name: the icon's tooltip and accessible label, or the text without an icon. */
    name: string;
    iconSrc: string | null;
    /** Already formatted, for example "×6". */
    quantityLabel?: string | null;
    href?: string | null;
  } = $props();

  let failed = $state(false);
  $effect(() => {
    void iconSrc;
    failed = false;
  });
  const showIcon = $derived(iconSrc !== null && !failed);
  const accessibleLabel = $derived(quantityLabel ? `${name} ${quantityLabel}` : name);
</script>

{#snippet content()}
  {#if showIcon}
    <img
      src={iconSrc}
      alt=""
      class={REWARD_CHIP_ICON_CLASS}
      loading="lazy"
      decoding="async"
      onerror={() => (failed = true)}
    />
  {:else}
    <span class="min-w-0 wrap-anywhere">{name}</span>
  {/if}
  {#if quantityLabel}<span class={REWARD_CHIP_QUANTITY_CLASS} aria-hidden={showIcon}
      >{quantityLabel}</span
    >{/if}
{/snippet}

<!-- A game-asset icon may stand alone (DESIGN.md, Focus and accessibility): the tooltip
     and the accessible label carry the material's name. -->
{#if href}
  <a
    {href}
    class="align-middle {REWARD_CHIP_BUTTON_CLASS}"
    class:tooltip={showIcon}
    data-tip={showIcon ? name : undefined}
    aria-label={showIcon ? accessibleLabel : undefined}
  >
    {@render content()}
  </a>
{:else if showIcon}
  <span
    class="tooltip inline-flex shrink-0 items-center align-middle {REWARD_CHIP_CLASS}"
    data-tip={name}
    role="img"
    aria-label={accessibleLabel}
  >
    {@render content()}
  </span>
{:else}
  <span class="inline-flex min-w-0 items-center align-middle {REWARD_CHIP_CLASS}">
    {@render content()}
  </span>
{/if}
