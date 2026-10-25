# ---- Stage 1: React-Frontend bauen ----
FROM node:22-alpine AS web
WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci
# Explizit nur Quelldateien — ein ggf. mitkopiertes node_modules/dist
# kann die frische Installation nicht überschreiben.
COPY web/index.html web/tsconfig.json web/vite.config.ts ./
COPY web/src ./src
RUN npm run build

# ---- Stage 2: Python-Backend + Frontend (minimal, non-root) ----
FROM python:3.12-alpine
WORKDIR /app

# Build-Tools nur für die pip-Installation, danach wieder entfernen
# (kein gcc im finalen Image). pip-Cache deaktiviert.
# pip selbst auf den neuesten Stand heben und NACH der Installation aus dem
# Image entfernen: die Basis-Image-pip-Version (25.0.1) hat offene CVEs
# (Symlink-Extraktion, Path Traversal, malicious wheels) — im Laufzeit-Image
# wird pip aber ohnehin nicht gebraucht.
COPY server/requirements.txt .
RUN apk add --no-cache --virtual .build-deps gcc musl-dev \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && apk del .build-deps \
    && pip uninstall --yes pip setuptools wheel \
    && rm -rf /usr/local/lib/python3.12/site-packages/pip* \
              /usr/local/lib/python3.12/site-packages/setuptools* \
              /usr/local/lib/python3.12/site-packages/wheel*

COPY server/app ./app
COPY --from=web /build/dist ./web/dist

# Nicht-root-User: eigener Systemuser ohne Shell, Home nicht benötigt.
RUN adduser -D -H -s /sbin/nologin wichtel \
    && mkdir -p /data \
    && chown wichtel:wichtel /data /app
USER wichtel

ENV WICHTEL_DB_PATH=/data/wichtel.db
ENV WICHTEL_WEB_DIST=/app/web/dist
EXPOSE 8000

CMD ["uvicorn", "app.main:create_app_from_env", "--factory", "--host", "0.0.0.0", "--port", "8000"]
