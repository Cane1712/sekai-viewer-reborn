# Detail Page Design Patterns

This document records the unified design patterns for **all detail pages** in `apps/content-site` (Event, Card, Music, Gacha, Virtual Live). Follow these patterns when creating or modifying any detail page.

## 1. Page-Level Layout

All detail pages share the same responsive grid:

```svelte
<section use:swipeRegion class="mx-auto flex w-full flex-col gap-4 px-2">
  <PageHeader ... />
  <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
    <!-- Left column (narrow): visual asset + primary info + secondary cards -->
    <div class="flex flex-col gap-4">
      <AssetCard />           {/* banner/logo/background tabs with zoom preview */}
      <InfoCard />            {/* title, badges, key-value metadata rows */}
      {#if hasSecondary} <SecondaryCard /> {/if}
      {#if hasAdditional} <AdditionalCard /> {/if}
    </div>

    <!-- Right column (wide): one card per detailed content section -->
    <div class="flex flex-col gap-4">
      <InformationCard />
      <SchedulesCard />
      <SetlistsCard />
      ...
    </div>
  </div>
</section>
```

- **Breakpoints**:
  - **Mobile (< 768px)**: single column, all cards stack top-to-bottom in DOM order (left-column cards first, then right-column cards).
  - **md (≥ 768px)**: two columns — left min 300px / max 380px, right `1fr`.
  - **lg (≥ 1024px)**: two columns — left min 320px / max 420px, right `1fr`.
- **Left column**: `items-start` (on md+) so cards don't stretch full height; on mobile they simply flow.
- **Right column**: natural flow, never stretches.
- **Swipe region**: all detail routes use `swipeRegion` action on the section root for region switching.
- **Critical**: the single-column mobile order must match the visual priority — asset → info → secondary → content sections. Do not reorder with `order-*` utilities; let the grid collapse naturally.

### Card detail XL content composition

- `routes/card/[region]/[id]/+page.svelte` keeps the detail rail in its natural
  single-column DOM order below `xl`: Skill, stats, side stories, related
  events, then related gachas.
- At `xl`, the right rail becomes two independent vertical columns rather than
  placing individual cards in an auto-flow grid. The left column contains Skill,
  Side Stories, and related events; the right contains stats and related gachas.
  This avoids a sparse final grid cell and keeps related material grouped with a
  stable reading order.
- Each `CardDetail*` content card remains internally single-column. Use the
  outer rail for wide-screen grouping; do not introduce an internal two-column
  split merely because the page rail has room.

## 2. PageHeader + RegionBadgeSwitch

```svelte
<PageHeader {breadcrumbs} breadcrumbClass="md:max-w-[68%]">
  {#snippet actions()}
    {#if dev && debugJson}
      <button class="btn btn-outline btn-sm" onclick={openDebug}>{t("debugJsonButton")}</button>
    {/if}
    {#await availableRegions}
      <RegionBadgeSwitch options={regionOptions} />
    {/await}
  {/snippet}
</PageHeader>
```

- Breadcrumbs: Home → List Title → Detail Title
- Right actions: debug button (dev only) + region switcher
- Region switcher always uses shared `RegionBadgeSwitch` even for single active region

## 3. Loading Skeletons

All current detail routes reuse
`apps/content-site/src/lib/components/shared/DetailPageSkeleton.svelte` from their
streamed payload pending branch. Pass the route-specific `kind` (`card`, `event`,
`music`, `gacha`, or `virtual-live`) rather than duplicating page-level skeleton
markup.

The shared component mirrors the final responsive column structure and varies the
media ratio, tab rail, metadata-row count, and right-column content density by
detail type. Music keeps its square jacket and switches to two columns at `lg`;
the other details use the standard `md` two-column breakpoint. This reserves a
closer approximation of the loaded page height and reduces layout movement.

Skeletons remain decorative (`aria-hidden="true"`); the surrounding streamed
region owns loading semantics. Use daisyUI's `skeleton` surface consistently
instead of mixing it with hand-built `animate-pulse bg-base-300` blocks.

Usage:

```svelte
{#await payload}
  <PageHeader ...><RegionBadgeSwitch options={currentRegionOnly} /></PageHeader>
  <DetailPageSkeleton kind="event" />
{:then payload}
  ...
{/await}
```

- Keep the shared skeleton's media ratios aligned when final media components change.
- Extend the `kind` union when adding a materially different detail-page structure.

## 3.5 Touch / Hover Interaction Rules

**Hover effects must not activate on touch devices.** This applies to all detail page components:

| Component                           | Hover Effect                | Touch Behavior                        |
| ----------------------------------- | --------------------------- | ------------------------------------- |
| `EventCardFrame` / `hover-3d` cards | 3D lift + shadow            | No lift; static elevation only        |
| `EventListCard` / `CardListCard`    | translation + brightness    | No translation; image stays sharp     |
| `ImagePreviewDialog` trigger        | cursor change, subtle scale | Tap opens dialog (no preview hover)   |
| Tab buttons (`AssetCard` tabs)      | background color shift      | Tap switches tab (no hover state)     |
| Links in music/card lists           | `hover:underline`           | Tap navigates (no underline on touch) |
| Badge/buttons with `hover:*`        | color/scale changes         | Active/tap state only via `:active`   |

**Implementation patterns:**

```css
/* In app.css or component styles — wrap hover effects in media query */
@media (hover: hover) and (pointer: fine) {
  .hover-3d:hover {
    transform: translateY(-4px) rotateX(2deg);
  }
  .card-link:hover .card-image {
    filter: brightness(1.05);
  }
  .tab-button:hover {
    background: var(--p);
  }
}

/* Touch devices get :active for immediate feedback */
@media (hover: none) and (pointer: coarse) {
  .card:active {
    transform: scale(0.99);
  }
  .tab-button:active {
    background: var(--p);
  }
}
```

- Use `@media (hover: hover) and (pointer: fine)` to gate hover-only effects (mouse/stylus).
- Use `@media (hover: none) and (pointer: coarse)` for touch-specific `:active` feedback.
- Never rely on `ontouchstart`/`ontouchend` to toggle hover classes — it causes sticky hover states on iOS Safari.
- `EventCardFrame.svelte` and `EventListCard.svelte` already implement this via `hover-3d` utility which respects `data-low-motion` and pointer media queries. Reuse them instead of writing custom hover CSS.
- Tooltips: use the accessible tooltip pattern (hover + focus + click/touch) from `content-site-ui-conventions.md` §Accessible Contextual Notes — never `title` attribute or hover-only tooltip.

### 3.6 Dismissible Overlays Must Have Backdrop

Any menu, dialog, dropdown, or popover that closes on outside click **must render a backdrop overlay** that:

1. **Covers the entire viewport** (`fixed inset-0`) at a z-index below the dialog but above page content.
2. **Captures all pointer events** — clicks/taps on the backdrop close the overlay; they never reach underlying links, buttons, or cards.
3. **Is keyboard accessible** — `Escape` key closes the overlay; focus is trapped inside the dialog while open.
4. **Provides visual separation** — semi-transparent background (`bg-black/40 dark:bg-black/60` or `bg-base-100/80 backdrop-blur-sm`) so users understand the modal context.

**Implementation pattern (Svelte):**

```svelte
{#if open}
  <div
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
    role="presentation"
    aria-hidden="true"
    onclick={() => close()}
    ontouchstart={() => {}}
  />
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="relative w-full max-w-lg rounded-2xl bg-base-100 shadow-xl">
      <!-- dialog content -->
    </div>
  </div>
{/if}
```

**Existing components that follow this:**

- `ImagePreviewDialog` (`@platform/ui-shell`) — full-screen backdrop, click outside closes, `Escape` closes
- `EventDebugDialog` — same pattern
- Region badge popover in `RegionBadgeSwitch.svelte` — backdrop captures outside taps

**Anti-patterns to avoid:**

| ❌ Don't                                                              | ✅ Do                                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| No backdrop; click passes through to page links                       | Full-viewport backdrop at correct z-index                              |
| `pointer-events: none` on backdrop                                    | Backdrop has `onclick={close}`                                         |
| Only `Escape` closes; no click-outside                                | Both click-outside + `Escape`                                          |
| Backdrop behind dialog but above content, so clicks still hit content | Backdrop covers entire viewport, dialog sits above it                  |
| z-index wars between multiple overlays                                | Single overlay stack: backdrop (z-40) → dialog (z-50) → tooltip (z-60) |

## 4. Visual Asset Card (Left Column, First)

All detail pages lead with a media card that supports **tabbed asset views** + **click-to-zoom preview**.

### Canonical Detail Media Radius

All primary detail-page media previews use the shared constants from
`apps/content-site/src/lib/styles/detail-media.ts`:

```ts
export const DETAIL_MEDIA_RADIUS_CLASS = "rounded-2xl";
export const DETAIL_MEDIA_BUTTON_CLASS = "block h-full w-full overflow-hidden rounded-2xl";
```

Apply the canonical radius to every visible layer of the preview:

1. the gray `content-card-inset` media container;
2. the interactive `AssetImage` button wrapper;
3. the image itself;
4. the corresponding loading skeleton.

This rule applies to Event, Card, Music, Gacha, and Virtual Live detail media.
Do not use arbitrary values such as `rounded-[1.75rem]` for primary detail media.
Dialog images may keep their own modal radius, but currently also use
`rounded-2xl` for visual consistency.

```svelte
<article class="card content-card-shell overflow-hidden shadow-sm">
  <div class="card-body gap-3 p-3 sm:p-5 text-center">
    <div class="tabs tabs-box content-card-inset w-full p-1">
      <button class={getTabClass("banner")} onclick={() => (activeTab = "banner")}>
        {bannerLabel}
      </button>
      <button class={getTabClass("title")} onclick={() => (activeTab = "title")}>
        {titleLabel}
      </button>
      <button class={getTabClass("background")} onclick={() => (activeTab = "background")}>
        {backgroundLabel}
      </button>
      {#if shouldShowCharacterTab}
        <button class={getTabClass("characters")} onclick={() => (activeTab = "characters")}>
          {charactersLabel}
        </button>
      {/if}
    </div>

    <div
      class="content-card-inset w-full overflow-hidden rounded-2xl transition-[aspect-ratio] duration-300 ease-out
         {isCompactTab(activeTab) ? 'aspect-16/7' : 'aspect-16/10'}"
    >
      {#if activeTab === "banner"}
        {@render previewImage(bannerUrl, alt, "h-full w-full object-contain p-4 md:p-6")}
      {:else if activeTab === "title"}
        {@render previewImage(logoUrl, alt, "h-full w-full object-contain p-4 md:p-6")}
      {:else if activeTab === "background"}
        {@render previewImage(bgUrl, alt, "h-full w-full object-cover")}
      {:else}
        {@render previewImage(charUrl, alt, "h-full w-full object-contain", unavailableLabel)}
      {/if}
    </div>
  </div>
</article>
```

### Preview Image Snippet + ImagePreviewDialog

```svelte
{#snippet previewImage(src, alt, imageClass, fallbackLabel = "")}
  <AssetImage
    {src}
    {alt}
    {fallbackLabel}
    buttonClass="block h-full w-full overflow-hidden"
    interactive={true}
    {imageClass}
    onclick={() => (previewOpen = true)}
  />
  <ImagePreviewDialog
    bind:open={previewOpen}
    {src}
    {alt}
    {fallbackLabel}
    {closeLabel}
    formatOptions={["webp", "png"]}
    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
  />
{/snippet}
```

- Tabs: banner/title/background always; characters conditional
- Compact tabs (banner/title) → `aspect-16/7`; others → `aspect-16/10`
- `AssetImage` with `interactive={true}` + `onclick` opens `ImagePreviewDialog`
- Dialog: `formatOptions={["webp", "png"]}`, consistent `dialogImageClass`

## 5. Primary Info Card (Left Column, Second) — **Reusable Design Paradigm**

This card is **the canonical info card** used by **every detail page** (Event, Card, Music, Gacha, Virtual Live). Do not create variations — follow this exact structure.

```svelte
<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <!-- Section header: icon + label + right-aligned ID badge -->
    <div class="flex items-start justify-between gap-3">
      <p
        class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon icon="mdi:information-outline" class="size-4 shrink-0" aria-hidden="true" />
        <span>{detailTitleLabel}</span>
      </p>
      <span class="badge badge-outline border-base-content/20 font-semibold">
        #{id}
      </span>
    </div>

    <!-- Metadata rows: name first; omit any row whose value is unavailable -->
    <dl class="space-y-2">
      <div class="content-card-inset rounded-xl p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameRowLabel}</dt>
        <dd class="mt-1 wrap-break-word text-sm font-medium">{title ?? id}</dd>
      </div>

      {#if status}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {statusLabel}
          </dt>
          <dd class="mt-1 wrap-break-word text-sm font-medium">{displayValue(status)}</dd>
        </div>
      {/if}

      {#if type}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{typeLabel}</dt>
          <dd class="mt-1 wrap-break-word text-sm font-medium">{displayValue(type)}</dd>
        </div>
      {/if}

      {#each [[startAtLabel, formatDate(startAt)], [endAtLabel, formatDate(endAt)], [platformLabel, displayValue(platform)], [seqLabel, displayValue(seq)], [resourceCodeLabel, displayValue(assetBundleName)]] as row (row[0])}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {row[0]}
          </dt>
          <dd class="mt-1 wrap-break-word text-sm font-medium">{row[1]}</dd>
        </div>
      {/each}
    </dl>
  </div>
</article>
```

### Mandatory Structure (never deviate)

| Part              | Required | Style Tokens                                                                             |
| ----------------- | -------- | ---------------------------------------------------------------------------------------- |
| **Header**        | ✅ Yes   | `flex items-start justify-between gap-3`                                                 |
| Header icon       | ✅ Yes   | `mdi:information-outline`, `size-4 shrink-0`                                             |
| Header label      | ✅ Yes   | `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60` |
| ID badge          | ✅ Yes   | `badge badge-outline border-base-content/20 font-semibold` → `#{id}`                     |
| **Metadata rows** | ✅ Yes   | `dl class="space-y-2"` → each row `content-card-inset rounded-xl p-3 sm:px-4`            |
| Row label (`dt`)  | ✅ Yes   | `text-xs font-semibold uppercase tracking-[0.16em] opacity-60`                           |
| Row value (`dd`)  | ✅ Yes   | `mt-1 wrap-break-word text-sm font-medium`                                               |

**First row is always the name/title** (e.g., `event.title`, `card.title`, `music.title`, `virtualLive.name`). **Rows are omitted, never placeholder-filled**: render a row only when its value exists, guarded by `{#if}` — this matches `MusicDetailInfoCard.svelte`, which defines neither a status nor a type row, and Event/Card/Gacha, which render the type row only when a value exists. Status and type are subsequent rows, **not badges**. This matches `EventDetailInfoCard.svelte` exactly.

### Page-Specific Variations (only these)

| Page         | `detailTitleLabel` i18n key | Status values          | Type values       | Extra rows                |
| ------------ | --------------------------- | ---------------------- | ----------------- | ------------------------- |
| Event        | `eventDetailTitle`          | upcoming/ongoing/ended | `eventType`       | `unit`, `bannerCharacter` |
| Card         | `cardDetailTitle`           | —                      | `cardRarityType`  | `unit`, `character`       |
| Music        | `musicDetailTitle`          | —                      | `musicType`       | `jacketAttr`, `bpm`       |
| Gacha        | `gachaDetailTitle`          | open/closed            | `gachaType`       | `pickupCount`, `ceiling`  |
| Virtual Live | `virtualLiveDetailTitle`    | upcoming/ongoing/ended | `virtualLiveType` | —                         |

**Only** the i18n key, status/type enum values, and optional extra rows (unit, character, etc.) may differ. The **structure, spacing, typography, and inset rows must be identical**.

```svelte
<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <!-- Section header: icon + label + right-aligned ID badge -->
    <div class="flex items-start justify-between gap-3">
      <p
        class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon icon="mdi:information-outline" class="size-4 shrink-0" aria-hidden="true" />
        <span>{detailTitleLabel}</span>
      </p>
      <span class="badge badge-outline border-base-content/20 font-semibold">
        #{id}
      </span>
    </div>

    <!-- Metadata rows: each in content-card-inset -->
    <dl class="space-y-2">
      {#each [[nameLabel, title ?? id], [statusLabel, statusLabel(status)], [typeLabel, typeLabel(type)], [startAtLabel, formatDate(startAt)], [endAtLabel, formatDate(endAt)], [platformLabel, displayValue(platform)], [seqLabel, displayValue(seq)], [resourceCodeLabel, displayValue(assetBundleName)]] as row (row[0])}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {row[0]}
          </dt>
          <dd class="mt-1 wrap-break-word text-sm font-medium">{row[1]}</dd>
        </div>
      {/each}
    </dl>
  </div>
</article>
```

### Key Style Tokens (must match exactly)

| Element        | Classes                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------- |
| Section label  | `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60` |
| Icon in label  | `size-4 shrink-0` + `aria-hidden="true"`                                                 |
| ID badge       | `badge badge-outline border-base-content/20 font-semibold`                               |
| Main title     | `wrap-break-word text-2xl/tight font-bold sm:text-3xl`                                   |
| Status badge   | `badge badge-primary font-semibold`                                                      |
| Type badge     | `badge badge-outline font-semibold`                                                      |
| Metadata row   | `content-card-inset rounded-xl p-3 sm:px-4`                                              |
| Row label (dt) | `text-xs font-semibold uppercase tracking-[0.16em] opacity-60`                           |
| Row value (dd) | `mt-1 wrap-break-word text-sm font-medium`                                               |

## 6. Secondary Cards (Left Column, Optional)

Waiting room, additional data, etc. follow the same card shell but with simpler content:

```svelte
<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-5">
    <h2
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon icon="mdi:door-open" class="size-4 shrink-0" aria-hidden="true" />
      <span>{waitingRoomTitle}</span>
    </h2>
    <dl class="grid gap-3 text-sm">
      <div class="content-card-inset rounded-2xl p-4">
        <dt class="opacity-55">{startLabel}</dt>
        <dd class="mt-1 font-semibold">{formatDate(startAt)}</dd>
      </div>
      ...
    </dl>
  </div>
</article>
```

- Use `content-card-inset rounded-2xl p-4` for inner rows when they need more padding
- Section title uses same icon+label pattern

## 7. Detail Data Cards (Right Column)

Each right-column content category is its own card. Information, Schedules, Setlists, Characters, and Rewards remain visually separate, but they must use exactly the same outer padding and section-title structure.

### Canonical Detail-Section Title

All small section titles on detail pages use one canonical style. The reference implementation is `EventDetailInfoCard.svelte`; `EventDetailDataCard.svelte`, `EventDetailBgmCard.svelte`, `EventDetailCountdownCard.svelte`, and the Virtual Live detail sections must match it exactly.

```svelte
<h2
  id={sectionTitleId}
  class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
>
  <Icon icon={sectionIcon} class="size-4 shrink-0 translate-y-[0.5px]" aria-hidden="true" />
  <span>{sectionTitle}</span>
</h2>
```

The same style applies to:

- Event detail: Info, Countdown, BGM, Bonus Characters, Rarity Bonus, Featured Cards, Event Musics, Ranking Rewards, Virtual Live
- Virtual Live detail: Info, Waiting Room, Additional Data, Information, Schedules, Characters, Setlists, Rewards
- Equivalent section headers introduced on Card, Music, or Gacha detail pages

For Virtual Live Waiting Room, show the start and end times only. Do not display
`waitingRoom.assetBundleName`: the observed value is a fixed sample/placeholder,
Moesekai and the upstream viewer do not render it, and no accessible public asset
path is confirmed. Do not expose the bundle filename or guess an image URL.

Locked visual tokens:

| Property             | Required token                    |
| -------------------- | --------------------------------- |
| Font size            | `text-xs`                         |
| Font weight          | `font-semibold`                   |
| Case                 | `uppercase`                       |
| Letter spacing       | `tracking-[0.18em]`               |
| Text color/intensity | inherit text color + `opacity-60` |
| Text/icon gap        | `gap-1.5`                         |
| Icon size            | `size-4 shrink-0`                 |
| Icon baseline        | `translate-y-[0.5px]`             |

Do not use `text-sm`, `gap-2`, `tracking-normal`, or icon-only `opacity-70` for detail-section titles. Those values create a visibly different hierarchy and were the source of the previous inconsistency in `EventDetailDataCard.svelte`.

```svelte
{#if hasInformation}
  <article class="card content-card-shell shadow-sm">
    <div class="card-body gap-4 p-3 sm:p-5">
      <section class="space-y-2" aria-labelledby="detail-information-title">...</section>
    </div>
  </article>
{/if}

{#if schedules.length > 0}
  <article class="card content-card-shell shadow-sm">
    <div class="card-body gap-4 p-3 sm:p-5">
      <section class="space-y-2" aria-labelledby="detail-schedules-title">
        <h2
          id="detail-schedules-title"
          class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
        >
          <Icon
            icon="mdi:calendar-clock"
            class="size-4 shrink-0 translate-y-[0.5px]"
            aria-hidden="true"
          />
          <span>{schedulesTitle}</span>
        </h2>

        <VirtualLiveScheduleSwitcher
          {schedules}
          uiLocale={displayLocale}
          virtualLiveId={String(id)}
          labelledBy="detail-schedules-title"
          unavailableLabel={valueUnavailable}
          afterEventLabel={scheduleIsAfterEventLabel}
        />
      </section>
    </div>
  </article>
{/if}

Virtual Live schedules are **not** rendered as a flat list of cards. The canonical component is
`VirtualLiveScheduleSwitcher.svelte`, which groups schedules by **local calendar date** and exposes
one date group at a time behind accessible date tabs. **Schedule switcher behavior (canonical):** -
**Date grouping + tabs**: schedules are bucketed by their calendar day using `Intl.DateTimeFormat`
with the browser/UI locale (so grouping and labels are locale-consistent). Each date becomes a
horizontal `role="tablist"` tab showing the short `weekday month day` label and a count badge. Tabs
scroll horizontally (`overflow-x-auto`, marked `data-swipe-region-skip` so region swipe does not
hijack the tab strip). - **One group at a time**: only the active date group's schedules render in a
`role="tabpanel"` below the tabs. - **Active/next/final default selection**: `defaultGroupKey`
chooses the active group on load — first a group with a schedule currently in progress (start ≤ now
≤ end); else the next future date; else the last dated group; else the final group (e.g. an
"unavailable" group). - **Keyboard navigation**: Arrow Left/Right wrap between tabs, Home/End jump
to first/last; `tabindex` roving (active tab `0`, others `-1`); selecting via keyboard focuses the
new tab. - **Swipe exclusion**: the tab strip is marked `data-swipe-region-skip`, so horizontal
swipe over the tabs performs tab scroll, not region switching. - **Chronological ranges**: within a
day, schedules are sorted by start time. Each row shows a compact `start time – end time` range
using the locale time formatter (`hour: "2-digit", minute: "2-digit"`). - **No seq / Order labels**:
internal `seq` / `Order` values are never shown to users. The `virtualLiveScheduleSeqLabel` i18n key
was removed. - **Cross-midnight clarity**: when a schedule's end time falls on a different calendar
day than its start, the end is formatted with the full `weekday month day hour:minute` formatter so
the date is explicit; same-day ends show time only. - **After Event is secondary**: a schedule with
`isAfterEvent` renders a small `badge-outline badge-sm` `After Event`
(`virtualLiveScheduleIsAfterEventLabel`) on the right; it is not a primary sort key or heading. -
**Unavailable times**: schedules with unparseable start/end times fall into an "unavailable" group
(`virtualLiveValueUnavailable`) rendered last.
```

**§7.7 Virtual Live Characters (canonical):**

Characters come **before** Setlists in the right column. The canonical component renders only a compact wrapping row of `CharacterAvatar` portraits for `virtualLiveCharacters[]`: no visible IDs, names, units, performance types, or individual card shells.

- **Reliable enrichment, not raw IDs**: each character entry exposes `gameCharacterUnitId`. Map it through `gameCharacterUnits.id` → `gameCharacterId`, owning `unit`, and `colorCode` (`apps/content-site/src/lib/server/virtual-live-detail.ts`). Use that `gameCharacterId` for the avatar (`CharacterAvatar` derives the `colorCode` border from it) and for the profile link to `/character/[region]/[id]`.
- **Graceful placeholders**: when `gameCharacterUnitId` is missing or does not resolve to a `gameCharacterId`, render the avatar in a disabled/placeholder state (no link) rather than showing a raw ID or guessing. `subGameCharacter2dId` is defined by the viewer parser but absent in observed API samples, so do not depend on it.
- **No guessed direct 3D mapping**: `setlist.character3dId1..6` is a separate
  3D ID space and must never be treated as a profile ID. The Timeline endpoint
  may resolve a `character3dId` through the region-scoped Character3D batch
  contract (`character3ds.id → gameCharacterId`) before rendering an avatar or
  profile link; without that lookup, leave the ID unlinked.
- **Accessible identity**: keep the profile link's accessible label and tooltip even though identity text is not displayed beside the portrait.

**§7.8 Virtual Live Setlists (canonical):**

Setlists are **not** rendered as a flat inline grid on the detail page. The page shows a compact **summary**, and the full ordered list lives in an accessible scrollable **dialog**.

- **Summary on page**: the Setlists card shows the first items in performance order (`virtualLiveSetlistPreviewLabel`) plus an item count (`virtualLiveSetlistItemCount`, e.g. `{count} setlist items`) and a "View full setlist" button (`virtualLiveSetlistViewFullButton`). This keeps long setlists (observed 3–11 items) from bloating the right column.
- **Full dialog**: the button opens `VirtualLiveSetlistSummary` (or equivalent) as a native, accessible scrollable dialog — `role="dialog"`, `aria-modal`, backdrop that closes on outside click/`Escape`, focus trapped while open (see §3.6). It lists every step in performance order and expands exactly one step at a time.
- **Music step**: show enriched jacket, title/detail link, selected vocal metadata and performer avatars. Mount `AudioPlayer` only while expanded, using the exact vocal long-audio asset and music-level `fillerSec`; never autoplay or substitute another vocal.
- **MC timeline step**: fetch `/virtual-live/:region/:id/timeline/:setlistId`
  only after expansion. Cache per dialog and scope errors to the row. The server
  supports both modern `mc_timeline` `.playable` assets and legacy `mc`
  `.asset` scenarios, while other unconfirmed setlist formats remain unsupported.
  Default to dialogue, annotation, cast, and audio; expose all categories and
  unknown events, state filtered/full counts, and reveal batches of 100.
  Preserve dialogue line breaks. Resolve Timeline 3D IDs only through the
  region-scoped Character3D lookup before linking to a profile.
- **3D IDs are labeled, not linked**: if `character3dId1..6` are shown for transparency, label them with `virtualLiveSetlistCharacter3dLabel` ("3D character IDs") and do not turn them into profile links.
- i18n keys: `virtualLiveSetlistDialogTitle`, `virtualLiveSetlistItemCount`, `virtualLiveSetlistPreviewLabel`, `virtualLiveSetlistViewFullButton`, `virtualLiveSetlistCharacter3dLabel`.

Right-column cards use `EventDetailDataCard.svelte` as the canonical style:

- Outer card: `card content-card-shell shadow-sm`
- Body: `card-body gap-4 p-3 sm:p-5`
- Outer-card count: one per available data category
- Section count: exactly one `section.space-y-2` inside each card
- Section: `space-y-2` with stable `aria-labelledby`
- Header: `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60`
- Header icon: `size-4 shrink-0 translate-y-[0.5px]`
- Inner row/card: `content-card-inset rounded-xl p-3`
- Two-column collection: `grid gap-2 sm:grid-cols-2`
- Vertical collection: `space-y-2`
- Data label: `text-xs font-semibold uppercase tracking-[0.16em] opacity-60`
- Primary value: `text-sm font-semibold`
- Secondary value: `text-xs opacity-60` or `opacity-70`

Every detail-section card uses the same title typography as the primary information card. Waiting Room, Additional Data, Information, Schedules, Characters, Setlists, and Rewards must all match in font size, weight, color/opacity, letter spacing, icon size, and icon baseline alignment.

Virtual Live Additional Data must use `VirtualLiveAdditionalData.svelte` and render
the typed related objects as human-readable content, never as raw JSON or a field
count. Show group name/period, Screen MV song title and link plus vocal metadata and
performer avatars, pamphlet name/description, and ticket name/description/type.
Hide internal ids, asset bundle names, sequence and release-condition metadata, and
omit the entire card when no meaningful content is populated.

Information, Schedules, Characters, Setlists, and Rewards should remain separate outer cards. Their visual consistency comes from identical card-body padding and identical header markup—not from merging them into one card.

### Right Column Card Variants

| Section         | Icon                     | Inner Layout                                                                                                                           |
| --------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Information     | `mdi:text-box-outline`   | one `content-card-inset space-y-2 rounded-xl p-3` containing summary + description                                                     |
| Schedules       | `mdi:calendar-clock`     | `VirtualLiveScheduleSwitcher` — date-grouped accessible tabbed switcher (see §7 canonical behavior); not a flat grid                   |
| Characters      | `mdi:account-group`      | avatar grid via `gameCharacterUnitId`→`gameCharacterId` enrichment (see §7.7); graceful placeholders when unmapped                     |
| Setlists        | `mdi:playlist-check`     | summary on the page + full ordered list in `VirtualLiveSetlistSummary` accessible scrollable dialog (see §7.8); not a flat inline grid |
| Rewards         | `mdi:gift-outline`       | `grid gap-2 sm:grid-cols-2`; each row `rounded-xl p-3`                                                                                 |
| Event Bonus     | `mdi:cards-outline`      | grouped character cards                                                                                                                |
| Event Music     | `mdi:music-note-outline` | list with thumbnails                                                                                                                   |
| Ranking Rewards | `mdi:gift-outline`       | range cards with reward chips                                                                                                          |

## 9. Related Items Display Patterns

When a detail page shows related entities (cards, musics, events, gachas, virtual lives), follow these patterns.

### 9.1 Event Detail → Related Cards / Musics / Virtual Lives

Event detail right column uses focused card shells (see `EventDetailDataCard.svelte`):

| Related Type    | Component                  | Display Pattern                                                                       |
| --------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| Bonus Rules     | —                          | grouped by bonus character; show attribute icons, counts, rates                       |
| Featured Cards  | `CardThumbnail`            | grid `gap-3 sm:grid-cols-2`; each shows artwork, name, rarity, attribute, bonus badge |
| Event Musics    | `EventAssetImage` (jacket) | list `space-y-3`; thumbnail + title + link to `/music/:region/:id`                    |
| Ranking Rewards | —                          | range cards (`content-card-inset`) with reward chips (quantity, type, thumbnail)      |
| Virtual Live    | `EventAssetImage` (banner) | single `content-card-inset` with banner (`aspect-[33/10]`) + time range chip          |

**Rules:**

- Use enriched `/events/{region}/{id}/cards` and `/musics` relation rows for display fields (don't re-fetch per-item detail).
- Render card thumbnails via `CardThumbnail.svelte`; music jackets via `EventAssetImage.svelte`.
- Keep IDs as secondary metadata + links, not primary content.
- Ranking rewards: expand `resourceBox.details` into chips; hide rewards without resolved details; hide empty ranges.
- Label ranges: Top rank (`#1000` or better) → "Top Rank" badge; explicit borders/non-top → "Ranges" badge; final degree reward always labeled.

### 9.2 Card Detail → Related Gachas / Events

Card detail right column (`CardDetailGachaCard.svelte`, `CardDetailEventsCard.svelte`):

| Related Type  | Pattern                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gacha banners | "Latest + first + expand": show most recent and earliest gacha only by default; `btn btn-ghost btn-sm` expand button reveals full descending list. Sort by `startAt` desc. |
| Events        | Same "latest + first + expand" pattern for event cards (`EventListCard` inside).                                                                                           |

**Implementation:**

- `CardDetailGachaCard.svelte` — takes `gacha[]`, sorts desc, computes `hiddenCount`, renders first/last + expand toggle.
- `CardDetailEventsCard.svelte` — wraps `EventListCard` in same pattern.

### 9.3 Music Detail → Related Events / Cards

Music detail uses inline related sections:

| Related Type                | Pattern                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| Events featuring this music | `EventListCard` in `grid gap-3 sm:grid-cols-2` (max 6, then expand) |
| Cards with this music       | `CardThumbnail` grid `gap-2 sm:grid-cols-3` (inventory density)     |

### 9.4 Gacha Detail → Related Cards / Events

Gacha detail right column:

| Related Type   | Pattern                                                         |
| -------------- | --------------------------------------------------------------- |
| Pickup cards   | `CardThumbnail` grid `gap-2 sm:grid-cols-3` (inventory density) |
| Related events | `EventListCard` grid `gap-3 sm:grid-cols-2`                     |

### 9.5 Virtual Live Detail → Related Items (Extrapolated from Event Detail)

Following Event detail's approach, Virtual Live detail should surface related entities in the right column using focused card shells. Each section gets its own card with icon+label header.

| Related Type                           | Source Endpoint                                                                                                        | Display Pattern                                                                               | Component                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Events featuring this virtual live** | `/events/{region}/list?virtualLiveId={id}` (or enriched from event detail aggregate)                                   | `EventListCard` grid `gap-3 sm:grid-cols-2`                                                   | `EventListCard.svelte`                    |
| **Cards from setlists**                | `/virtual-lives/{region}/{id}/setlists` → `musicId` → `/cards/{region}/{id}` (or enriched setlist rows with card refs) | `CardThumbnail` grid `gap-2 sm:grid-cols-3 md:grid-cols-4` (inventory density)                | `CardThumbnail.svelte`                    |
| **Musics from setlists**               | `/virtual-lives/{region}/{id}/setlists` (enriched with music metadata)                                                 | Event-style music list: jacket left (`size-16`), title + `#id` + attribute right, `space-y-2` | inline with `EventAssetImage`             |
| **Characters appearing**               | `/virtual-lives/{region}/{id}` (already in `characters[]`)                                                             | Already shown in right column "Characters" section — no separate cross-ref needed             | `CharacterAvatar.svelte` (`variant="lg"`) |
| **Rewards / resource boxes**           | `/virtual-lives/{region}/{id}` (already in `rewards[]`)                                                                | Already shown in right column "Rewards" section                                               | inline chips                              |

**Implementation notes:**

- **Events grid**: same as Event detail related events — use `EventListCard` with `hover-3d` frame, banner `aspect-[33/10]`, status/type badges, unit icon (`variant="sm"`), spoiler overlay if `startAt > now`.
- **Cards grid**: inventory density (`aspect-square`, `gap-1.5`, `ring-2` rarity border). Each card links to `/card/:region/:id`. Use `loadMode="visible"`.
- **Musics list**: follow Event detail music pattern exactly — `EventAssetImage` jacket (`size-16 rounded-lg object-cover`), right side: title (semibold), `#id · attr` (text-xs opacity-60), view-detail link. Wrap each in `content-card-inset rounded-xl p-3`.
- **Setlists already shown**: the main "Setlists" section in right column is intrinsic data. Cross-ref cards/musics are _additional_ discovery paths.
- **Skeleton**: mirror the final card shells (event skeleton = banner + badges + title; card skeleton = square with ring; music skeleton = jacket + 2 text lines).

**Right column order (with cross-refs added):**

```
Information (intrinsic)
Schedules (intrinsic)
Characters (intrinsic)
Setlists (intrinsic)
Rewards (intrinsic)
──────────────────────────
Related Events (cross-ref)
Related Cards from Setlists (cross-ref)
Related Musics from Setlists (cross-ref)
```

### 9.6 Shared Density Rules

| Density Level       | Use Case                                   | Grid                                                                                                                         |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Content card        | Event musics, related events               | `gap-3 sm:grid-cols-2`                                                                                                       |
| Inventory thumbnail | Pickup cards, gacha cards, card thumbnails | `gap-1.5`, `grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6`, square `aspect-square`, minimal chrome |
| Compact chip        | Rewards, ranking ranges                    | `flex flex-wrap gap-2` with `content-card-inset min-w-36`                                                                    |

### 9.7 Asset Helpers

| Asset Type                   | Helper                                                                           | Fallback                                    |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------- |
| Card normal/after-training   | `getCardNormalAssetURL` / `getCardAfterTrainingAssetURL`                         | `EventAssetImage` with `fallbackSrc` = logo |
| Card transparent/cutout      | `getCardCutoutAssetURL`                                                          | same                                        |
| Event banner/logo/background | `getEventBannerAssetURL` / `getEventLogoAssetURL` / `getEventBackgroundAssetURL` | —                                           |
| Music jacket                 | `getMusicJacketAssetURL`                                                         | —                                           |
| Gacha banner/logo            | `getGachaBannerAssetURL` / `getGachaLogoAssetURL`                                | logo as fallback for banner                 |
| Virtual Live banner          | `getVirtualLiveBannerAssetURL`                                                   | —                                           |
| Character thumbnail          | `getLocalCharacterThumbnailAssetURL`                                             | `CharacterAvatar` default                   |

Always use `EventAssetImage.svelte` (or `AssetImage.svelte` for non-event) with appropriate `loadMode="visible"` for lists.

## 10. Icon Registry (mdi.ts)

All detail-page icons must be registered in `apps/content-site/src/lib/icons/mdi.ts` under the "Detail pages" section:

```typescript
// Detail pages
import informationOutline from "@iconify-icons/mdi/information-outline";
import timerSand from "@iconify-icons/mdi/timer-sand";
import chartBar from "@iconify-icons/mdi/chart-bar";
import chartBoxOutline from "@iconify-icons/mdi/chart-box-outline";
import eyeOutline from "@iconify-icons/mdi/eye-outline";
import playCircleOutline from "@iconify-icons/mdi/play-circle-outline";
import cardAccountDetailsOutline from "@iconify-icons/mdi/card-account-details-outline";
import creationOutline from "@iconify-icons/mdi/creation-outline";
import bookOpenPageVariantOutline from "@iconify-icons/mdi/book-open-page-variant-outline";
import microphoneVariant from "@iconify-icons/mdi/microphone-variant";
import percentOutline from "@iconify-icons/mdi/percent-outline";
import doorOpen from "@iconify-icons/mdi/door-open";
import accountGroup from "@iconify-icons/mdi/account-group";
import calendarClock from "@iconify-icons/mdi/calendar-clock";
import playlistCheck from "@iconify-icons/mdi/playlist-check";
import puzzle from "@iconify-icons/mdi/puzzle";
import textBoxOutline from "@iconify-icons/mdi/text-box-outline";
import giftOutline from "@iconify-icons/mdi/gift-outline";
import cardsOutline from "@iconify-icons/mdi/cards-outline";
import musicNoteOutline from "@iconify-icons/mdi/music-note-outline";

// Register
addIcon("mdi:information-outline", informationOutline);
addIcon("mdi:timer-sand", timerSand);
...
addIcon("mdi:door-open", doorOpen);
addIcon("mdi:account-group", accountGroup);
addIcon("mdi:calendar-clock", calendarClock);
addIcon("mdi:playlist-check", playlistCheck);
addIcon("mdi:puzzle", puzzle);
addIcon("mdi:text-box-outline", textBoxOutline);
addIcon("mdi:gift-outline", giftOutline);
addIcon("mdi:cards-outline", cardsOutline);
addIcon("mdi:music-note-outline", musicNoteOutline);
```

## 11. Shared Components Reused

| Pattern                       | Component                                                          |
| ----------------------------- | ------------------------------------------------------------------ |
| Page header + breadcrumbs     | `PageHeader` + `RegionBadgeSwitch`                                 |
| Visual asset with tabs + zoom | `EventDetailAssetCard.svelte` (Event) / inline pattern (others)    |
| Metadata rows                 | `dl` + `content-card-inset` (no separate component)                |
| Character avatar              | `CharacterAvatar.svelte` (`variant="lg"`)                          |
| Unit icon                     | `UnitIconBadge.svelte` (`variant="lg"`)                            |
| Audio player                  | `AudioPlayer` from `@platform/ui-shell` (`EventDetailBgmCard`)     |
| Voice play button             | `VoicePlayButton` from `@platform/ui-shell` (`CardDetailInfoCard`) |
| Debug dialog                  | `EventDebugDialog.svelte`                                          |
| Image preview                 | `ImagePreviewDialog` from `@platform/ui-shell`                     |

## 12. i18n Namespace Mapping

| Page                | i18n Namespace      |
| ------------------- | ------------------- |
| Event detail        | `event.json`        |
| Card detail         | `card.json`         |
| Music detail        | `music.json`        |
| Gacha detail        | `gacha.json`        |
| Virtual Live detail | `virtual-live.json` |

Use `t("key")` with keys scoped to the namespace. Common labels (home, close, etc.) from `common.json`.

## 13. Checklist for New Detail Pages

- [ ] Two-column grid with correct minmax breakpoints
- [ ] `PageHeader` + `RegionBadgeSwitch` + breadcrumbs
- [ ] Loading skeleton matches final two-column structure
- [ ] Left column: AssetCard (tabs + zoom) → InfoCard (icon+label, title+badges, metadata rows) → optional secondary cards
- [ ] Right column: one ContentCard per major section, each with icon+label header
- [ ] All metadata rows use `content-card-inset rounded-xl p-3 sm:px-4` with `dt`/`dd` typography tokens
- [ ] Section headers use `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60` + `size-4` mdi icon
- [ ] Icons registered in `mdi.ts`
- [ ] Date formatting via `formatDisplayDateTime(toTimestampMs(...), displayLocale)`
- [ ] Responsive: no horizontal overflow on mobile, cards stack naturally
- [ ] Mobile stack order: asset → info → secondary → content sections (natural DOM order, no `order-*`)
- [ ] `swipeRegion` on section root
- [ ] Updates existing Changeset covering `@apps/content-site`

## 14. Anti-Patterns to Avoid

| ❌ Don't                                             | ✅ Do                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| Inline `<h2 class="text-lg font-bold">` without icon | Use icon+label header pattern                                 |
| Skip `content-card-inset` for metadata rows          | Wrap every row in inset                                       |
| Put all content in one giant card                    | Split into focused cards per section                          |
| Hardcode Tailwind values that differ from tokens     | Use the exact tokens in §5/§7                                 |
| Register mdi icons in page component                 | Register once in `mdi.ts`                                     |
| Custom CSS for card hover/lift                       | Use shared `hover-3d` / utility classes from `src/lib/styles` |

## 15. Related Items Display Conventions

When a detail page shows related entities (cards, characters, music, events, virtual lives), use these standardized components and layouts.

### 15.1 Cards — `CardThumbnail.svelte`

- **Component**: `apps/content-site/src/lib/components/card/CardThumbnail.svelte`
- **Visual**: square `aspect-square` thumbnail with **rarity-colored border** (`ring-2` + `ring-{rarityColor}`)
- **Rarity colors** (from master data `cardRarityType`):
  - `rarity_1` (N) → `ring-gray-400`
  - `rarity_2` (R) → `ring-blue-400`
  - `rarity_3` (SR) → `ring-purple-400`
  - `rarity_4` (SSR) → `ring-yellow-400`
  - `rarity_5` (Birthday/Anniversary) → `ring-pink-400`
- **Content**: card artwork (normal or after-training via toggle), no title overlay
- **Interaction**: click → `/card/:region/:id`; long-press / right-click → context menu (copy link, open in new tab)
- **Loading**: `loadMode="visible"` (only fetch `src` when entering viewport)
- **Usage**: Event detail featured cards, Card detail related gacha cards, Gacha detail pickup cards, Homepage card previews
- **Fallback**: if `assetBundleName` missing, show `mdi:file-remove-outline` placeholder in `bg-base-200`

### 15.2 Characters — `CharacterAvatar.svelte`

- **Component**: `apps/content-site/src/lib/components/shared/CharacterAvatar.svelte`
- **Border color**: derived from `gameCharacterUnits.colorCode` (static JP mapping for IDs 1–26 in `unit-colors.ts`). Pass `characterId` to enable.
- **Variants**:
  - `xs` (24px) — filter chips, compact badges
  - `sm` (32px) — event bonus rows, list metadata
  - `default` (40px) — standard placements
  - `lg` (48px) — detail card rows (e.g., Event bonus character, Virtual Live character)
- **Props**:
  - `characterId` — enables static color border
  - `accentColor` — overrides static color when enriched data available
  - `decorative` — when inside labeled control/row, removes duplicate accessible name
  - `src` — optional explicit thumbnail URL (falls back to `getLocalCharacterThumbnailAssetURL`)
- **Usage**: Event detail bonus characters, Virtual Live characters, Card detail character, Music vocal character, filter chips
- **Do not**: hand-roll `<img class="rounded-full">` wrappers

### 15.3 Music — Event Detail Style (Jacket Left, Meta Right)

Reference: `EventDetailDataCard.svelte` → event musics section.

```svelte
<div class="flex items-center gap-3 p-3 content-card-inset rounded-xl">
  <EventAssetImage
    src={getMusicJacketAssetURL(music.assetBundleName, region)}
    alt={music.title}
    class="size-16 shrink-0 rounded-lg object-cover"
    loadMode="visible"
  />
  <div class="min-w-0 flex-1">
    <p class="font-semibold truncate">{music.title}</p>
    <p class="text-xs opacity-60">#{music.id} · {music.jacketAttr}</p>
    <a
      class="mt-1 text-xs text-primary hover:underline"
      href={resolve("/music/[region]/[id]", { region, id: music.id })}
    >
      {t("viewDetail")}
    </a>
  </div>
</div>
```

- **Left**: jacket image, `size-16` (64px), `rounded-lg`, `object-cover`, `loadMode="visible"`
- **Right**: title (semibold, truncate), subtitle (id + attribute, `text-xs opacity-60`), view-detail link
- **Container**: `content-card-inset rounded-xl p-3` for consistent card density
- **Grid**: `space-y-2` vertical stack (not grid) — each music gets full width on mobile, natural wrap
- **Usage**: Event detail musics, Virtual Live setlists (compact), Card detail theme songs, Music detail related events

### 15.4 Events — Compact Card with Banner + Meta

Reference: `CurrentEventCard.svelte` (homepage) + `EventListCard.svelte` (list).

```svelte
<EventCardFrame
  href={resolve("/event/[region]/[id]", { region, id: event.id })}
  frameClass="hover-3d"
  overlay={isSpoiler ? mosaicOverlay : undefined}
>
  {#if event.assetBundleName}
    <EventAssetImage
      src={getEventBannerAssetURL(event.assetBundleName, region)}
      alt={event.title}
      imageClass="aspect-[33/10] w-full object-cover"
    />
  {/if}
  <div class="absolute top-2 left-2 right-2 flex justify-between">
    <span class="badge badge-primary">{statusLabel}</span>
    <span class="badge badge-outline">{typeLabel}</span>
  </div>
  <div class="absolute bottom-2 left-2 right-2 flex items-end justify-between">
    <span class="text-sm font-semibold bg-base-100/90 px-2 py-1 rounded">{event.title}</span>
    <UnitIconBadge unit={event.unit} variant="sm" />
  </div>
</EventCardFrame>
```

- **Frame**: `EventCardFrame.svelte` (handles link, spoiler overlay, hover lift)
- **Banner**: `EventAssetImage.svelte`, `aspect-[33/10]` (792×240 native), `object-cover`
- **Badges**: status (top-left), type (top-right); unit icon (bottom-right, `variant="sm"`)
- **Title**: bottom-left, semi-transparent background for readability
- **Spoiler**: if `startAt > now` and global `mosaickedSpoilerContent` enabled, show mosaic overlay
- **Usage**: Event detail related events, Virtual Live detail related events, Homepage current event, Event list cards

### 15.5 Virtual Lives — Compact Card with Banner + Meta

Same frame as Events (`EventCardFrame` + `EventAssetImage`), but:

- **Banner**: `getVirtualLiveBannerAssetURL(assetBundleName, region)`, `aspect-[33/10]`, `object-contain` (banner is wider, keep full visible)
- **Badges**: status (top-left), virtual live type (top-right)
- **Title**: bottom-left
- **No unit badge** (virtual lives don't have unit)
- **Usage**: Event detail virtual live metadata, Virtual Live list cards, Homepage virtual live preview (when implemented)

## 16. Virtual Live Detail Page Compliance

As of the latest alignment, Virtual Live detail page follows this pattern exactly:

- Asset card: banner tab with zoom preview
- Info card: `#id` badge and useful core metadata. Do not render `rankingAnnounceAt`; it has no meaningful user-facing value.
- Waiting room card (icon: `door-open`)
- Additional data card (icon: `puzzle`)
- Right column: information (`text-box-outline`), schedules (`calendar-clock`), characters (`account-group`), setlists (`playlist-check`), rewards (`gift-outline`)

No standalone hero card with giant H1; title lives inside info card as per pattern.
