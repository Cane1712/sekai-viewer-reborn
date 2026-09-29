// Every reward list frames each item the same way: a raised, outlined chip around its
// icon and quantity.
const REWARD_CHIP_SURFACE_CLASS =
  "h-auto min-h-12 max-w-full gap-1.5 border-(--archive-border-default) bg-(--archive-surface-raised) px-2 py-1 text-sm font-semibold text-(--archive-text-default)";

/** A reward item that is not interactive. */
export const REWARD_CHIP_CLASS = `badge badge-outline ${REWARD_CHIP_SURFACE_CLASS}`;

/**
 * A reward item that opens something, such as a title preview. It keeps the badge radius,
 * and lifts and takes the accent tint on hover. The chip is already a 44px touch box, so it
 * needs no `touch-target`, whose `::after` would also take over the tooltip arrow.
 */
export const REWARD_CHIP_BUTTON_CLASS = `btn rounded-selector shadow-none ${REWARD_CHIP_SURFACE_CLASS} transition-[transform,background-color,border-color] duration-180 ease-out hover-lift [@media(hover:hover)]:hover:border-primary/45 [@media(hover:hover)]:hover:bg-primary/10`;

/** The item's icon, or a box of the same size around a fallback glyph. */
export const REWARD_CHIP_ICON_CLASS = "size-10 shrink-0 object-contain";

export const REWARD_CHIP_QUANTITY_CLASS = "shrink-0 tabular-nums text-primary";
