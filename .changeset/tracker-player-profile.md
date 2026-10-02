---
"@platform/ui-shell": minor
"@platform/i18n-source": patch
"@apps/tools-site": minor
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

The tools-site event tracker shows each ranked player as the game does. Ranking rows and mobile cards show the leader card's thumbnail beside the player name, with the trained art only when the player chose it (`defaultImage` is `special_training`). Player details show the wide profile art (`character/member_small`) dressed like the game's profile card, with the L rarity frame, attribute, rarity stars, and Master Rank diamond (hidden at rank 0) at the game's positions, plus a level bar; the player's name and their titles in the game's main and sub slots sit beside it, stacking under the art on narrow screens. Titles cover Kizuna titles with their chosen word, side swap, and Virtual Singer outfit. Rank reward titles now follow content-site's rules, drawing an event title on the event background under its rank overlay, and replace the placeholder rank-range badge, which remains only when no title art is available.

The title rules that map honor master data onto `HonorDegree` move from content-site into `@platform/ui-shell/honor-degree-adapter` so both sites share them; a player's held level can now select that level's rarity and Live Master art. Content-site behavior is unchanged.

`HonorDegree` now draws an event title's sub-slot rank badge (`rank_sub`, 120×38) at the bottom centre of the 180×80 sub slot, where the game places it, instead of the top right, and a rank match title's sub-slot tier badge (158×40) at the bottom centre instead of the top. This also corrects the sub titles in content-site's Titles catalogue and title previews.

`HonorDegree` now draws Live MASTER titles as the game does: the scroll, ten level stars in the main slot (the lit count is the level's last digit, ten on whole tens), and the clear count on the scroll's ribbon with the game's digit sprites. Content-site's Titles catalogue and previews show the scroll and stars; the tracker also shows each player's clear count from their title missions. Card art loads from the JP bucket first with the page's region as the fallback.
