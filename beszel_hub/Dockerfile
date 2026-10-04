# Multi-stage: vezmeme beszel binarku z oficialniho (distroless) image
# a spustime ji za malym nginx reverse-proxy. Nginx strhne hlavicku
# X-Frame-Options (kterou Beszel posila jako SAMEORIGIN), aby sel dashboard
# vlozit do iframe = HA "Webpage" dashboard v postranni liste. Beszel bezi
# na root ceste (127.0.0.1:8091), takze se absolutni asset cesty nerozbiji.
#
# Verze Beszelu je pripnuta: s `latest` si kazda instalace stahla, co zrovna
# vyslo, a 0.21 zmenila HTML tak, ze prestal fungovat prepis cest v nginx.conf.
# Novejsi Beszel = zvednout tag tady, overit postranni listu, zvednout verzi.
FROM henrygd/beszel:0.21.0 AS beszel

FROM alpine:3.20
RUN apk add --no-cache nginx ca-certificates
COPY --from=beszel /beszel /beszel
COPY nginx.conf /etc/nginx/nginx.conf
COPY run.sh /run.sh
RUN chmod +x /run.sh
EXPOSE 8090
CMD ["/run.sh"]
