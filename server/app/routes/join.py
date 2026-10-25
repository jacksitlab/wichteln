from fastapi import APIRouter

from ..errors import ApiError
from ..ratelimit import join_limiter
from ..store import Store
from ..tokens import new_token, token_hash

TOKEN_404 = "Invalid or unknown link."


def register(app):
    from fastapi import Request
    from pydantic import BaseModel, Field

    router = APIRouter()

    class JoinIn(BaseModel):
        name: str = Field(min_length=1, max_length=60)

    @router.post("/api/join/{join_token}", status_code=201)
    def join_group(join_token: str, body: JoinIn, request: Request):
        client = request.client.host if request.client else "unknown"
        if not join_limiter.allow(client):
            raise ApiError(429, "RATE_LIMITED",
                           "Too many requests. Please try again later.")
        s: Store = app.state.store_factory(request)
        group = s.group_by_join(join_token)
        if group is None:
            raise ApiError(404, "NOT_FOUND", TOKEN_404)
        if group["drawn_at"] is not None:
            raise ApiError(409, "ALREADY_DRAWN",
                           "The drawing has already taken place. Joining is no longer possible.")
        personal_token = new_token()
        participant = s.add_participant(group["id"], body.name, token_hash(personal_token))
        base = app.state.settings.base_url or str(request.base_url).rstrip("/")
        return {
            "participant": {
                "id": participant["id"],
                "name": participant["name"],
                "joinedAt": participant["joined_at"],
            },
            "personalToken": personal_token,
            "personalUrl": f"{base}/p/{personal_token}",
        }

    app.include_router(router)
