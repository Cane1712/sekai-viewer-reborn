---
"@platform/sekai-master-api-sdk": minor
"@platform/ui-shell": minor
"@platform/i18n-source": minor
"@apps/content-site": minor
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

Add a MySekai group to the content-site sidebar with Furniture, Materials, and Soundtracks catalogues. Furniture can be searched and filtered by genre, sub-genre, series, unit, and character, and each piece has a detail page with its size, placement, tags, crafting materials, disassembly returns, and character bonus. Materials list where they are gathered and which furniture they craft. Soundtracks lists the MySekai music record soundtracks by category, and plays them in place. MySekai images and soundtrack audio are read from the JP asset server in every region, since the other servers do not host them.

Regenerate the master API SDK for the new `mysekaiFixtures`, `mysekaiMaterials`, and `mysekaiMusicRecords` operations.

Add a MySekai Secret Shop page (JP 7.0.0) listing the materials and tools the shop sells, with their crystal price and per-World-Pass purchase limit; materials link to their pages. Support JP 7.0.0 solo virtual lives: list and filter them as Solo Live, show their Cheer Coin rewards by coins spent, including the leftover-coin reward, and show the group banner for solo and virtual message lives, which have no banner of their own. Rewards of MySekai materials and tools, stamps, and virtual live archive items show their icons instead of a placeholder, and a stamp reward opens in the image preview with WebP and PNG downloads.

Regenerate the master API SDK for the `mysekaiShops` operation, the solo virtual live reward fields, and the virtual live list's `virtualLiveGroup`.

Add a Stamps page to the content-site sidebar, after Titles. Stamps can be searched by name, filtered by category (single character, bond, text, other) and by one character, with a switch that adds a second character so only stamps showing both appear. The list shows only the stamp images; selecting one opens the image preview with the stamp's name, its characters, and how it is obtained, and WebP and PNG downloads. The shared image preview accepts optional content below the image.

Regenerate the master API SDK for the new `stamps` list operation.
