"""Tests für das SPA-Serving (Frontend aus web/dist, SPA-Fallback)."""
import os
import re
import sys

import pytest
from starlette.testclient import TestClient

sys.path.insert(0, str(os.path.dirname(os.path.dirname(__file__))))

from app.config import Settings
from app.db import init_db, open_conn
from app.main import create_app
from app.store import Store

DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "web", "dist")


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = str(tmp_path / "spa.db")
    init_db(db_path)
    if os.path.isdir(DIST):
        monkeypatch.setenv("WICHTEL_WEB_DIST", DIST)
    else:
        pytest.skip("web/dist nicht gebaut — erst 'npm run build' im web/-Verzeichnis")
    settings = Settings(db_path=db_path, base_url="")

    def store_factory(request):
        return Store(open_conn(db_path))

    app = create_app(settings, store_factory)
    return TestClient(app)


def test_index_served(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "<!doctype html" in r.text.lower()


def test_spa_fallback_for_unknown_routes(client):
    for path in ["/g/someToken123", "/p/anotherOne", "/join/xyz", "/gibtsnicht"]:
        r = client.get(path)
        assert r.status_code == 200, path
        assert "<!doctype html" in r.text.lower(), path


def test_assets_served(client):
    html = client.get("/").text
    m = re.search(r'(assets/[^"]+\.js)', html)
    assert m, "kein JS-Asset im index.html gefunden"
    r = client.get("/" + m.group(1))
    assert r.status_code == 200
    assert "javascript" in r.headers["content-type"]


def test_api_404_stays_json(client):
    r = client.get("/api/groups/" + "invalid" * 8)
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")
    assert r.json()["code"] == "NOT_FOUND"
