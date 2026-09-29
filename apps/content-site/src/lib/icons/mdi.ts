/**
 * Offline MDI icon registry for @iconify/svelte.
 *
 * All MDI icons used in content-site are registered here via `addIcon`,
 * making them available synchronously — no CDN fetch, no flash of empty
 * button frames on first load.
 *
 * HOW TO ADD A NEW ICON:
 *   1. `pnpm add -D @iconify-icons/mdi --filter @apps/content-site`
 *   2. Import the icon data below.
 *   3. Add a `addIcon("mdi:<name>", data)` line.
 *   4. Use `<Icon icon="mdi:<name>" />` as before — it now resolves instantly.
 *
 * NOTE: Import names use camelCase (kebab → camel), e.g.
 *   "mdi:view-grid-outline" → import viewGridOutline from "@iconify-icons/mdi/view-grid-outline"
 *   "mdi:clock-start"       → import clockStart from "@iconify-icons/mdi/clock-start"
 */

import { addIcon } from "@iconify/svelte";

// ── MySekai ──────────────────────────────────────────────────────────
import sofaOutline from "@iconify-icons/mdi/sofa-outline";
import pineTreeVariantOutline from "@iconify-icons/mdi/pine-tree-variant-outline";
import album from "@iconify-icons/mdi/album";
import hammerWrench from "@iconify-icons/mdi/hammer-wrench";
import packageVariantClosed from "@iconify-icons/mdi/package-variant-closed";

// ── Layout / Navigation ──────────────────────────────────────────────
import homeVariantOutline from "@iconify-icons/mdi/home-variant-outline";
import cardsOutline from "@iconify-icons/mdi/cards-outline";
import musicNoteOutline from "@iconify-icons/mdi/music-note-outline";
import musicNoteEighth from "@iconify-icons/mdi/music-note-eighth";
import musicNoteQuarter from "@iconify-icons/mdi/music-note-quarter";
import calendarStar from "@iconify-icons/mdi/calendar-star";
import calendarStarOutline from "@iconify-icons/mdi/calendar-star-outline";
import giftOutline from "@iconify-icons/mdi/gift-outline";
import accountVoice from "@iconify-icons/mdi/account-voice";
import medalOutline from "@iconify-icons/mdi/medal-outline";
import handHeart from "@iconify-icons/mdi/hand-heart";
import patreon from "@iconify-icons/mdi/patreon";
import coffee from "@iconify-icons/mdi/coffee";
import twitter from "@iconify-icons/mdi/twitter";
import github from "@iconify-icons/mdi/github";

// ── Toolbar: Sort / View / Filter ────────────────────────────────────
import clockOutline from "@iconify-icons/mdi/clock-outline";
import clockStart from "@iconify-icons/mdi/clock-start";
import numeric from "@iconify-icons/mdi/numeric";
import viewGridOutline from "@iconify-icons/mdi/view-grid-outline";
import viewAgendaOutline from "@iconify-icons/mdi/view-agenda-outline";
import viewComfyOutline from "@iconify-icons/mdi/view-comfy-outline";
import funnel from "@iconify-icons/mdi/funnel";
import filterVariant from "@iconify-icons/mdi/filter-variant";
import arrowUp from "@iconify-icons/mdi/arrow-up";
import arrowDown from "@iconify-icons/mdi/arrow-down";
import arrowRight from "@iconify-icons/mdi/arrow-right";
import chevronLeft from "@iconify-icons/mdi/chevron-left";
import chevronRight from "@iconify-icons/mdi/chevron-right";
import apps from "@iconify-icons/mdi/apps";
import dotsHorizontalCircleOutline from "@iconify-icons/mdi/dots-horizontal-circle-outline";

// ── Settings / Theme / Locale ───────────────────────────────────────
import cogOutline from "@iconify-icons/mdi/cog-outline";
import paletteOutline from "@iconify-icons/mdi/palette-outline";
import check from "@iconify-icons/mdi/check";
import translate from "@iconify-icons/mdi/translate";
import tuneVariant from "@iconify-icons/mdi/tune-variant";
import brightnessAuto from "@iconify-icons/mdi/brightness-auto";
import whiteBalanceSunny from "@iconify-icons/mdi/white-balance-sunny";
import weatherNight from "@iconify-icons/mdi/weather-night";

// ── Detail pages ─────────────────────────────────────────────────────
import informationOutline from "@iconify-icons/mdi/information-outline";
import timerSand from "@iconify-icons/mdi/timer-sand";
import chartBar from "@iconify-icons/mdi/chart-bar";
import chartBoxOutline from "@iconify-icons/mdi/chart-box-outline";
import openInNew from "@iconify-icons/mdi/open-in-new";
import eyeOutline from "@iconify-icons/mdi/eye-outline";
import playCircleOutline from "@iconify-icons/mdi/play-circle-outline";
import play from "@iconify-icons/mdi/play";
import pause from "@iconify-icons/mdi/pause";
import stop from "@iconify-icons/mdi/stop";
import cardAccountDetailsOutline from "@iconify-icons/mdi/card-account-details-outline";
import creationOutline from "@iconify-icons/mdi/creation-outline";
import bookOpenPageVariantOutline from "@iconify-icons/mdi/book-open-page-variant-outline";
import microphoneVariant from "@iconify-icons/mdi/microphone-variant";
import percentOutline from "@iconify-icons/mdi/percent-outline";
import doorOpen from "@iconify-icons/mdi/door-open";
import accountGroup from "@iconify-icons/mdi/account-group";
import calendarClock from "@iconify-icons/mdi/calendar-clock";
import playlistCheck from "@iconify-icons/mdi/playlist-check";
import alertCircleOutline from "@iconify-icons/mdi/alert-circle-outline";
import accountSearchOutline from "@iconify-icons/mdi/account-search-outline";
import magnify from "@iconify-icons/mdi/magnify";

// ── Gacha ─────────────────────────────────────────────────────────────
import diceMultipleOutline from "@iconify-icons/mdi/dice-multiple-outline";
import dice1 from "@iconify-icons/mdi/dice-1";
import diceMultiple from "@iconify-icons/mdi/dice-multiple";
import refresh from "@iconify-icons/mdi/refresh";
import slotMachineOutline from "@iconify-icons/mdi/slot-machine-outline";
import ticketOutline from "@iconify-icons/mdi/ticket-outline";
import diamondOutline from "@iconify-icons/mdi/diamond-outline";

// ── UI Shell (shared package) ───────────────────────────────────────
import menu from "@iconify-icons/mdi/menu";
import magnifyPlusOutline from "@iconify-icons/mdi/magnify-plus-outline";
import earth from "@iconify-icons/mdi/earth";
import musicOff from "@iconify-icons/mdi/music-off";
import download from "@iconify-icons/mdi/download";
import volumeHigh from "@iconify-icons/mdi/volume-high";
import volumeOff from "@iconify-icons/mdi/volume-off";
import close from "@iconify-icons/mdi/close";

// ── Text / UI helpers ─────────────────────────────────────────────────
import chevronUp from "@iconify-icons/mdi/chevron-up";
import chevronDown from "@iconify-icons/mdi/chevron-down";
import closeCircleOutline from "@iconify-icons/mdi/close-circle-outline";
import textShort from "@iconify-icons/mdi/text-short";
import textBoxOutline from "@iconify-icons/mdi/text-box-outline";
import mapSearchOutline from "@iconify-icons/mdi/map-search-outline";
import refreshCircle from "@iconify-icons/mdi/refresh-circle";
import reload from "@iconify-icons/mdi/reload";
import fileRemoveOutline from "@iconify-icons/mdi/file-remove-outline";
import puzzle from "@iconify-icons/mdi/puzzle";

// ── Register all icons ───────────────────────────────────────────────
addIcon("mdi:home-variant-outline", homeVariantOutline);
addIcon("mdi:cards-outline", cardsOutline);
addIcon("mdi:music-note-outline", musicNoteOutline);
addIcon("mdi:music-note-eighth", musicNoteEighth);
addIcon("mdi:music-note-quarter", musicNoteQuarter);
addIcon("mdi:calendar-star", calendarStar);
addIcon("mdi:calendar-star-outline", calendarStarOutline);
addIcon("mdi:gift-outline", giftOutline);
addIcon("mdi:account-voice", accountVoice);
addIcon("mdi:medal-outline", medalOutline);
addIcon("mdi:hand-heart", handHeart);
addIcon("mdi:patreon", patreon);
addIcon("mdi:coffee", coffee);
addIcon("mdi:twitter", twitter);
addIcon("mdi:github", github);

addIcon("mdi:clock-outline", clockOutline);
addIcon("mdi:clock-start", clockStart);
addIcon("mdi:numeric", numeric);
addIcon("mdi:view-grid-outline", viewGridOutline);
addIcon("mdi:view-agenda-outline", viewAgendaOutline);
addIcon("mdi:view-comfy-outline", viewComfyOutline);
addIcon("mdi:funnel", funnel);
addIcon("mdi:filter-variant", filterVariant);
addIcon("mdi:arrow-up", arrowUp);
addIcon("mdi:arrow-down", arrowDown);
addIcon("mdi:arrow-right", arrowRight);
addIcon("mdi:chevron-left", chevronLeft);
addIcon("mdi:chevron-right", chevronRight);
addIcon("mdi:apps", apps);
addIcon("mdi:dots-horizontal-circle-outline", dotsHorizontalCircleOutline);

addIcon("mdi:cog-outline", cogOutline);
addIcon("mdi:palette-outline", paletteOutline);
addIcon("mdi:check", check);
addIcon("mdi:translate", translate);
addIcon("mdi:tune-variant", tuneVariant);
addIcon("mdi:brightness-auto", brightnessAuto);
addIcon("mdi:white-balance-sunny", whiteBalanceSunny);
addIcon("mdi:weather-night", weatherNight);

addIcon("mdi:information-outline", informationOutline);
addIcon("mdi:timer-sand", timerSand);
addIcon("mdi:chart-bar", chartBar);
addIcon("mdi:chart-box-outline", chartBoxOutline);
addIcon("mdi:open-in-new", openInNew);
addIcon("mdi:eye-outline", eyeOutline);
addIcon("mdi:play-circle-outline", playCircleOutline);
addIcon("mdi:play", play);
addIcon("mdi:pause", pause);
addIcon("mdi:stop", stop);
addIcon("mdi:card-account-details-outline", cardAccountDetailsOutline);
addIcon("mdi:creation-outline", creationOutline);
addIcon("mdi:book-open-page-variant-outline", bookOpenPageVariantOutline);
addIcon("mdi:microphone-variant", microphoneVariant);
addIcon("mdi:percent-outline", percentOutline);
addIcon("mdi:door-open", doorOpen);
addIcon("mdi:account-group", accountGroup);
addIcon("mdi:calendar-clock", calendarClock);
addIcon("mdi:playlist-check", playlistCheck);
addIcon("mdi:alert-circle-outline", alertCircleOutline);
addIcon("mdi:account-search-outline", accountSearchOutline);
addIcon("mdi:magnify", magnify);

addIcon("mdi:dice-multiple-outline", diceMultipleOutline);
addIcon("mdi:dice-1", dice1);
addIcon("mdi:dice-multiple", diceMultiple);
addIcon("mdi:refresh", refresh);
addIcon("mdi:slot-machine-outline", slotMachineOutline);
addIcon("mdi:ticket-outline", ticketOutline);
addIcon("mdi:diamond-outline", diamondOutline);

addIcon("mdi:chevron-up", chevronUp);
addIcon("mdi:chevron-down", chevronDown);
addIcon("mdi:close-circle-outline", closeCircleOutline);
addIcon("mdi:text-short", textShort);
addIcon("mdi:text-box-outline", textBoxOutline);
addIcon("mdi:map-search-outline", mapSearchOutline);
addIcon("mdi:refresh-circle", refreshCircle);
addIcon("mdi:reload", reload);
addIcon("mdi:file-remove-outline", fileRemoveOutline);
addIcon("mdi:puzzle", puzzle);

addIcon("mdi:menu", menu);
addIcon("mdi:magnify-plus-outline", magnifyPlusOutline);
addIcon("mdi:earth", earth);
addIcon("mdi:music-off", musicOff);
addIcon("mdi:download", download);
addIcon("mdi:volume-high", volumeHigh);
addIcon("mdi:volume-off", volumeOff);
addIcon("mdi:close", close);

addIcon("mdi:sofa-outline", sofaOutline);
addIcon("mdi:pine-tree-variant-outline", pineTreeVariantOutline);
addIcon("mdi:album", album);
addIcon("mdi:hammer-wrench", hammerWrench);
addIcon("mdi:package-variant-closed", packageVariantClosed);
