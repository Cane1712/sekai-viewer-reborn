---
"@platform/ui-tokens": minor
"@platform/ui-shell": patch
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

Keep unit icons on a white backdrop in dark mode again. A new `color.surface.assetBackdrop` token, emitted as `--archive-surface-asset-backdrop` by `@platform/ui-tokens/utilities.css`, gives game artwork drawn for a light ground a fixed white backdrop in every palette and theme, and `UnitIconBadge` uses it instead of the theme's `base-100`.
