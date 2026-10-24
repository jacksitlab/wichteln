"""Smoke-Test: echter Uvicorn-Prozess, kompletter Flow über HTTP."""
import json
import subprocess
import sys
import time
import urllib.request


def req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main():
    db_file = f"/opt/data/cache/scratch/wichtel-smoke-{int(time.time())}.db"
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:create_app_from_env",
         "--host", "127.0.0.1", "--port", "8899"],
        cwd="/opt/data/wichtel/server",
        env={**__import__("os").environ, "WICHTEL_DB_PATH": db_file},
    )
    try:
        for _ in range(50):
            try:
                status, _ = req("GET", "http://127.0.0.1:8899/api/health")
                if status == 200:
                    break
            except Exception:
                time.sleep(0.2)
        else:
            raise SystemExit("Server nicht gestartet")

        # Gruppe anlegen
        s, group = req("POST", "http://127.0.0.1:8899/api/groups",
                       {"title": "Weihnachten 2026", "drawDate": "2026-12-20"})
        assert s == 201, group
        at, jt = group["adminToken"], group["joinToken"]

        # 3 Teilnehmer
        tokens = []
        for name in ("Anna", "Ben", "Clara"):
            s, join = req("POST", f"http://127.0.0.1:8899/api/join/{jt}", {"name": name})
            assert s == 201, join
            tokens.append(join["personalToken"])

        # Wünsche
        s, _ = req("POST", f"http://127.0.0.1:8899/api/me/{tokens[0]}/wishes",
                   {"text": "Grillbuch"})
        assert s == 201

        # Vor der Ziehung: assignee 409
        s, body = req("GET", f"http://127.0.0.1:8899/api/me/{tokens[1]}/assignee")
        assert s == 409, body

        # Ziehung
        s, draw = req("POST", f"http://127.0.0.1:8899/api/groups/{at}/draw")
        assert s == 200, draw
        assert draw["assignmentCount"] == 3

        # Nach Ziehung: jeder sieht genau einen Assignee
        for t in tokens:
            s, a = req("GET", f"http://127.0.0.1:8899/api/me/{t}/assignee")
            assert s == 200 and a["name"], a

        # Zweitaufruf 409
        s, _ = req("POST", f"http://127.0.0.1:8899/api/groups/{at}/draw")
        assert s == 409

        print("SMOKE OK: kompletter Flow über echten Uvicorn-Server funktioniert")
    finally:
        proc.terminate()
        proc.wait()


if __name__ == "__main__":
    main()
