import sqlite3

from fastapi import APIRouter

from ..errors import ApiError
from ..ratelimit import create_limiter
from ..store import Store
from ..util import iso_today_or_none

TOKEN_404 = "Invalid or unknown link."


def register(app):
    from datetime import date, datetime

    from fastapi import Request
    from pydantic import BaseModel, ConfigDict, Field
    from pydantic.alias_generators import to_camel

    from ..tokens import new_token, token_hash

    class CreateGroupIn(BaseModel):
        model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
        title: str = Field(min_length=1, max_length=100)
        description: str | None = Field(default=None, max_length=2000)
        draw_date: date | None = None

    class UpdateGroupIn(BaseModel):
        model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
        title: str | None = Field(default=None, min_length=1, max_length=100)
        description: str | None = Field(default=None, max_length=2000)
        draw_date: date | None = None

    router = APIRouter()

    def store(req: Request) -> Store:
        return app.state.store_factory(req)

    def require_group(req: Request, admin_token: str) -> sqlite3.Row:
        s = store(req)
        row = s.group_by_admin(admin_token, token_hash(admin_token))
        if row is None:
            raise ApiError(404, "NOT_FOUND", TOKEN_404)
        return row

    def base_url(req: Request) -> str:
        configured = app.state.settings.base_url
        if configured:
            return configured
        return str(req.base_url).rstrip("/")

    @router.post("/api/groups", status_code=201)
    def create_group(body: CreateGroupIn, request: Request):
        client = request.client.host if request.client else "unknown"
        if not create_limiter.allow(client):
            raise ApiError(429, "RATE_LIMITED",
                           "Too many requests. Please try again later.")
        s = store(request)
        admin_token = new_token()
        join_token = new_token()
        gid = s.create_group(
            body.title, body.description,
            iso_today_or_none(body.draw_date),
            token_hash(admin_token), join_token,
        )
        group = s.group_by_id(gid)
        b = base_url(request)
        return {
            "group": _admin_view(group, [], join_token, b),
            "adminToken": admin_token,
            "adminUrl": f"{b}/g/{admin_token}",
            "joinToken": join_token,
            "joinUrl": f"{b}/join/{join_token}",
        }

    @router.get("/api/groups/{admin_token}")
    def get_group(admin_token: str, request: Request):
        group = require_group(request, admin_token)
        s = store(request)
        participants = s.participants_of_group(group["id"])
        return _admin_view(group, participants, group["join_token"], base_url(request))

    @router.patch("/api/groups/{admin_token}")
    def update_group(admin_token: str, body: UpdateGroupIn, request: Request):
        group = require_group(request, admin_token)
        s = store(request)
        title = body.title if body.title is not None else group["title"]
        description = body.description if body.description is not None else group["description"]
        draw_date = (iso_today_or_none(body.draw_date) if body.draw_date is not None
                     else group["draw_date"])
        s.update_group(group["id"], title, description, draw_date)
        group = s.group_by_id(group["id"])
        participants = s.participants_of_group(group["id"])
        return _admin_view(group, participants, group["join_token"], base_url(request))

    def _admin_view(group, participants, join_token, base):
        return {
            "id": group["id"],
            "title": group["title"],
            "description": group["description"],
            "drawDate": group["draw_date"],
            "drawnAt": group["drawn_at"],
            "joinUrl": f"{base}/join/{join_token}",
            "participants": [
                {"id": p["id"], "name": p["name"], "joinedAt": p["joined_at"]}
                for p in participants
            ],
        }

    app.include_router(router)
