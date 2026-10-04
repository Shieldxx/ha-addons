# Changelog

## 0.2.3 — 2026-10-04

### Fixed
- Saving can no longer leave the data file empty or half written if the power
  goes out at the wrong moment.
- The chart's range slider no longer piles its handles up at the left edge — after
  an import, when the app opens on another tab, or when the screen is rotated.
- Dates can be typed on the iPhone number pad: `18092026` works, and so do
  `18.9.2026`, `18,9,2026`, `18/9/2026` and `18-9-2026`.
- Changing the age group in Settings no longer silently rewrites % of body weight
  and every ratio. Loading a preset is what the preset menu is for.
- Settings refuses ratios that do not add up to 100 % and shows the total, and says
  so when the dog's name is missing, instead of doing nothing.
- The "K nákupu" column is green, and its zero rows are dimmed, as intended.
- Small grey text is easier to read, in both themes.
- Tapping a field's label puts the cursor in the field.
- The language button shows the language it switches to, and the header buttons are
  easier to hit on a phone.
- In dialogs, Cancel is on the left, as on iPhone.
- Preset names are translated; two Czech texts are corrected.

## 0.2.2 — 2026-10-04

### Fixed
- The add-on starts. 0.2.1 stopped straight away with "s6-overlay-suexec: fatal: can
  only run as pid 1", because Docker's own init ran in front of the one the Home
  Assistant base image brings.

## 0.2.1 — 2026-10-03

The first release as a Home Assistant add-on.

### Added
- Runs as a Home Assistant add-on behind ingress, so it is reachable wherever Home
  Assistant is — including away from home through Nabu Casa — with Home Assistant
  handling sign-in.
- Deleting a weight asks first and names the entry, e.g. "18. 9. 2026 (19.3 kg)".
- Importing asks first, shows what is being replaced and what replaces it, and keeps a
  copy of the replaced data in `backups/`.
- The order text sits on the Calculator page, above the breakdown, with Copy right
  under Calculate.
- The tare calculator's result fills the weight field.
- The weight history collapses behind a "Záznamy (N)" heading.

### Changed
- Three tabs instead of five: Váha, Kalkulačka, Nastavení. The Output tab became part of
  the Calculator, and Export / Import moved to the bottom of Settings.
- A new app icon: the dog from the app's header.
- On phones, a floating glass navigation bar, and a layout that respects the notch and
  the home indicator.

### Fixed
- A wrong or damaged file can no longer replace the data: imports are checked before
  anything is written.
- A request that fails no longer shows a success message.
- Saving Settings straight after an import no longer puts the old values back.
- The Calculator no longer keeps showing a result that a new weight has made stale.
- No more accidental zoom on iPhone — by pinch, double-tap, or tapping into a field.

### License
- Now licensed under the PolyForm Noncommercial License 1.0.0; free for personal use.
  Third-party components and their licenses are listed in `THIRD_PARTY_NOTICES.md`.
