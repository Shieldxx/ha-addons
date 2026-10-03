# Shieldxx Home Assistant add-ons

[![Add this repository to your Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FShieldxx%2Fha-addons)

## BARF Companion

A raw-feeding (BARF) planner for dogs: weight history, a portion calculator that
accounts for what is already in the freezer, and a ready-to-send order list.

It runs behind Home Assistant ingress, so it is available wherever Home Assistant
is - including remotely through Nabu Casa - and Home Assistant handles sign-in.
Data lives in `/config/barf-companion/` and survives restarts and updates.

## Installing

1. **Settings -> Add-ons -> Add-on Store -> (top-right menu) -> Repositories**
2. Add `https://github.com/Shieldxx/ha-addons`
3. Open **BARF Companion**, install it, start it, and turn on **Show in sidebar**

Or use the button above.
