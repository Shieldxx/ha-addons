# Changelog

## 0.1.1 (2026-11-12)

- Home Assistant Core may call the dashboard through the add-on
  (`http://66cc3ac9-tradesmith-panel:8099`), so rest sensors and the kill switch need no
  copy of the dashboard token in `secrets.yaml`.

## 0.1.0 (2026-11-12)

- First release: ingress sidebar panel proxying the Tradesmith dashboard, with the
  dashboard password added by the proxy.
