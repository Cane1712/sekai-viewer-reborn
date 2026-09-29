---
"@apps/content-site": patch
---

Tidy the Titles catalogue search. The visible "Search titles" heading is gone and the text shows as the field's placeholder; the field is named by `aria-label` alone (the old label also wrapped the Search button, so assistive technology read the field as "Search titles Search"). The Search button is a 44px icon button named "Search". Emptying the field, by deleting its text or with its clear button, drops the applied search from the URL at once.
