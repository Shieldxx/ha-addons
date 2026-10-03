# Changelog

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
