---
"@apps/content-site": minor
---

Add Discord link previews to card, music, and event detail pages.

Shared links now unfurl as rich Discord component embeds (title, full-width artwork image, key metadata, and an Open button) with standard Open Graph tags as fallback. The embed is server-rendered inline for Discord's crawler only, so browsers keep the fast streaming page path. Card links support `?trained` to preview the trained artwork variant. Slow upstream responses fall back to a plain title instead of timing out Discord's fetch window.
