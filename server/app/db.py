import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS groups (
  id             TEXT PRIMARY KEY,
  admin_token_h  TEXT NOT NULL,
  join_token     TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  draw_date      TEXT,
  drawn_at       TEXT,
  created_at     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS participants (
  id               TEXT PRIMARY KEY,
  group_id         TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  personal_token_h  TEXT NOT NULL UNIQUE,
  joined_at        TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wishes (
  id              TEXT PRIMARY KEY,
  participant_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  text            TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments (
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  giver_id    TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, giver_id)
);
CREATE TABLE IF NOT EXISTS exclusions (
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  giver_id    TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, giver_id, receiver_id)
);
"""


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db(db_path: str) -> None:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = _connect(db_path)
    try:
        conn.executescript(SCHEMA)
    finally:
        conn.close()


def open_conn(db_path: str) -> sqlite3.Connection:
    """Autocommit-Verbindung pro Request; Transaktionen nur explizit (draw)."""
    conn = _connect(db_path)
    conn.isolation_level = None
    return conn
