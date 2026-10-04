# Changelog

## 1.2.1 — 2026-10-04

- Moved to [Shieldxx/ha-addons](https://github.com/Shieldxx/ha-addons), the one
  repository for all Shieldxx add-ons. Coming from the old `hassio-beszel-hub`
  repository: back up in Beszel first (`/_/#/settings/backups`), then uninstall the
  old add-on, install this one and restore the backup — the old add-on's data folder
  is deleted with it.
- Licensed under MIT.

## 1.2.0 — 2026-07-18

- Opens in the Home Assistant sidebar through ingress, with no hard-coded IP address.
  Direct LAN access on port 8090 still works.

## 1.1.0 — 2026-07-18

- Runs behind a small nginx proxy, so the dashboard can be embedded in a Home Assistant
  page. Beszel itself listens internally on port 8091.

## 1.0.1 — 2026-07-18

- Fixed the build: the official image has no shell, so the data directory is passed
  on the command line. Data persists in the add-on's `/data`.

## 1.0.0 — 2026-07-18

- First version: the official `henrygd/beszel` image as a Home Assistant add-on.
