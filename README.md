# Wichtel-Tool

Wichteln für die Familie — ohne Anmeldung. Gruppen per Link, private Wunschlisten,
einmalige Auslosung per Knopfdruck.

## Struktur

```
wichtel/
├── openapi.yaml         API-Spezifikation (Single Source of Truth)
├── Dockerfile           Multi-Stage: Frontend-Build + Python-Runtime
├── docker-compose.yml   Ein Container, Port 8000, SQLite im Volume
├── server/              FastAPI-Backend (Python)
│   ├── app/             tokens, db, store, draw (Derangement), routes, static
│   └── tests/           24 pytest-Tests (API + Algorithmus)
└── web/                 React 18 + TypeScript + Vite
    └── src/pages/       Home, Create, Admin, Join, Participant
```

## Deployment (Docker)

```bash
docker compose build
docker compose up -d
```

Erreichbar unter `http://<host>:8000`. Die SQLite-Datenbank liegt im
Docker-Volume `wichtel-data`.

Hinter einem Reverse-Proxy die öffentliche URL setzen, damit die geteilten
Links korrekt sind:

```yaml
environment:
  WICHTEL_BASE_URL: https://wichtel.example.com
```

(Notwendig nur, wenn der Proxy die Host-Header nicht durchreicht; das
Frontend normalisiert Share-URLs ohnehin auf sein eigenes Origin.)

## Entwicklung ohne Docker

```bash
# Backend
cd server
uv venv .venv && uv pip install --python .venv/bin/python -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m uvicorn app.main:create_app_from_env --factory --port 8000

# Frontend (Dev-Server mit /api-Proxy auf :8000)
cd web
npm install
npm run dev

# Tests
cd server && .venv/bin/python -m pytest tests/ -q
cd web && npm run build   # tsc + vite build
```

## URL-Schema

```
/create              Neue Gruppe anlegen (Ersteller = Admin)
/g/<adminToken>      Admin-Ansicht (Token nur einmal sichtbar, nur Hash in DB)
/join/<joinToken>    Beitritt (Link wird vom Admin geteilt)
/p/<personalToken>   Teilnehmer-Ansicht (Token nur einmal sichtbar)
```

## Sicherheit

- Alle Tokens: 32 zufällige Bytes (base64url, 43 Zeichen), in der DB nur als
  SHA-256-Hash (außer Join-Token, der muss für den Admin rekonstruierbar sein).
- Ungültige Tokens: einheitliches 404 ohne Orakel.
- Wünsche serverseitig geschützt: vor der Auslosung sieht niemand fremde Wünsche.
- Auslosung: fixpunktfreie Permutation (Derangement), transaktional, unwiderruflich;
  Join-Link danach deaktiviert; zweiter Draw-Aufruf → 409.
- Rate-Limiting: 10 Gruppenerstellungen / 30 Beitritte pro IP und Stunde.
