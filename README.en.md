# Wichtel Tool (Secret Santa)

Secret Santa for the family — no registration required. Groups via link,
private wish lists, one-time drawing at the push of a button.

## Structure

```
wichtel/
├── openapi.yaml         API specification (single source of truth)
├── Dockerfile           Multi-stage: frontend build + Python runtime
├── docker-compose.yml   Single container, port 8000, SQLite in a volume
├── server/              FastAPI backend (Python)
│   ├── app/             tokens, db, store, draw (derangement), routes, static
│   └── tests/           39 pytest tests (API + algorithm)
└── web/                 React 18 + TypeScript + Vite
    └── src/pages/       Home, Create, Admin, Join, Participant
```

## Deployment (Docker)

```bash
docker compose build
docker compose up -d
```

Available at `http://<host>:8000`. The SQLite database lives in the Docker
volume `wichtel-data`.

**Note when updating from an older (root) version:** An existing
`wichtel-data` volume is still owned by root; the app now runs as a
non-root user and cannot write to it. Fix the ownership once:

```bash
docker compose down
docker volume rm wichtel_wichtel-data   # OR: change ownership via a helper container
docker compose up -d                     # volume is recreated fresh (owned by wichtel)
```

To keep the existing data, fix the permissions before removing anything
(check the user ID inside the container, usually 100):

```bash
docker run --rm -v wichtel_wichtel-data:/data alpine chown -R 100:100 /data
```

Behind a reverse proxy, set the public URL so the shared links are correct:

```yaml
environment:
  WICHTEL_BASE_URL: https://wichtel.example.com
```

(Only necessary if the proxy does not pass the Host header through; the
frontend normalizes share URLs to its own origin anyway.)

## Security

The container is deliberately hardened:

- **Minimal base image:** `python:3.12-alpine` (musl, no apt package list,
  small attack surface).
- **Non-root runtime:** the app runs as the dedicated user `wichtel`
  (no shell, no home directory). `USER wichtel` is set in the Dockerfile.
- **No build tools in the final image:** gcc/musl-dev are only present
  during `pip install` and removed afterwards (`apk del`).
- **No package manager in the final image:** pip, setuptools and wheel are
  uninstalled after the dependency installation — the base image's pip
  25.0.1 ships with known CVEs (symlink extraction, path traversal in
  malicious wheels) which is why it never reaches the runtime image.

## Development without Docker

```bash
# Backend
cd server
uv venv .venv && uv pip install --python .venv/bin/python -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m uvicorn app.main:create_app_from_env --factory --port 8000

# Frontend (dev server with /api proxy to :8000)
cd web
npm install
npm run dev

# Tests
cd server && .venv/bin/python -m pytest tests/ -q
cd web && npm run build   # tsc + vite build
```

## URL Scheme

```
/create              Create a new group (creator = admin)
/g/<adminToken>      Admin view (token shown once, only hash in the DB)
/join/<joinToken>    Join (link shared by the admin)
/p/<personalToken>   Participant view (token shown once)
```

## Security Model

- All tokens: 32 random bytes (base64url, 43 characters), stored in the DB
  only as SHA-256 hash (except the join token, which must remain
  reconstructable for the admin).
- Invalid tokens: uniform 404, no token oracle.
- Wishes are protected server-side: before the drawing nobody can see
  anyone else's wishes.
- Drawing: fixed-point-free permutation (derangement), transactional and
  irreversible; the join link is deactivated afterwards; a second draw
  call returns 409.
- Rate limiting: 10 group creations / 30 joins per IP and hour.
