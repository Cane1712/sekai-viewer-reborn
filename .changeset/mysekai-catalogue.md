---
"@platform/sekai-master-api-sdk": minor
"@platform/i18n-source": minor
"@apps/content-site": minor
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

Add a MySekai group to the content-site sidebar with Furniture, Materials, and Soundtracks catalogues. Furniture can be searched and filtered by genre, sub-genre, series, unit, and character, and each piece has a detail page with its size, placement, tags, crafting materials, disassembly returns, and character bonus. Materials list where they are gathered and which furniture they craft. Soundtracks lists the MySekai music record soundtracks by category, and plays them in place. MySekai images and soundtrack audio are read from the JP asset server in every region, since the other servers do not host them.

Regenerate the master API SDK for the new `mysekaiFixtures`, `mysekaiMaterials`, and `mysekaiMusicRecords` operations.
