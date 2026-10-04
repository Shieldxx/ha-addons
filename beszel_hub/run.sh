#!/bin/sh
set -e

# Beszel na internim portu 8091, data do /data (perzistentni HAOS add-on volume)
/beszel serve --http=127.0.0.1:8091 --dir=/data &

# nginx v popredi = hlavni proces kontejneru
exec nginx -g 'daemon off;'
