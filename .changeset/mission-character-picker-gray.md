---
"@apps/content-site": patch
"@platform/i18n-source": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
---

Simplify the missions page. The family tabs read "All / Story / Character / Normal" (the page is already titled Missions; section headings keep the full names) and fit one row on phones, and the character filter moves out of the tab card into its own card, so the two are easy to tell apart. The character filter shows each unit's logo instead of its name (named for assistive technology, with the name as a fallback), and the character missions list drops the card that wrapped its tiles, which now use the white card surface. In the character picker, avatars are grey and take their colour on hover, keyboard focus, or when chosen (the chosen one keeps its ring), fading in 180ms except under reduced motion and the low-motion setting. The "Showing {name}" line and the character profile link are gone. On small screens the collapsed picker keeps the chosen character's unit and avatar, and the avatar reopens the grid. The unused `mission.characterSelected`, `mission.characterProfile`, and `mission.characterCollapse` source strings are removed.
