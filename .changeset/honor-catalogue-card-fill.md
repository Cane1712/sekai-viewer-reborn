---
"@apps/content-site": patch
---

Fill the Titles catalogue cards and dialog. Titles now scale to the width of their card or dialog up to their full 380px size and switch to the small sub slot only below 200px (was 266px, where the fixed-size title no longer fit), so cards between 200px and 266px wide, such as three columns at a 1024px window or one column on a 320px phone, keep the full title scaled down, instead of staying at 266px on the left of a card up to 545px wide. The catalogue shows two columns from `md` and three from `lg`, so a 1235px window shows three 358px cards, each with a 324px title. The title group dialog narrows to 512px and shows each rarity's title at full size.
