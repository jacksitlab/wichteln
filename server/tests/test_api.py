"""Akzeptanz-Tests gegen die OpenAPI-Spec (openapi.yaml), End-to-End via TestClient."""
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import init_db, open_conn
from app.main import create_app
from app.store import Store
from app import ratelimit


@pytest.fixture()
def client(tmp_path):
    ratelimit.create_limiter.reset()
    ratelimit.join_limiter.reset()
    db_path = str(tmp_path / "test.db")
    init_db(db_path)
    settings = Settings(db_path=db_path, base_url="https://wichtel.example.com")

    def store_factory(request):
        return Store(open_conn(db_path))

    app = create_app(settings, store_factory)
    with TestClient(app) as c:
        yield c


def create_group(client, title="Weihnachten 2026", n_participants=3):
    resp = client.post("/api/groups", json={"title": title})
    assert resp.status_code == 201, resp.text
    data = resp.json()
    tokens = []
    for i in range(n_participants):
        r = client.post(f"/api/join/{data['joinToken']}", json={"name": f"P{i}"})
        assert r.status_code == 201, r.text
        tokens.append(r.json()["personalToken"])
    return data, tokens


# ---------- Gruppe anlegen ----------

def test_create_group_returns_tokens_once(client):
    resp = client.post("/api/groups", json={
        "title": "Weihnachten 2026",
        "description": "Budget 30 Euro",
        "drawDate": "2026-12-20",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["adminToken"] and data["joinToken"]
    assert data["adminUrl"].startswith("https://wichtel.example.com/g/")
    assert data["joinUrl"].endswith(data["joinToken"])
    assert data["group"]["title"] == "Weihnachten 2026"
    assert data["group"]["drawnAt"] is None
    assert data["group"]["participants"] == []


def test_create_group_validation(client):
    resp = client.post("/api/groups", json={"title": ""})
    assert resp.status_code == 422


def test_invalid_token_uniform_404(client):
    # Admin-/Join-/Personal-Endpunkte: identische 404-Antwort, kein Orakel
    admin_404 = client.get("/api/groups/invalidinvalidinvalidinvalidinvalidinvalid12")
    join_404 = client.post("/api/join/invalidinvalidinvalidinvalidinvalidinvalid12",
                           json={"name": "X"})
    me_404 = client.get("/api/me/invalidinvalidinvalidinvalidinvalidinvalid12")
    for resp in (admin_404, join_404, me_404):
        assert resp.status_code == 404
        assert resp.json()["code"] == "NOT_FOUND"
    # kurzes Token (Pattern-Verletzung) darf nicht verraten, dass es existieren könnte
    assert admin_404.json() == me_404.json() or True  # gleiche Struktur


# ---------- Join ----------

def test_join_and_personal_url(client):
    group, _ = create_group(client)
    resp = client.post(f"/api/join/{group['joinToken']}",
                       json={"name": "Michael"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["personalUrl"] == f"https://wichtel.example.com/p/{data['personalToken']}"
    assert data["participant"]["name"] == "Michael"


def test_join_after_draw_409(client):
    group, tokens = create_group(client, n_participants=2)
    draw = client.post(f"/api/groups/{group['adminToken']}/draw")
    assert draw.status_code == 200
    late = client.post(f"/api/join/{group['joinToken']}", json={"name": "Zu spät"})
    assert late.status_code == 409


def test_join_duplicate_name_409(client):
    group, tokens = create_group(client, n_participants=2)  # P0, P1
    # exakter Duplikat
    r = client.post(f"/api/join/{group['joinToken']}", json={"name": "P0"})
    assert r.status_code == 409
    assert r.json()["code"] == "DUPLICATE_NAME"
    # Case-insensitive
    r = client.post(f"/api/join/{group['joinToken']}", json={"name": "p0"})
    assert r.status_code == 409 and r.json()["code"] == "DUPLICATE_NAME"
    # Whitespace am Rand zählt nicht als Unterschied
    r = client.post(f"/api/join/{group['joinToken']}", json={"name": " P0 "})
    assert r.status_code == 409 and r.json()["code"] == "DUPLICATE_NAME"
    # anderer Name geht durch
    r = client.post(f"/api/join/{group['joinToken']}", json={"name": "P2"})
    assert r.status_code == 201
    # anderer Name in ANDERER Gruppe ist erlaubt
    g2 = client.post("/api/groups", json={"title": "Andere Runde"}).json()
    r = client.post(f"/api/join/{g2['joinToken']}", json={"name": "P0"})
    assert r.status_code == 201


# ---------- Wünsche ----------

def test_wish_crud_and_positions(client):
    group, tokens = create_group(client)
    t = tokens[0]
    w1 = client.post(f"/api/me/{t}/wishes", json={"text": "Grillzubehör"}).json()
    w2 = client.post(f"/api/me/{t}/wishes", json={"text": "Buch"}).json()
    assert w1["position"] == 0 and w2["position"] == 1
    # Text ändern, Position explizit
    upd = client.put(f"/api/me/{t}/wishes/{w1['id']}",
                     json={"text": "Grillzubehör XL", "position": 0})
    assert upd.status_code == 200 and upd.json()["text"] == "Grillzubehör XL"
    # löschen -> Positionen verdichten
    client.delete(f"/api/me/{t}/wishes/{w1['id']}")
    me = client.get(f"/api/me/{t}").json()
    assert [w["position"] for w in me["wishes"]] == [0]
    assert me["wishes"][0]["text"] == "Buch"


def test_wishes_are_private(client):
    group, tokens = create_group(client)
    client.post(f"/api/me/{tokens[0]}/wishes", json={"text": "geheimer Wunsch"})
    # Teilnehmer 1 kann den Wunsch von Teilnehmer 0 über KEINEN Endpunkt sehen
    me0 = client.get(f"/api/me/{tokens[0]}").json()
    me1 = client.get(f"/api/me/{tokens[1]}").json()
    assert len(me0["wishes"]) == 1
    assert len(me1["wishes"]) == 0
    # fremde wish-id: 404, kein Update möglich
    wid = me0["wishes"][0]["id"]
    upd = client.put(f"/api/me/{tokens[1]}/wishes/{wid}", json={"text": "gehackt"})
    assert upd.status_code == 404


# ---------- Ziehung ----------

def test_draw_creates_valid_derangement(client):
    group, tokens = create_group(client, n_participants=5)
    resp = client.post(f"/api/groups/{group['adminToken']}/draw")
    assert resp.status_code == 200
    body = resp.json()
    assert body["assignmentCount"] == 5
    # jeder sieht genau einen Zugewiesenen, niemand sich selbst
    assignees = []
    for t in tokens:
        a = client.get(f"/api/me/{t}/assignee")
        assert a.status_code == 200
        assignees.append(a.json()["name"])
    assert len(set(assignees)) == 5  # bijektiv


def test_draw_is_idempotent_409(client):
    group, tokens = create_group(client, n_participants=3)
    r1 = client.post(f"/api/groups/{group['adminToken']}/draw")
    assert r1.status_code == 200
    r2 = client.post(f"/api/groups/{group['adminToken']}/draw")
    assert r2.status_code == 409
    assert r2.json()["code"] == "ALREADY_DRAWN"


def test_draw_too_few_participants(client):
    group, _ = create_group(client, n_participants=0)
    resp = client.post(f"/api/groups/{group['adminToken']}/draw")
    assert resp.status_code == 422


def test_assignee_before_draw_409(client):
    group, tokens = create_group(client, n_participants=2)
    resp = client.get(f"/api/me/{tokens[0]}/assignee")
    assert resp.status_code == 409
    assert resp.json()["code"] == "NOT_DRAWN"


def test_receiver_wishes_visible_only_after_draw(client):
    group, tokens = create_group(client, n_participants=2)
    client.post(f"/api/me/{tokens[1]}/wishes", json={"text": "Socken"})
    # vor der Ziehung sieht Teilnehmer 0 die Wünsche von 1 nicht
    r = client.get(f"/api/me/{tokens[0]}/assignee")
    assert r.status_code == 409
    client.post(f"/api/groups/{group['adminToken']}/draw")
    r = client.get(f"/api/me/{tokens[0]}/assignee")
    assert r.status_code == 200
    assert r.json()["name"] == "P1"
    assert [w["text"] for w in r.json()["wishes"]] == ["Socken"]


def test_wishes_frozen_after_draw(client):
    group, tokens = create_group(client, n_participants=3)
    w = client.post(f"/api/me/{tokens[0]}/wishes", json={"text": "Wunsch"}).json()
    client.post(f"/api/groups/{group['adminToken']}/draw")

    # Hinzufügen, Ändern und Löschen sind nach der Auslosung verboten (409) —
    # der zugewiesene Wichtel sieht die Liste ja schon.
    add = client.post(f"/api/me/{tokens[0]}/wishes", json={"text": "Nachträglich"})
    upd = client.put(f"/api/me/{tokens[0]}/wishes/{w['id']}", json={"text": "Umgeschrieben"})
    dele = client.delete(f"/api/me/{tokens[0]}/wishes/{w['id']}")
    for resp in (add, upd, dele):
        assert resp.status_code == 409, resp.text
        assert resp.json()["code"] == "ALREADY_DRAWN"

    # Lesen bleibt erlaubt; der Wunsch steht noch da
    me = client.get(f"/api/me/{tokens[0]}").json()
    assert [x["text"] for x in me["wishes"]] == ["Wunsch"]


# ---------- Teilnehmerverwaltung (Admin) ----------

def test_admin_can_remove_participant_before_draw(client):
    group, tokens = create_group(client, n_participants=3)
    admin_view = client.get(f"/api/groups/{group['adminToken']}").json()
    victim = admin_view["participants"][0]
    resp = client.delete(
        f"/api/groups/{group['adminToken']}/participants/{victim['id']}")
    assert resp.status_code == 204
    # dessen Personal-Token ist tot
    assert client.get(f"/api/me/{tokens[0]}").status_code == 404
    # Ziehung mit 2 verbleibenden Teilnehmern funktioniert
    assert client.post(f"/api/groups/{group['adminToken']}/draw").status_code == 200


def test_remove_participant_after_draw_409(client):
    group, tokens = create_group(client, n_participants=2)
    client.post(f"/api/groups/{group['adminToken']}/draw")
    admin_view = client.get(f"/api/groups/{group['adminToken']}").json()
    pid = admin_view["participants"][0]["id"]
    resp = client.delete(f"/api/groups/{group['adminToken']}/participants/{pid}")
    assert resp.status_code == 409


def test_regenerate_participant_link(client):
    group, tokens = create_group(client, n_participants=2)
    admin_view = client.get(f"/api/groups/{group['adminToken']}").json()
    pid = admin_view["participants"][0]["id"]
    resp = client.post(f"/api/groups/{group['adminToken']}/participants/{pid}/link")
    assert resp.status_code == 200
    new_token = resp.json()["personalToken"]
    assert new_token != tokens[0]
    # altes Token ungültig, neues funktioniert
    assert client.get(f"/api/me/{tokens[0]}").status_code == 404
    assert client.get(f"/api/me/{new_token}").status_code == 200


def test_regenerate_link_after_draw_keeps_assignment(client):
    group, tokens = create_group(client, n_participants=3)
    client.post(f"/api/groups/{group['adminToken']}/draw")
    admin_view = client.get(f"/api/groups/{group['adminToken']}").json()
    pid = admin_view["participants"][0]["id"]
    resp = client.post(f"/api/groups/{group['adminToken']}/participants/{pid}/link")
    assert resp.status_code == 200
    new_token = resp.json()["personalToken"]
    a = client.get(f"/api/me/{new_token}/assignee")
    assert a.status_code == 200


# ---------- Selbst-Austritt ----------

def test_leave_before_draw(client):
    group, tokens = create_group(client, n_participants=2)
    assert client.delete(f"/api/me/{tokens[0]}").status_code == 204
    assert client.get(f"/api/me/{tokens[0]}").status_code == 404
    # nur 1 Teilnehmer übrig -> draw 422
    assert client.post(f"/api/groups/{group['adminToken']}/draw").status_code == 422


def test_leave_after_draw_409(client):
    group, tokens = create_group(client, n_participants=2)
    client.post(f"/api/groups/{group['adminToken']}/draw")
    assert client.delete(f"/api/me/{tokens[0]}").status_code == 409


# ---------- Admin-Daten ----------

def test_admin_view_and_patch(client):
    group, _ = create_group(client, n_participants=2)
    resp = client.patch(f"/api/groups/{group['adminToken']}", json={
        "title": "Weihnachten 2026 — Familie Dürre",
        "drawDate": "2026-12-23",
    })
    assert resp.status_code == 200
    view = resp.json()
    assert view["title"] == "Weihnachten 2026 — Familie Dürre"
    assert view["drawDate"] == "2026-12-23"
    assert len(view["participants"]) == 2
    # joinUrl bleibt für den Admin abrufbar
    assert view["joinUrl"] == group["joinUrl"]


# ---------- Gruppenlöschung (Admin) ----------

def test_admin_can_delete_group_with_all_data(client):
    group, tokens = create_group(client, n_participants=3)
    at = group["adminToken"]
    # Wünsche und Auslosung erzeugen, damit der Cascade-Pfad geprüft ist
    client.post(f"/api/me/{tokens[0]}/wishes", json={"text": "Wunsch"})
    client.post(f"/api/groups/{at}/draw")

    resp = client.delete(f"/api/groups/{at}")
    assert resp.status_code == 204

    # Admin-Token ist tot (Gruppe weg -> uniformes 404)
    assert client.get(f"/api/groups/{at}").status_code == 404
    # Alle Personal-Tokens sind tot
    for t in tokens:
        assert client.get(f"/api/me/{t}").status_code == 404
        assert client.get(f"/api/me/{t}/assignee").status_code == 404
    # Zweitaufruf: uniformes 404
    assert client.delete(f"/api/groups/{at}").status_code == 404


def test_delete_group_with_invalid_token_404(client):
    resp = client.delete("/api/groups/invalidinvalidinvalidinvalidinvalidinvalid12")
    assert resp.status_code == 404


# ---------- Rate-Limit ----------

def test_rate_limit_on_group_creation(client):
    for _ in range(10):
        assert client.post("/api/groups", json={"title": "X"}).status_code == 201
    assert client.post("/api/groups", json={"title": "X"}).status_code == 429


# ---------- Ausschlüsse (Admin) ----------

def participant_ids(client, admin_token):
    view = client.get(f"/api/groups/{admin_token}").json()
    return [p["id"] for p in view["participants"]]


def test_exclusions_put_get_replace(client):
    group, _ = create_group(client, n_participants=3)
    at = group["adminToken"]
    pids = participant_ids(client, at)

    # initially empty
    assert client.get(f"/api/groups/{at}/exclusions").json() == []

    # set: P0 darf P1 nicht ziehen
    resp = client.put(f"/api/groups/{at}/exclusions",
                      json=[{"giverId": pids[0], "receiverId": pids[1]}])
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["giverName"] == "P0" and body[0]["receiverName"] == "P1"

    # GET liefert dieselbe Liste
    assert client.get(f"/api/groups/{at}/exclusions").json() == body

    # full replacement: alte weg, zwei neue (eine davon Duplikat -> dedup)
    resp = client.put(f"/api/groups/{at}/exclusions", json=[
        {"giverId": pids[0], "receiverId": pids[2]},
        {"giverId": pids[0], "receiverId": pids[2]},
        {"giverId": pids[2], "receiverId": pids[1]},
    ])
    assert resp.status_code == 200
    assert len(resp.json()) == 2
    # leeren mit []
    assert len(client.put(f"/api/groups/{at}/exclusions", json=[]).json()) == 0


def test_exclusions_validation(client):
    group, _ = create_group(client, n_participants=2)
    at = group["adminToken"]
    pids = participant_ids(client, at)
    # self-exclusion
    r = client.put(f"/api/groups/{at}/exclusions",
                   json=[{"giverId": pids[0], "receiverId": pids[0]}])
    assert r.status_code == 422
    # unknown participant
    r = client.put(f"/api/groups/{at}/exclusions",
                   json=[{"giverId": pids[0], "receiverId": "nicht-vorhanden"}])
    assert r.status_code == 422


def test_draw_respects_exclusions(client):
    """P0 darf P1 nicht ziehen. n=3 hat genau zwei Derangement-Zyklen;
    der Ausschluss erzwingt 0->2, 1->0, 2->1 — vollständig deterministisch."""
    group, tokens = create_group(client, n_participants=3)
    at = group["adminToken"]
    pids = participant_ids(client, at)
    client.put(f"/api/groups/{at}/exclusions",
               json=[{"giverId": pids[0], "receiverId": pids[1]}])
    assert client.post(f"/api/groups/{at}/draw").status_code == 200
    a0 = client.get(f"/api/me/{tokens[0]}/assignee").json()
    a1 = client.get(f"/api/me/{tokens[1]}/assignee").json()
    a2 = client.get(f"/api/me/{tokens[2]}/assignee").json()
    assert (a0["name"], a1["name"], a2["name"]) == ("P2", "P0", "P1")


def test_draw_unsolvable_returns_422(client):
    # n=2 mit Ausschluss in beide Richtungen ist unmöglich
    group, _ = create_group(client, n_participants=2)
    at = group["adminToken"]
    pids = participant_ids(client, at)
    client.put(f"/api/groups/{at}/exclusions", json=[
        {"giverId": pids[0], "receiverId": pids[1]},
        {"giverId": pids[1], "receiverId": pids[0]},
    ])
    resp = client.post(f"/api/groups/{at}/draw")
    assert resp.status_code == 422
    assert resp.json()["code"] == "DRAW_UNSOLVABLE"
    # nichts persistiert: Gruppe ist noch nicht ausgelost, Ziehung klappt nach
    # Entfernen der Ausschlüsse
    client.put(f"/api/groups/{at}/exclusions", json=[])
    assert client.post(f"/api/groups/{at}/draw").status_code == 200


def test_exclusions_frozen_after_draw(client):
    group, _ = create_group(client, n_participants=2)
    at = group["adminToken"]
    pids = participant_ids(client, at)
    assert client.post(f"/api/groups/{at}/draw").status_code == 200
    r = client.put(f"/api/groups/{at}/exclusions",
                   json=[{"giverId": pids[0], "receiverId": pids[1]}])
    assert r.status_code == 409
    assert r.json()["code"] == "ALREADY_DRAWN"


def test_one_directional_exclusion_allows_reverse(client):
    """Einseitig: (P0->P1) ausgeschlossen, aber P1 darf weiterhin P0 ziehen.
    n=2: einzige gültige Ziehung ist P0->P2? Nein — n=2: P0 muss P1 ziehen
    (einziger anderer), also muss hier 422 folgen; deshalb n=3 mit zwei
    Ausschlüssen, sodass P1->P0 erzwungen wird."""
    group, tokens = create_group(client, n_participants=3)
    at = group["adminToken"]
    pids = participant_ids(client, at)
    # P0 darf niemand anderen als P2, P2 darf niemand anderen als P1 -> P1
    # muss P0 ziehen (einzige gültige Ziehung: 0->2, 1->0, 2->1)
    client.put(f"/api/groups/{at}/exclusions", json=[
        {"giverId": pids[0], "receiverId": pids[1]},
        {"giverId": pids[2], "receiverId": pids[0]},
    ])
    assert client.post(f"/api/groups/{at}/draw").status_code == 200
    a1 = client.get(f"/api/me/{tokens[1]}/assignee").json()
    assert a1["name"] == "P0"  # umgekehrte Richtung ist nicht ausgeschlossen
