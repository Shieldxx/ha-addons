# Beszel Hub

Lightweight self-hosted server monitoring hub — the central dashboard for [Beszel](https://beszel.dev).

Runs the official `henrygd/beszel` image as a native Home Assistant add-on. Data is persisted to the add-on's `/data` volume, so it survives restarts and add-on updates.

## Setup

1. Install and **Start** the add-on.
2. Open the **Web UI** (port `8090`) and create your admin account.
3. **Add System** for each machine you want to monitor, copy the public key, then install a Beszel **agent** on that machine pointing at this hub.

## Backups

Uninstalling the add-on deletes its `/data` folder. Beszel's own backup carries
everything across: open `/_/#/settings/backups` in the web UI, create a backup and
download the ZIP; in a new installation, upload it there and restore.

## Notes

- Default web UI port: `8090`.
- The add-on builds locally from `henrygd/beszel:latest` on install.

## License

This add-on (Dockerfile, nginx configuration, start script) is MIT — see [LICENSE](LICENSE).
Beszel itself is © henrygd under the MIT License and is pulled as its official image at
build time; `icon.png` is Beszel's logo from [henrygd/beszel](https://github.com/henrygd/beszel).
