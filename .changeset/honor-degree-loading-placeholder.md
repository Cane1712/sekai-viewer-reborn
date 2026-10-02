---
"@platform/ui-shell": patch
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

`HonorDegree` shows a pill-shaped, pulsing placeholder on the sunken surface while a title's images load, and then shows all its layers together with a short fade, instead of an empty box whose layers appear one by one. It waits for every layer image (including Bonds masks, pattern, and characters) to load or fail; titles whose images already loaded in the page draw at once. The pulse and fade stop under reduced motion and the site low-motion setting. This covers the title preview dialog, the Titles catalogue, and the tools-site tracker's ranking reward titles.
