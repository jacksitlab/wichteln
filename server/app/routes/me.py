from fastapi import APIRouter

from ..errors import ApiError
from ..store import Store
from ..tokens import token_hash
from ..util import utcnow_iso

TOKEN_404 = "Invalid or unknown link."


def register(app):
    import sqlite3

    from fastapi import Request
    from pydantic import BaseModel, Field

    from ..draw import derangement
    from ..tokens import new_token

    router = APIRouter()

    class WishIn(BaseModel):
        text: str = Field(min_length=1, max_length=500)
        position: int | None = Field(default=None, ge=0)

    def store(req: Request) -> Store:
        return app.state.store_factory(req)

    def require_participant(req: Request, personal_token: str) -> sqlite3.Row:
        s = store(req)
        p = s.participant_by_token(token_hash(personal_token))
        if p is None:
            raise ApiError(404, "NOT_FOUND", TOKEN_404)
        return p

    def require_not_drawn(req: Request, participant: sqlite3.Row) -> None:
        """Wishes are frozen after the drawing — the assigned Secret Santa already sees them."""
        s = store(req)
        group = s.group_by_id(participant["group_id"])
        if group["drawn_at"] is not None:
            raise ApiError(409, "ALREADY_DRAWN",
                           "The drawing has already taken place — wishes can no longer be changed.")

    def require_group(req: Request, admin_token: str) -> sqlite3.Row:
        s = store(req)
        from ..tokens import token_hash
        g = s.group_by_admin(admin_token, token_hash(admin_token))
        if g is None:
            raise ApiError(404, "NOT_FOUND", TOKEN_404)
        return g

    def base_url(req: Request) -> str:
        configured = app.state.settings.base_url
        return configured if configured else str(req.base_url).rstrip("/")

    def wish_out(row) -> dict:
        return {"id": row["id"], "position": row["position"], "text": row["text"]}

    # ---------- /api/me/... ----------

    @router.get("/api/me/{personal_token}")
    def get_me(personal_token: str, request: Request):
        p = require_participant(request, personal_token)
        s = store(request)
        group = s.group_by_id(p["group_id"])
        return {
            "groupTitle": group["title"],
            "groupDescription": group["description"],
            "drawDate": group["draw_date"],
            "drawn": group["drawn_at"] is not None,
            "drawnAt": group["drawn_at"],
            "participant": {
                "id": p["id"], "name": p["name"], "joinedAt": p["joined_at"],
            },
            "wishes": [wish_out(w) for w in s.wishes_of(p["id"])],
        }

    @router.delete("/api/me/{personal_token}", status_code=204)
    def leave(personal_token: str, request: Request):
        p = require_participant(request, personal_token)
        s = store(request)
        group = s.group_by_id(p["group_id"])
        if group["drawn_at"] is not None:
            raise ApiError(409, "ALREADY_DRAWN",
                           "The drawing has already taken place. Leaving is no longer possible.")
        s.delete_participant(p["id"])

    @router.post("/api/me/{personal_token}/wishes", status_code=201)
    def add_wish(personal_token: str, body: WishIn, request: Request):
        p = require_participant(request, personal_token)
        require_not_drawn(request, p)
        s = store(request)
        position = body.position if body.position is not None else s.next_wish_position(p["id"])
        row = s.add_wish(p["id"], body.text, position)
        return wish_out(row)

    @router.put("/api/me/{personal_token}/wishes/{wish_id}")
    def update_wish(personal_token: str, wish_id: str, body: WishIn, request: Request):
        p = require_participant(request, personal_token)
        require_not_drawn(request, p)
        s = store(request)
        wish = s.wish_by_id(wish_id)
        if wish is None or wish["participant_id"] != p["id"]:
            raise ApiError(404, "NOT_FOUND", "Wish not found.")
        position = body.position if body.position is not None else wish["position"]
        s.update_wish(wish_id, body.text, position)
        s.compact_positions(p["id"])
        return wish_out(s.wish_by_id(wish_id))

    @router.delete("/api/me/{personal_token}/wishes/{wish_id}", status_code=204)
    def delete_wish(personal_token: str, wish_id: str, request: Request):
        p = require_participant(request, personal_token)
        require_not_drawn(request, p)
        s = store(request)
        wish = s.wish_by_id(wish_id)
        if wish is None or wish["participant_id"] != p["id"]:
            raise ApiError(404, "NOT_FOUND", "Wish not found.")
        s.delete_wish(wish_id)
        s.compact_positions(p["id"])

    @router.get("/api/me/{personal_token}/assignee")
    def get_assignee(personal_token: str, request: Request):
        p = require_participant(request, personal_token)
        s = store(request)
        group = s.group_by_id(p["group_id"])
        if group["drawn_at"] is None:
            raise ApiError(409, "NOT_DRAWN",
                           "The drawing has not taken place yet.")
        assignment = s.assignment_for_giver(group["id"], p["id"])
        receiver = s.participant_by_id(assignment["receiver_id"])
        return {
            "name": receiver["name"],
            "wishes": [wish_out(w) for w in s.wishes_of(receiver["id"])],
        }

    # ---------- admin actions (kept in me.py; share store/helpers) ----------

    @router.delete(
        "/api/groups/{admin_token}/participants/{participant_id}", status_code=204
    )
    def remove_participant(admin_token: str, participant_id: str, request: Request):
        group = require_group(request, admin_token)
        s = store(request)
        p = s.participant_by_id(participant_id)
        if p is None or p["group_id"] != group["id"]:
            raise ApiError(404, "NOT_FOUND", "Participant not found.")
        if group["drawn_at"] is not None:
            raise ApiError(409, "ALREADY_DRAWN",
                           "The drawing has already taken place. Removing is no longer possible.")
        s.delete_participant(participant_id)

    @router.post("/api/groups/{admin_token}/participants/{participant_id}/link")
    def regenerate_link(admin_token: str, participant_id: str, request: Request):
        group = require_group(request, admin_token)
        s = store(request)
        p = s.participant_by_id(participant_id)
        if p is None or p["group_id"] != group["id"]:
            raise ApiError(404, "NOT_FOUND", "Participant not found.")
        personal_token = new_token()
        s.rotate_personal_token(participant_id, token_hash(personal_token))
        return {
            "participantId": participant_id,
            "personalToken": personal_token,
            "personalUrl": f"{base_url(request)}/p/{personal_token}",
        }

    @router.post("/api/groups/{admin_token}/draw")
    def draw(admin_token: str, request: Request):
        group = require_group(request, admin_token)
        s = store(request)
        if group["drawn_at"] is not None:
            raise ApiError(409, "ALREADY_DRAWN",
                           "The drawing has already taken place.")
        participants = s.participants_of_group(group["id"])
        if len(participants) < 2:
            raise ApiError(422, "TOO_FEW_PARTICIPANTS",
                           "At least 2 participants are required.")
        conn = s.conn
        conn.execute("BEGIN IMMEDIATE")
        try:
            perm = derangement(len(participants))
            pairs = [
                (participants[i]["id"], participants[perm[i]]["id"])
                for i in range(len(participants))
            ]
            s.insert_assignments(group["id"], pairs)
            drawn_at = utcnow_iso()
            s.mark_drawn(group["id"], drawn_at)
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise
        return {"drawnAt": drawn_at, "assignmentCount": len(pairs)}

    app.include_router(router)
