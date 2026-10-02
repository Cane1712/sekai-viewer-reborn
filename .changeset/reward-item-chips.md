---
"@apps/content-site": patch
---

Frame every reward item as the same raised, outlined chip, with a 40px icon and the quantity in the accent colour: event ranking rewards, virtual live rewards, character ranks, story missions, the mission list, and title rewards (a chip button that opens the title preview, lifting with the accent tint on hover). Title reward buttons drop `touch-target`, whose hit-area `::after` had taken over the tooltip arrow and drawn it at the button's top-left corner. The event and virtual live chips grow from 24px icons to match. Reward totals keep their larger unframed layout inside their own tiles.
