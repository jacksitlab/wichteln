from .routes import groups, join, me


def create_app(settings, store_factory):
    from fastapi import FastAPI

    from .errors import install_handlers
    from .static import mount_spa
    from .util import iso_today_or_none

    app = FastAPI(
        title="Wichtel API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    install_handlers(app)
    app.state.settings = settings
    app.state.store_factory = store_factory

    groups.register(app)
    join.register(app)
    me.register(app)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    mount_spa(app, settings)
    return app


def create_app_from_env():
    """Einstiegspunkt für uvicorn (app.main:create_app_from_env)."""
    from .config import settings_from_env
    from .db import init_db, open_conn
    from .store import Store

    settings = settings_from_env()
    init_db(settings.db_path)

    def store_factory(request):
        return Store(open_conn(settings.db_path))

    return create_app(settings, store_factory)


__all__ = ["create_app", "create_app_from_env", "iso_today_or_none"]
