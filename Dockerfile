# ---- Stage 1: React-Frontend bauen ----
FROM node:22-slim AS web
WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- Stage 2: Python-Backend + Frontend ----
FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app ./app
COPY --from=web /build/dist ./web/dist

ENV WICHTEL_DB_PATH=/data/wichtel.db
ENV WICHTEL_WEB_DIST=/app/web/dist
EXPOSE 8000

CMD ["uvicorn", "app.main:create_app_from_env", "--factory", "--host", "0.0.0.0", "--port", "8000"]
