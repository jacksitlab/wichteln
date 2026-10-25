"""Serves the built React frontend (web/dist) with SPA fallback.

All paths except /api/* and /api/docs are mapped to the SPA: existing files
directly, everything else to index.html (the React router handles
/g/..., /p/..., /join/...).
"""
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException


class SPAStaticFiles(StaticFiles):
    def __init__(self, directory: str):
        super().__init__(directory=directory, html=True)

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException:
            # SPA fallback: unknown paths -> index.html
            return await super().get_response("index.html", scope)


def mount_spa(app: FastAPI, settings) -> None:
    dist = os.environ.get("WICHTEL_WEB_DIST", "")
    if not dist:
        # Default: is the frontend next to the server directory? (repo layout)
        candidate = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web", "dist")
        dist = candidate if os.path.isdir(candidate) else ""
    if not dist or not os.path.isdir(dist):
        return  # without frontend: API-only operation (e.g. backend testing)

    app.mount("/", SPAStaticFiles(directory=dist), name="spa")
