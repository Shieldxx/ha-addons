ARG BUILD_FROM
FROM ${BUILD_FROM:-python:3.11-alpine}

WORKDIR /app

# The compiler is there only in case a dependency has no prebuilt wheel for this
# architecture, and is removed in the same layer so it never ships in the image.
COPY requirements.txt .
RUN apk add --no-cache --virtual .build-deps gcc musl-dev libffi-dev \
    && pip install --no-cache-dir -r requirements.txt \
    && apk del .build-deps

COPY . .

RUN chmod a+x run.sh

CMD ["/app/run.sh"]
