"""Serviert das gebaute React-Frontend (web/dist) mit SPA-Fallback.

Alle Pfade außer /api/* und /api/docs werden auf die SPA gelegt:
existierende Dateien direkt, alles andere auf index.html (React-Router
übernimmt /g/..., /p/..., /join/...).
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
            # SPA-Fallback: unbekannte Pfade -> index.html
            return await super().get_response("index.html", scope)


def mount_spa(app: FastAPI, settings) -> None:
    dist = os.environ.get("WICHTEL_WEB_DIST", "")
    if not dist:
        # Standard: liegt das Frontend beim server-Verzeichnis? (Repo-Struktur)
        candidate = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web", "dist")
        dist = candidate if os.path.isdir(candidate) else ""
    if not dist or not os.path.isdir(dist):
        return  # ohne Frontend nur API-Betrieb (z.B. reines Backend-Testing)

    app.mount("/", SPAStaticFiles(directory=dist), name="spa")
