"""Klon-Test: verhält sich SPAStaticFiles korrekt?"""
import asyncio
import os
import sys

sys.path.insert(0, "/opt/data/wichtel/server")
os.environ["WICHTEL_WEB_DIST"] = "/opt/data/wichtel/web/dist"

from app.config import Settings
from app.db import init_db, open_conn
from app.main import create_app
from app.store import Store

from starlette.testclient import TestClient

settings = Settings(db_path="/opt/data/cache/scratch/spa-unit.db", base_url="")
init_db(settings.db_path)


def store_factory(request):
    return Store(open_conn(settings.db_path))


app = create_app(settings, store_factory)
client = TestClient(app)

# Index
r = client.get("/")
print("GET / ->", r.status_code, r.headers.get("content-type", "")[:20])

# SPA-Fallback
r = client.get("/g/someToken123")
print("GET /g/xyz ->", r.status_code, r.headers.get("content-type", "")[:20])
print("  body startswith <!doctype:", r.text[:9].lower() == "<!doctype")

# API-404 bleibt JSON
r = client.get("/api/groups/invalidinvalidinvalidinvalidinvalidinvalid12")
print("GET /api/... ->", r.status_code, r.json())

# Asset
import re
m = re.search(r'assets/[^"]+', client.get("/").text)
r = client.get("/" + m.group(0))
print("GET asset ->", r.status_code, r.headers.get("content-type", "")[:30])
