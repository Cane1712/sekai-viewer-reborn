---
"@platform/ui-shell": minor
"@platform/sekai-master-api-sdk": patch
"@platform/i18n-source": patch
"@apps/content-site": minor
---

Add Bonds honors to the Honors catalogue as a category of character pairs, searchable by honor or word name. `HonorDegree` now lays out `kind: "bonds"` as the game does: tinted 9-slice halves, the pattern, both 160×136 character canvases under the degree mask (per-side windows in sub slots), the frame, the word, and level icons. Callers pass only the unit colours, character and word assets, rarity, and level; the reverse view swaps the units instead of mirroring. The caller-supplied Bonds geometry and the per-layer `mask` it needed are removed.

Call honors "titles" and Bonds honors "Kizuna titles" in user-facing English copy, as the game does outside its internal names.
