#!/bin/sh
# Render nginx.conf from the add-on options, then run nginx in the foreground.
# The password only ever lands in the rendered config inside the container
# (mode 600); it is never printed.
set -eu

OPTS=/data/options.json
UPSTREAM=$(jq -r '.upstream_url // ""' "$OPTS" | sed 's:/*$::')
PASSWORD=$(jq -r '.dashboard_password // ""' "$OPTS")

case "$UPSTREAM" in
    http://*|https://*) ;;
    *) echo "[tradesmith] Set upstream_url (e.g. http://192.168.0.93:8080) in the add-on configuration." >&2
       exit 1 ;;
esac
if [ -z "$PASSWORD" ]; then
    echo "[tradesmith] Set dashboard_password in the add-on configuration." >&2
    exit 1
fi
case "$UPSTREAM" in
    *[!A-Za-z0-9:/._-]*) echo "[tradesmith] upstream_url contains unexpected characters." >&2; exit 1 ;;
esac

# Tradesmith accepts any username; the password is the dashboard token.
AUTH=$(printf 'ha:%s' "$PASSWORD" | base64 | tr -d '\n')

umask 077
rm -f /etc/nginx/nginx.conf    # the package ships one (644); render a fresh 600 file
sed -e "s|@UPSTREAM@|$UPSTREAM|g" -e "s|@AUTH@|$AUTH|g" \
    /etc/nginx/nginx.conf.tmpl > /etc/nginx/nginx.conf
echo "[tradesmith] proxying ingress to $UPSTREAM"
exec nginx -g 'daemon off;'
