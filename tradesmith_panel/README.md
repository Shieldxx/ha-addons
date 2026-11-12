# Tradesmith

Sidebar panel for a Tradesmith trading dashboard that runs
on another machine in your network. The add-on is only a reverse proxy: it shows the
dashboard inside Home Assistant (also remotely through Home Assistant Cloud) and adds
the dashboard password, so you are not asked for it.

## Setup

1. Install the add-on and open **Configuration**:
   - `upstream_url`: the dashboard's address, e.g. `http://192.168.0.93:8080`
   - `dashboard_password`: the dashboard token (`TS_DASHBOARD_TOKEN`)
2. Start the add-on and turn on **Show in sidebar**.

The dashboard must support running under a path prefix (it reads the
`X-Ingress-Path` header), otherwise links inside the panel leave the ingress URL.

## Security

Only Home Assistant's ingress gateway can reach the proxy, so the dashboard is
protected by your Home Assistant login. The add-on publishes no port.
