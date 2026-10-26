"""Central store layer: all SQL access of the backend.

The join token is deliberately stored in clear text (the join link must be
reconstructable for the admin at any time — see openapi.yaml,
AdminGroupView.joinUrl). Admin and personal tokens are stored as SHA-256
hashes only.
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

    # ---------- groups ----------

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
        return row  # the token value itself is unused; the caller handles the uniform 404

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

    def delete_group(self, gid: str) -> None:
        """Deletes the group; participants/wishes/assignments/exclusions
        cascade via ON DELETE CASCADE."""
        self.conn.execute("DELETE FROM groups WHERE id = ?", (gid,))

    # ---------- participants ----------

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

    def participant_name_taken(self, gid: str, name: str) -> bool:
        """Case-insensitive duplicate check (surrounding whitespace trimmed)."""
        row = self.conn.execute(
            "SELECT 1 FROM participants WHERE group_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))",
            (gid, name),
        ).fetchone()
        return row is not None

    def delete_participant(self, pid: str) -> None:
        self.conn.execute("DELETE FROM participants WHERE id = ?", (pid,))

    def rotate_personal_token(self, pid: str, new_token_h: str) -> None:
        self.conn.execute(
            "UPDATE participants SET personal_token_h = ? WHERE id = ?",
            (new_token_h, pid),
        )

    # ---------- wishes ----------

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
        """Compact positions to 0..n-1 (after update/delete)."""
        rows = self.wishes_of(pid)
        for new_pos, row in enumerate(rows):
            if row["position"] != new_pos:
                self.conn.execute(
                    "UPDATE wishes SET position = ? WHERE id = ?", (new_pos, row["id"])
                )

    # ---------- drawing ----------

    def exclusions_of_group(self, gid: str) -> list[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM exclusions WHERE group_id = ? ORDER BY rowid", (gid,)
        ).fetchall()

    def replace_exclusions(self, gid: str, pairs: list[tuple[str, str]]) -> None:
        """Full replacement; deduplicated by the PRIMARY KEY."""
        self.conn.execute("DELETE FROM exclusions WHERE group_id = ?", (gid,))
        self.conn.executemany(
            "INSERT OR IGNORE INTO exclusions (group_id, giver_id, receiver_id) VALUES (?,?,?)",
            [(gid, g, r) for g, r in pairs],
        )

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
