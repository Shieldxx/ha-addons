# A reverse proxy only: Tradesmith itself keeps running on its own host. nginx
# serves Home Assistant ingress on 8099 and forwards to the dashboard, adding
# the dashboard's HTTP Basic credentials so the browser never sees a prompt.
FROM alpine:3.20
RUN apk add --no-cache nginx jq
COPY nginx.conf.tmpl /etc/nginx/nginx.conf.tmpl
COPY run.sh /run.sh
RUN chmod +x /run.sh
CMD ["/run.sh"]
