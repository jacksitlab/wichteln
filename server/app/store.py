"""Zentrale Store-Schicht: alle SQL-Zugriffe des Backends.

Join-Token wird bewusst im Klartext gespeichert (Join-Link muss für den Admin
jederzeit rekonstruierbar sein — siehe openapi.yaml, AdminGroupView.joinUrl).
Admin- und Personal-Token liegen nur als SHA-256-Hash vor.
"""
import sqlite3
import uuid

from .util import utcnow_iso


def _uuid() -> str:
    return str(uuid.uuid4())


class NotFound:
    pass


class Store:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    # ---------- Gruppen ----------

    def create_group(self, title: str, description: str | None,
                     draw_date: str | None, admin_token_h: str,
                     join_token: str) -> str:
        gid = _uuid()
        self.conn.execute(
            "INSERT INTO groups (id, admin_token_h, join_token, title, description, draw_date, drawn_at, created_at)"
            " VALUES (?,?,?,?,?,?,NULL,?)",
            (gid, admin_token_h, join_token, title, description, draw_date, utcnow_iso()),
        )
        return gid

    def group_by_admin(self, admin_token: str, admin_token_h: str) -> sqlite3.Row | None:
        row = self.conn.execute(
            "SELECT * FROM groups WHERE admin_token_h = ?", (admin_token_h,)
        ).fetchone()
        return row  # Token-Wert selbst wird nicht benutzt; einheitliches 404 regelt der Caller

    def group_by_join(self, join_token: str) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM groups WHERE join_token = ?", (join_token,)
        ).fetchone()

    def group_by_id(self, gid: str) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM groups WHERE id = ?", (gid,)).fetchone()

    def update_group(self, gid: str, title: str, description: str | None,
                     draw_date: str | None) -> None:
        self.conn.execute(
            "UPDATE groups SET title = ?, description = ?, draw_date = ? WHERE id = ?",
            (title, description, draw_date, gid),
        )

    def mark_drawn(self, gid: str, drawn_at: str) -> None:
        self.conn.execute(
            "UPDATE groups SET drawn_at = ? WHERE id = ?", (drawn_at, gid)
        )

    # ---------- Teilnehmer ----------

    def add_participant(self, gid: str, name: str, personal_token_h: str) -> sqlite3.Row:
        pid = _uuid()
        self.conn.execute(
            "INSERT INTO participants (id, group_id, name, personal_token_h, joined_at)"
            " VALUES (?,?,?,?,?)",
            (pid, gid, name, personal_token_h, utcnow_iso()),
        )
        return self.conn.execute(
            "SELECT * FROM participants WHERE id = ?", (pid,)
        ).fetchone()

    def participant_by_id(self, pid: str) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM participants WHERE id = ?", (pid,)
        ).fetchone()

    def participant_by_token(self, personal_token_h: str) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM participants WHERE personal_token_h = ?",
            (personal_token_h,),
        ).fetchone()

    def participants_of_group(self, gid: str) -> list[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM participants WHERE group_id = ? ORDER BY joined_at, id",
            (gid,),
        ).fetchall()

    def delete_participant(self, pid: str) -> None:
        self.conn.execute("DELETE FROM participants WHERE id = ?", (pid,))

    def rotate_personal_token(self, pid: str, new_token_h: str) -> None:
        self.conn.execute(
            "UPDATE participants SET personal_token_h = ? WHERE id = ?",
            (new_token_h, pid),
        )

    # ---------- Wünsche ----------

    def add_wish(self, pid: str, text: str, position: int) -> sqlite3.Row:
        wid = _uuid()
        self.conn.execute(
            "INSERT INTO wishes (id, participant_id, position, text) VALUES (?,?,?,?)",
            (wid, pid, position, text),
        )
        return self.conn.execute("SELECT * FROM wishes WHERE id = ?", (wid,)).fetchone()

    def wishes_of(self, pid: str) -> list[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM wishes WHERE participant_id = ? ORDER BY position, id",
            (pid,),
        ).fetchall()

    def wish_by_id(self, wid: str) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM wishes WHERE id = ?", (wid,)).fetchone()

    def update_wish(self, wid: str, text: str, position: int) -> sqlite3.Row:
        self.conn.execute(
            "UPDATE wishes SET text = ?, position = ? WHERE id = ?",
            (text, position, wid),
        )
        return self.conn.execute("SELECT * FROM wishes WHERE id = ?", (wid,)).fetchone()

    def delete_wish(self, wid: str) -> None:
        self.conn.execute("DELETE FROM wishes WHERE id = ?", (wid,))

    def next_wish_position(self, pid: str) -> int:
        row = self.conn.execute(
            "SELECT COALESCE(MAX(position) + 1, 0) FROM wishes WHERE participant_id = ?",
            (pid,),
        ).fetchone()
        return row[0]

    def compact_positions(self, pid: str) -> None:
        """Positionen auf 0..n-1 verdichten (nach Update/Löschen)."""
        rows = self.wishes_of(pid)
        for new_pos, row in enumerate(rows):
            if row["position"] != new_pos:
                self.conn.execute(
                    "UPDATE wishes SET position = ? WHERE id = ?", (new_pos, row["id"])
                )

    # ---------- Ziehung ----------

    def assignments_of_group(self, gid: str) -> list[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM assignments WHERE group_id = ?", (gid,)
        ).fetchall()

    def assignment_for_giver(self, gid: str, giver_id: str) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM assignments WHERE group_id = ? AND giver_id = ?",
            (gid, giver_id),
        ).fetchone()

    def insert_assignments(self, gid: str, pairs: list[tuple[str, str]]) -> None:
        self.conn.executemany(
            "INSERT INTO assignments (group_id, giver_id, receiver_id) VALUES (?,?,?)",
            [(gid, g, r) for g, r in pairs],
        )
