# `content-site` UI Conventions

This document records the current UI architecture and styling rules for `apps/content-site`.
Follow these rules before introducing new page-level patterns, daisyUI overrides, or shared Svelte UI.

## Styling Stack

- `content-site` uses Tailwind CSS 4 with `daisyui`.
- Shared app-level CSS lives in `apps/content-site/src/app.css`.
- Shared Svelte UI is consumed from `packages/ui-shell/src`.
- Image preview components use the public `@platform/ui-shell/image-retry` subpath for their shared retry controller. `AssetImage` defaults to `STATIC_ASSET_RETRY_POLICY`, which appends one `__image_retry` query parameter before any fragment and uses cancellable same-origin `HEAD` classification with `cache: "no-store"`. Callers handling signed GET URLs may pass `SIGNED_GET_RETRY_POLICY`; it preserves the canonical URL byte-for-byte, skips `HEAD` probes, and is forwarded to interactive preview loading. Both policies use base retry delays of 300ms and 900ms with positive-only bounded jitter up to 20% (300–360ms and 900–1080ms); deterministic controller tests may inject the random source through constructor options, while normal callers use `Math.random`. Stale request snapshots and disposal prevent old callbacks from changing current image state. There is no global concurrency limiter; each controller owns its own retry timers and probes.

### Theme initialization

`apps/content-site/src/app.html` synchronously reads and validates the saved theme name/mode and, for `auto`, the system dark preference before SvelteKit head/styles/hydration run. It sets `data-theme` and the `dark` class early to prevent a light-to-dark first-paint flash. `+layout.svelte` must use the same storage keys and validated values (`default`/`sakura`/`mint`; `light`/`dark`/`auto`), and theme storage reads/writes must tolerate unavailable `localStorage`.

## Confirmed Prismatic Archive design language

Prismatic Archive treats `content-site` as a calm, readable archive/catalogue rather than a generic dashboard or decorative landing page. The following rules are confirmed by the Phase 3 cards catalogue and event detail work:

- Use a semantic surface hierarchy: canvas/background, panel, inset/sunken, and elevated/overlay. Prefer the archive text, border, accent, and focus roles plus the `content-card-*` primitives defined in `apps/content-site/src/app.css`.
- In dark palettes, keep the page canvas visibly darker than the standard panel, with inset below the panel and raised/overlay surfaces above it. `content-card-shell` relies on this separation plus `--archive-border-subtle`; tune those semantic tokens together across default, sakura, and mint rather than adding card-specific shadows or colors.
- Keep the visual system restrained: thin borders, modest and interaction-limited shadows, no heavy blur or filters, compact but touch-safe controls, visible focus, and low-motion-safe transitions.
- Make information architecture explicit: clear page identity, composed control decks, grouped result fields, and scannable evidence/data sections. Build mobile-first and let detail rails flow naturally on narrow screens.
- Detail-page layout uses `gap-4` as the single shared spacing unit: the main left/right rails, cards stacked within each rail, and any 2XL-only nested detail columns must use the same gap. Do not add breakpoint-specific gap overrides that make an inner column feel looser or tighter than its parent rails.
- `ViewerShell` keeps `desktopRailOpen` as an overlay drawer below `xl` and changes to its fixed left navigation rail only at `xl` (1280px) and above. Keep ordinary navigation typography and spacing breakpoints independent of that rail threshold.
- Preserve image and data behavior. Artwork remains visibility-gated/lazy where established; spoiler/reveal semantics stay intact; route, query, and server state remain authoritative.
- Phase 3 applies these rules to `apps/content-site/src/routes/cards/[region]/+page.svelte` and `apps/content-site/src/routes/event/[region]/[id]/+page.svelte`, composing the existing card and event components (including `CardListCard.svelte`, `EventDetailDataCard.svelte`, `EventDetailInfoCard.svelte`, and `EventDetailAssetCard.svelte`). A multi-card event identity rail must flow naturally with the page rather than becoming a full-column sticky rail.
- This is a design evolution from older generic daisyUI card/base surfaces and ad-hoc spacing or shadows toward semantic, calmer archive surfaces and explicit hierarchy; it does not claim that all older UI has been removed.
- The homepage current event is a data-driven Archive Banner: it uses the selected region's existing streamed current-event payload, preserves its event-detail link, unit metadata, countdown, and asset retry/fallback behavior. When the supplied event artwork is intrinsically small, render it as a compact, contained preview rather than enlarging it into a hero: at `lg` widths use a fixed, modest media column beside content-led details inside the shell's shared `max-w-384` track; on mobile keep the natural stacked order. Loading, empty, and error states use the same media/details geometry to limit shift.
- Dark theme palettes use a hue-aware archive surface ladder: a gently tinted canvas, then progressively lighter default, raised, and overlay surfaces. Keep the primary ambient glow quieter than light mode and use restrained token-based borders for separation rather than heavier shadows.

### Catalogue list surfaces

- Cards, Music, Events, Gachas, and Virtual Lives catalogue pages use a raised control deck followed by a sunken, bordered results field. Their loading, error, empty, and dialog surfaces should use the same matching surface treatment so the catalogue experience remains coherent across routes.
- Keep the PageHeader/navigation, control deck, and results-field border on the same page content track. The results field retains a responsive internal gutter around its grid, but its border must not extend beyond the header or toolbar edges at any breakpoint.
- Catalogue grids use stretch-aligned rows; each list card's clickable frame must fill its grid cell so cards share a row height without changing their media aspect ratios.
- Keep catalogue surface structure shared, but keep each domain's card internals specific: cards, music, events, gachas, and virtual lives may expose different metadata, artwork, and interactions within the common page-level surfaces.

## daisyUI Override Rules

### 1. Override daisyUI component defaults with `@utility`

If you need to change a daisyUI component default globally, prefer `@utility` in `app.css`.

Current example:

```css
@utility card {
  @apply rounded-2xl;
}
```

Use this for defaults owned by daisyUI, such as:

- `card` border radius
- `btn` shape
- `badge` radius
- `tab` radius

Do not rely on business classes such as `.content-card-shell` to fight daisyUI defaults for these properties.

### 2. Use utility classes in markup for per-instance differences

If only one component or one page needs a different look, prefer utility classes in the Svelte template instead of more global CSS.

Examples:

- `rounded-[1.75rem]`
- `p-5`
- `gap-4`
- `transition-[transform,box-shadow]`

### 3. Keep custom app classes narrow

Custom classes such as `.content-card-shell`, `.content-card-inset`, and `.content-card-elevated` should only describe app-specific visual language that is not a daisyUI default:

- surface background mixing
- border color tuning
- dark theme adjustments

Avoid putting daisyUI-owned defaults in them when a utility or `@utility` is the better layer.

## Motion Rules

### 1. Avoid page-wide transition fallbacks

Do not apply broad transition defaults to all descendants such as `:root *`.
They can override or dilute local motion and make hover states feel delayed or muddy.

If theme transitions are needed, keep them narrow and page-level only.

### 2. Keep hover motion close to the component

Card hover motion should be expressed in:

- component-local utility classes, or
- small shared style constants under `apps/content-site/src/lib/styles`

Do not scatter hover timing between unrelated global selectors and page templates.

### 3. Avoid scaling raster images when sharpness matters

For event list cards, prefer slight translation and brightness changes over scaling the banner bitmap itself.
Direct image scaling can make banners feel soft or blurry due to browser resampling.

### Prismatic Archive feedback refinement

Prismatic Archive does not remove feedback; it uses restrained, semantic motion. Keep interactions in the 150–300ms range, respect both `data-low-motion` and `prefers-reduced-motion`, avoid broad/global animations, and avoid heavy filters. At independently streamed boundaries, skeletons should preserve the layout rather than leave blanks. On event detail, this applies separately to the event payload, unit profiles/info, current-event countdown, and unit-profile BGM boundaries; their skeletons are visual-only placeholders with `aria-hidden="true"`, as implemented in `apps/content-site/src/routes/event/[region]/[id]/+page.svelte`.

Skeleton groups should avoid costly per-item shimmer loops. Prefer a simple pulse or a static reduced-motion state, and reserve the loaded content's dimensions to prevent jank and cumulative layout shift (CLS). The shared motion and surface constraints remain grounded in `apps/content-site/src/app.css`.

## Shared Card Architecture

Current shared card system:

- `apps/content-site/src/lib/components/shared/EventCardFrame.svelte`
- `apps/content-site/src/lib/components/shared/AssetImage.svelte`
- `apps/content-site/src/lib/components/card/CardListCard.svelte`
- `apps/content-site/src/lib/components/event/CurrentEventCard.svelte`
- `apps/content-site/src/lib/components/event/EventListCard.svelte`
- `apps/content-site/src/lib/components/music/MusicListCard.svelte`
- `apps/content-site/src/lib/styles/event-card.ts`

Rules:

- Shared card frame logic belongs in `EventCardFrame.svelte`.
- Shared non-interactive event/music media should use `AssetImage.svelte`.
- `CardGridImage.svelte` remains the wrapper-free grid-only image primitive: it renders a raw root `<img>`, keeps visibility ownership in `CardListCard.svelte`, and uses the shared `ImageRetryController` with `STATIC_ASSET_RETRY_POLICY` for source-safe retries and fallback transitions. Callers can provide an explicit `ImageRetryPolicy` when their request contract requires it.
- `CardThumbnail.svelte` keeps its nullable-source fallback UI, `IntersectionObserver` visibility gate, and frame/attribute/rarity overlays while using the shared `ImageRetryController`; callers may pass an explicit `ImageRetryPolicy`, but static assets use `STATIC_ASSET_RETRY_POLICY` by default.
- For long lists, card artwork should not attach image `src` before the card is visible. Use `AssetImage` with `loadMode="visible"` for event/music list artwork, or the existing visibility-gated pattern in `CardListCard.svelte`.
- Shared animation class constants belong under `src/lib/styles`, not next to `.svelte` component files.
- Current-event media uses `EVENT_CARD_MEDIA_CLASS` with an `aspect-5/2` frame so its banner space is stable before the image loads. Its localized ID and event-type metadata sits above the title and reuses the transparent, bordered `EVENT_CARD_META_BADGE_CLASS`.
- Page files should pass data into shared card components instead of inlining card structure repeatedly.
- A list card that gates mosaicked spoiler content must own its only detail link. Its unmodified primary pointer click, Enter, and Space activation reveal first; after reveal, native link activation continues normally and bare Space navigates without scrolling. Do not wrap it in another link or add a separate spoiler control.
- Detail info cards for cards, events, music, and gachas should expose `assetBundleName` as a final "internal resource code" row when that field is available.

## Component Test Conventions

- Component characterization tests live beside the implementation as `*.test.ts` files and run in Vitest's `jsdom` environment through the workspace-local `vitest.config.ts`.
- Use Svelte Testing Library queries and DOM events for Svelte 5 components. Use fake timers for retry delays and mock `fetch` for same-origin probes; do not wait on wall-clock time or reach a remote asset host.
- Keep the test include globs under `src/**/*.test.ts` so generated output and `node_modules` are never collected by workspace test commands.

## Layout / Navigation Component Architecture

Current shared navigation/header system:

- `apps/content-site/src/lib/components/shared/Breadcrumbs.svelte`
- `apps/content-site/src/lib/components/shared/PageHeader.svelte`
- `apps/content-site/src/lib/components/shared/RegionBadgeSwitch.svelte`
- `apps/content-site/src/lib/components/shared/ListToolbarButton.svelte`

Rules:

- Breadcrumb + top-right action layouts should reuse `PageHeader`.
- Breadcrumb labels for first-class sidebar destinations must reuse the matching
  `common.navigation.*` key (for example `navigation.cards`), rather than a
  page-specific `*ListTitle` key. This keeps breadcrumbs, page titles, and the
  sidebar on the same localized dictionary entry. Apply this to Cards,
  Characters, Songs, Events, Gachas, and Virtual Lives on both list and detail
  routes.
- Region badge groups should reuse `RegionBadgeSwitch`.
- If a route needs only a single active region badge, still use the shared switch component with one active option.
- Region-based list and detail routes use `apps/content-site/src/lib/actions/swipe-region.ts` on the page root. The action delegates navigation to the currently visible `RegionBadgeSwitch`, does not wrap at the first or last rendered region, and must stay touch-only. Keep its edge-start guard, `touchmove` vertical-intent and multitouch cancellation, horizontal-dominance threshold, and horizontal-scroll/dialog/form exclusions when extending it to another route. Mark known horizontal scrollers with `data-swipe-region-skip`.
- Page-root containers use the `content-page-shell` utility from `apps/content-site/src/app.css` (owns `mx-auto flex w-full flex-col px-2`; the shell supplies the width track). Pages add only their own vertical rhythm on top, e.g. `content-page-shell gap-4` or `content-page-shell gap-5 pb-6 sm:px-4`. Do not hand-roll `mx-auto flex w-full flex-col px-2` per page or add page-local `max-w-*` constraints — that is how the unit detail page drifted from the shared track.
- List page icon-only sort, view, and filter controls should reuse `ListToolbarButton` so touch target sizing and sort indicators stay aligned across routes.

## Character Avatar Component

Current shared character avatar component:

- `apps/content-site/src/lib/components/shared/CharacterAvatar.svelte`

Rules:

- Character thumbnails, avatars, and compact character chips in cards, music UI, event UI, and list filter controls should reuse `CharacterAvatar` instead of hand-rolled rounded `<img>` wrappers.
- Use `variant="xs"` for compact badges and filter controls, `variant="sm"` for event bonus rows, `variant="default"` for large/default avatar placements, and `variant="lg"` for detail-card rows.
- Pass `characterId` when a caller knows the game character ID so `CharacterAvatar` can derive the static `gameCharacterUnits.colorCode` border color for IDs 1-26. Pass `accentColor` when enriched character color data is available; that explicit color overrides the static character color, and the app primary accent token remains the final fallback.
- Use `decorative` when the avatar is inside an already labeled control, row, or metadata badge so the surrounding label remains the accessible name.

## Unit Icon Component

Current shared unit icon component:

- `packages/ui-shell/src/unit-icon-badge.svelte`
- `apps/content-site/src/lib/components/shared/UnitIconBadge.svelte` remains the
  content-site adapter so existing consumers keep a stable local import path.

Rules:

- `@platform/ui-shell` owns the six canonical unit icon PNGs, supported-slug normalization, `none` to `piapro` mapping, and border colors. Apps should use `UnitIconBadge` defaults rather than duplicating icon files, mappings, or resolver props.
- Unit/group icons in cards, event UI, music UI, and list filter controls should reuse `UnitIconBadge` instead of hand-rolled image tags.
- Use `variant="sm"` for compact list/filter controls, `variant="default"` for normal cards, and `variant="lg"` for detail cards.
- When `mapNoneToPiapro` is true, support-unit `none` uses the package-owned piapro color and icon.
- Keep unit display names and other domain data from `/unitProfiles/{region}/list`; the package-owned color resolver is for visual border accents only and must not replace unit profile loading.
- Exception: `routes/characters/[region]/+page.svelte` retains `resolveUnitLogoUrl` for the large unit logo above each roster; it is a page-level visual identifier, not a `UnitIconBadge` placement.

## Page Titles

All four sites share one browser-tab title convention, assembled by
`createPageTitle` from `@platform/ui-shell` (`packages/ui-shell/src/page-title.ts`):

- Home page: `Sekai Viewer`
- List page: `Cards JP | Sekai Viewer` (the region stays glued to the catalog segment)
- Detail page: `<content title> | Cards | Sekai Viewer`; while content is
  loading or missing, degrade to the existing `<prefix> <id>` fallback
  without the catalog segment

Site names: content-site = Sekai Viewer, tools-site = Sekai Tools,
media-lab-site = Sekai Media Lab, account-site = Sekai Account. content-site
binds the site name in `apps/content-site/src/lib/page-title.ts`
(`createPageTitle(pageTitle, ...context)`), media-lab-site in
`apps/media-lab-site/src/lib/page-title.ts` (variadic segments); other pages
should use these wrappers rather than concatenating separators by hand.
List-page catalog segments reuse the same `common.navigation.*` key as the
breadcrumb / sidebar (see Layout / Navigation Component Architecture).

## Sidebar Rules

Sidebar rendering is owned by `packages/ui-shell/src/viewer-shell.svelte`.

Current sidebar item type is:

- section items
- link items
- disabled link-shaped items
- optional icon support

Rules:

- Use a section item for non-clickable group labels.
- Disabled items should still use the same structural layout as enabled items for alignment consistency.
- Sidebar links should close the drawer when clicked.
- `content-site` sidebar labels must come from the CDN dictionaries loaded through `@platform/i18n-runtime`.

Current `content-site` sidebar groups:

- Home
- Game News
- Library (`navigation.library`): permanent reference data
  - Characters & Units
  - Cards
  - Songs
- Activities (`navigation.activities`): scheduled, time-bound content
  - Events
  - Gachas
  - Virtual Lives
- Progression (`navigation.progression`): mission goals and the honors they award
  - Missions
  - Honors
- MySekai (`navigation.mysekai`): MySekai reference data
  - Furniture (`/mysekai/fixtures/:region`, detail `/mysekai/fixture/:region/:id`)
  - Materials (`/mysekai/materials/:region`, detail `/mysekai/material/:region/:id`)
  - Soundtracks (`/mysekai/soundtracks/:region`)
- Project (`navigation.project`)
  - Support

Place a new destination in the group that matches its content rather than adding
a catch-all section.

Every link above has a real destination.
Character list/detail routes use `/characters/:region` and `/character/:region/:id`.
Virtual Live list/detail routes use `/virtual-lives/:region` and
`/virtual-live/:region/:id`.

## I18n Rules

Event-type display text is localized through `svelte-i18n`. Unit display names come from the master API unit profile list.

Current helper:

- `apps/content-site/src/lib/event.ts`
- `apps/content-site/src/lib/unit-profile.ts`
- `apps/content-site/src/lib/server/unit-profiles.ts`

Rules:

- Do not hardcode translated event type strings in page components.
- Do not hardcode unit names in page components or filter metadata. Use `/unitProfiles/{region}/list` through `fetchUnitProfiles`, and fall back with `formatUnitFallbackLabel`.
- Keep server-side unit profile caching in `apps/content-site/src/lib/server/unit-profiles.ts`; cache validation should use the version key from `/versions/{region}`.
- Keep music tag to unit-code mapping in `apps/content-site/src/lib/unit-profile.ts` because some API tag values differ from unit codes.
- Add user-facing navigation labels to the external `sekai-i18n-reborn` dictionaries.
- Add new source keys first to the matching `packages/i18n-source/content-site/*.json` namespace; use `common.json` only for labels shared across multiple scopes and `server.json` for server-only messages.

## Practical Modification Strategy

When changing `content-site` UI, prefer this order:

1. Check whether daisyUI already owns the property.
2. If yes and the change is global, use `@utility`.
3. If the change is local, use markup utility classes.
4. If behavior or structure repeats, extract a shared Svelte component.
5. Put non-component shared constants under `src/lib/styles` or another non-component folder.

## Shared Interactive Audio Controls

- `AudioPlayer` from `@platform/ui-shell` is the full music player component for music previews and event BGM. It is used by `EventDetailBgmCard`, `MusicPreviewCard`, and `VirtualLiveSetlistMusicPlayer`.
- `VoicePlayButton` from `@platform/ui-shell` (`packages/ui-shell/src/voice-play-button.svelte`) is the compact circular voice play button with a playback progress ring for short voice clips such as card gacha phrases. In `content-site` it is used by `CardDetailInfoCard` and `VirtualLiveTimelinePanel`.
- Both controls manage their own `HTMLAudioElement` state and take localized labels. `AudioPlayer` takes a single `src`; `VoicePlayButton` takes an ordered `sources` array and tries each candidate in turn when one fails to load or decode.
- `VoicePlayButton` should surface missing voice assets with a disabled error icon and localized tooltip (`errorLabel`) once every source has failed, instead of silently reverting to the idle play state.

## Virtual Live Timeline Conventions

- Keep Timeline parsing server-side behind
  `/virtual-live/:region/:id/timeline/:setlistId`; clients consume normalized
  JSON rather than raw `.playable` or `.asset` resources.
- Support only the exact MC formats: `mc_timeline` reads
  `virtual_live/mc/timeline/{bundle}/{bundle}.playable`; legacy `mc` reads
  `virtual_live/mc/scenario/{bundle}/{bundle}.asset`. Other setlist types stay
  unsupported until their asset format is confirmed.
- Use the route's content region for assets, character names, and Character3D
  resolution. Do not fall back to another region when an asset is unavailable.
- Timeline loading is on demand from the Setlist dialog. Preserve category
  filters, progressive rendering, and per-row errors so an unavailable timeline
  does not make the full Virtual Live detail page unavailable.
