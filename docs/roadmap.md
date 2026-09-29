# Roadmap

This document tracks the high-level direction of the multi-site viewer platform.
Statuses are intentionally explicit and **no dates or delivery promises are implied**.

Status legend:

- **Available** — shipped and usable in the current codebase.
- **In progress** — actively being built in the current development branch.
- **Planned** — scoped next priorities, not yet started on the frontend.
- **Exploratory** — later candidate ideas, not committed scope.

## Platform / Four-Site Architecture

The workspace is a monorepo of four deployable SvelteKit apps. Only
`content-site` carries broad feature coverage today; the other three remain
limited in scope and are **not** feature-complete.

| App              | Status      | Notes                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-site`   | Available   | Primary game-data browser (see below).                                                                                                                                                                                                                                                                                                |
| `tools-site`     | In progress | Regional current-event cards for JP/TW/EN/KR and per-region tracking with searchable current or historical event selection, ranking history and snapshots, World Bloom chapter rankings, shareable links, and a constant-pace goal calculator. CSV/XLSX export controls are currently hidden while the export format is reconsidered. |
| `media-lab-site` | In progress | Media-lab shell and the first Live2D/StoryReader route slices are being built; real asset adapters remain contract-gated.                                                                                                                                                                                                             |
| `account-site`   | Exploratory | Scaffold only; no feature work started.                                                                                                                                                                                                                                                                                               |

## media-lab-site — Media Lab

`media-lab-site` is the workspace's general-purpose interactive media
laboratory, not only a 3D asset viewer. Its planned feature areas are:

- **3D Asset and Animation Lab** — inspect exported Unity models and compatible
  motion data.
- **Live2D Model Viewer** — preview Cubism models, motions, expressions, and
  related assets.
- **StoryReader** — play story scenarios with Live2D characters, backgrounds,
  voice, music, video, and translated text.

The Live2D and StoryReader extraction and migration analysis is tracked in
[`docs/viewer-implementation/live2d-story-reader-extraction-roadmap.md`](viewer-implementation/live2d-story-reader-extraction-roadmap.md).

These areas may share asset loading, media URL resolution, caching, playback
controls, localization, and diagnostics, but their runtimes should remain
separate where their asset formats and lifecycle requirements differ.

### Planned — Unity Asset Viewer

The future media lab should provide a browser-based viewer for the Unity assets
exported by `sekai-assets-updater`. This is a separate consumer workflow: the
updater remains responsible for downloading bundles and exporting individual
model files, while the media lab is responsible for presenting compatible
assets together.

The first supported inputs should remain separate files and preserve their
source bundle identity:

- FBX model exports with their sibling texture files.
- Unity animation assets extracted from `model3d/motion/*` bundles.
- Model, animation, and bundle metadata needed to discover and validate
  compatibility.

This feature must not assume that every `model3d` or `virtual_live` bundle is a
mesh. Model discovery should use explicit metadata and/or inspected asset
capabilities rather than namespace names alone. `live2d/*` remains a separate
Live2D asset/post-processing concern and is not part of this 3D viewer's model
pipeline.

### Planned — Implementation Route

1. **Asset contract** — document a stable manifest for model bundles, texture
   files, animation bundles, Unity versions, source bundle names, and any
   compatibility identifiers. Preserve the updater's per-bundle directory
   structure instead of relying on a flat `model.fbx` filename.
2. **Browser model loading** — add a client-side 3D runtime to
   `apps/media-lab-site` and establish a supported browser format. Prefer
   glTF/GLB as a derived viewing format, while treating FBX as an ingestion
   format; do not require the updater repository to perform model/animation
   assembly.
3. **Animation ingestion** — parse or pre-convert Unity `.anim` clips in a
   dedicated viewer-side or offline toolchain. Keep clips separate from model
   exports and expose their names, source bundles, and required rig/Avatar
   information.
4. **Compatibility and binding** — match clips to models by verified skeleton
   paths, bone names, Avatar/Animator metadata, BlendShape names, Unity version,
   and source dependencies. Do not bind animations solely by character or file
   name.
5. **Media lab UX** — provide model and animation selectors, a compatibility
   state, texture/material diagnostics, playback controls, camera controls, and
   clear error states for missing dependencies or unsupported clips.
6. **Validation** — test representative character models, stage/lobby models,
   Virtual Live assets, facial clips, and motion clips in the browser. Confirm
   that models without compatible animations still render correctly and that
   animation failures do not hide the underlying model.

### Planned — Live2D Model Viewer

Build a standalone Live2D model showcase in `media-lab-site`, sharing only
framework-neutral asset loading and media utilities with StoryReader. The
initial slice should cover model metadata, Cubism model/motion loading,
expressions, bounded preloading, playback controls, and localized loading or
unsupported-asset states. The player should not depend on the StoryReader
scenario interpreter. It previews exactly one Cubism model at a time and is
independent from both the StoryReader scenario interpreter and the 3D viewer.

Product information architecture:

- `/live2d` is the Model Viewer catalogue and model-selection destination. It
  does not also act as the StoryReader entry point; model cards and model
  search belong here because the user has already chosen the model-inspection
  workflow.
- `/live2d/[modelId]` is the single-model viewer destination. A confirmed
  catalogue or a deliberate deep link supplies the model identity; the route
  must not infer assets from arbitrary filenames or region fallbacks.
- StoryReader is a separate product track at `/story-reader`. Its landing page
  offers exactly two presentation modes for the same story address: **Text-Only**
  (`/story-reader/[region]/[storyType]/[storyId]`) and **Live2D Player**
  (`/live2d/story-reader/[region]/[storyType]/[storyId]`). The two modes share
  route identity but keep their rendering/runtime responsibilities distinct.
- The sidebar exposes Model Viewer and StoryReader as separate destinations.
  The Live2D Player route is treated as a StoryReader mode for active navigation,
  while ordinary `/live2d` paths remain under Model Viewer.

Concrete implementation route:

1. Add a path-param route such as `/live2d/[modelId]` in
   `apps/media-lab-site` rather than encoding model identity in query state.
2. Resolve model metadata, the Cubism model, motions, and expressions through
   framework-neutral asset/loading utilities. Do not couple those utilities to
   `StoryDocument` or require StoryReader to be implemented first.
3. Instantiate Pixi and Cubism only from the client-side mount lifecycle. Keep
   the active model and a bounded set of explicitly selected/preloaded motions
   in memory; expose playback, motion, expression, and basic playback-state
   controls without introducing scenario playback.
4. Make teardown deterministic and idempotent: cancel pending loads, remove
   listeners, stop playback, and destroy the Cubism model and Pixi resources
   when the route is left or the model changes. Localize loading, unsupported,
   missing-asset, and runtime-error states through the existing i18n path.

The safe first slice can ship the strict descriptor/controller boundary and the
localized unavailable state without a real asset adapter. The Pixi/Cubism
adapter remains gated on [#268](https://github.com/Sekai-World/sekai-viewer-reborn/issues/268),
which must verify one model descriptor, required resources, and browser CORS
before any production URL or model mapping is introduced.

Issue-sized acceptance guidance:

- `/live2d/:modelId` renders metadata and one model, supports Cubism model and
  motion loading, expressions, bounded preloading, and playback controls.
- Server rendering and route loading do not construct Pixi/Cubism or access
  browser-only APIs; client teardown leaves no active listeners, animation
  loops, or unresolved model-load work.
- Missing, unsupported, and failed assets produce localized, actionable states
  without breaking the surrounding media-lab route.
- The implementation has no dependency on `StoryDocument`, the StoryReader
  scenario interpreter, or 3D viewer code, and the standalone viewer remains
  usable without StoryReader completion. Reuse is limited to
  framework-neutral asset/loading utilities.

### Planned — StoryReader

Migrate the existing Live2D StoryReader as a vertical slice: one route, one
supported story type, one data adapter, and one player flow before expanding
story coverage. Keep the imperative PixiJS/Cubism playback runtime behind a
framework-neutral API, with SvelteKit responsible for route, data, settings,
and lifecycle integration. The detailed extraction plan covers scenario
normalization, media URL resolution, model and motion preloading, checkpoint
playback, voice/audio synchronization, translation lookup, and legacy parity
validation.

The reader's product entry is independent from the Model Viewer catalogue. The
`/story-reader` landing page chooses between the Text-Only and Live2D Player
presentations, and each presentation can switch to the other mode for the same
validated story address. Until their data/player adapters are available, both
routes should preserve their mode-specific empty/status states rather than
presenting placeholder content as a usable story.

Live2D StoryReader assets are not part of the 3D FBX export pipeline. They
should remain discoverable through their own asset contracts and post-processing
outputs.

### Exploratory — Runtime Packaging

Possible later packaging strategies include a model plus multiple animation
clips in one derived GLB, or separate model and animation artifacts loaded by a
runtime binding layer. Choose between them after the asset contract and
compatibility metadata are available. Full character assembly, automatic rig
retargeting, and universal FBX animation export are explicitly outside the
current updater scope and should be implemented as viewer-side or standalone
tooling if needed.

## content-site — Content Catalogue

### Available

Catalogue (list + detail) coverage already shipped for:

- **Cards** — list (`/cards/[region]`), detail (`/card/[region]/[id]`).
- **Characters** — catalogue (`/characters/[region]`), detail
  (`/character/[region]/[id]`), and unit/member views
  (`/unit/[region]/[unit]`).
- **Musics** — list (`/musics/[region]`), detail (`/music/[region]/[id]`).
- **Events** — list (`/events/[region]`), detail (`/event/[region]/[id]`).
- **Gachas** — list (`/gachas/[region]`), detail (`/gacha/[region]/[id]`).
- **Virtual Lives** — list (`/virtual-lives/[region]`), detail (`/virtual-live/[region]/[id]`).
- **Game News** — regional news catalogue (`/news/[region]`) with tag, spoiler,
  and pagination controls.
- **MySekai** — furniture list (`/mysekai/fixtures/[region]`) and detail
  (`/mysekai/fixture/[region]/[id]`), materials list and detail
  (`/mysekai/materials/[region]`, `/mysekai/material/[region]/[id]`), and
  soundtracks (`/mysekai/soundtracks/[region]`), on the `mysekaiFixtures`,
  `mysekaiMaterials`, and `mysekaiMusicRecords` master API contracts.

These use generated public `sekai-master-api` contracts, region-aware
availability switching, and scoped localized UI bundles with remote dictionaries
and local fallbacks. Content routes support JP, EN, TW, KR, and CN where regional
data is available.

### Available — Content Center Phase One

Content Center Phase One merged to `main` in PR #81. The catalogue and detail
routes use the public `sekai-master-api` contracts and generated SDK:

- **Character catalogue** — region-aware character list (`/characters/[region]`)
  with unit filtering, search, and a result count, plus a character detail page
  (`/character/[region]/[id]`) showing profile, unit, height, and sequence
  metadata. Both list/unit list requests use paginated aggregation
  (`aggregateGameCharactersByRegion` / `aggregateGameCharacterUnitsByRegion` in
  `apps/content-site/src/lib/server/character-pages.ts`) requesting `page_size:
100`, following `pagination.has_next` / `total_pages`, capped at 20 pages, and
  deduplicating overlapping results — so the full current catalogue loads without
  the earlier truncation.
- **Character-to-card discovery** — the character detail page links to a cards
  list filtered by the character ID, so related cards are one navigation away.
- **Cross-links into character profiles** — three reliable entry points now link
  to `/character/[region]/[id]` when a positive `gameCharacterId` is present:
  card detail character identity, event detail banner character, and music detail
  vocal characters. These are linked only when the source payload carries a
  confirmed positive `gameCharacterId`.
- **Virtual Live detail expansion** — detail pages now provide date-grouped,
  keyboard-accessible schedules; enriched character profile links; typed
  additional data; setlist music previews; and on-demand MC Timeline details.
  Modern `mc_timeline` playable assets and legacy `mc` scenario assets are both
  parsed server-side. Timeline 3D IDs are resolved through the public
  Character3D batch contract before avatars/profile links are shown.
- **Virtual Live rewards** — expanded `virtual_live_reward` boxes render their
  concrete item quantities. Resource boxes are resolved in the current content
  region only; unavailable boxes remain absent rather than falling back across
  regions.
- **Homepage content hub** — region switching, current-event presentation,
  latest cards, music, and gacha data, regional Game News, version information,
  and directory links into the supported content areas.
- **Detail experience extensions** — card galleries and related-content links;
  event assets, rewards, bonus data, BGM, and optional tools-site tracker links;
  music previews, downloads, difficulties, and vocals; and gacha probability,
  behavior, and simulator views.

### Planned — Next Content Priorities

Requested by the user and **not yet viewer-ready**: the corresponding
content-site routes and pages have not been built. Their master API contracts
are merged and the viewer SDK has been regenerated. For any new or extended API
contract, follow this cross-repo pipeline:

1. `sekai-master-api` must expose the relevant public contracts (or extend
   existing ones).
2. Regenerate the Swagger/OpenAPI spec (`mise run swagger`).
3. Deploy `sekai-master-api` to the remote dev cluster and forward it
   (`mise run dev-cluster-rebuild`, then `mise run dev-cluster-forward`; OpenAPI
   is available at `http://localhost:18080`).
4. Regenerate the viewer SDK
   (`mise run update-sekai-master-api-sdk-local`) and validate
   (`pnpm --filter @platform/sekai-master-api-sdk check`).

Specific next priorities:

- **Costumes / Decorations**
- **Degrees / Titles**
- **Missions / Rewards**

The master API contracts for these domains are merged and the viewer SDK has
been regenerated (`sekai-master-api` #118 added `honors`, `bondsHonors`,
`missions`, `costume3ds`, and `mysekaiPhotoDecorations`; viewer SDK regen in
#347), but no corresponding content-site routes or pages exist yet, so they
remain **Planned** pending frontend work.

### Exploratory — Later Candidates

Broader game content such as **Stories** and further MySekai areas (gates,
character talks, blueprints for tools and canvases) are considered later
candidates only. They are not part of the committed current scope and have no
timeline.

## Cross-Repo Dependency Note

Frontend content work depends on `sekai-master-api` (separate repository). Any
content item that lacks a public, SDK-generated contract cannot be built on the
viewer side. See `AGENTS.md` (Cross-Repository Integration) for the full
contract → SDK regeneration workflow.
