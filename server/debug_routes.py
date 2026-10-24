import os
import sys

sys.path.insert(0, "/opt/data/wichtel/server")
os.environ["WICHTEL_WEB_DIST"] = "/opt/data/wichtel/web/dist"

from app.config import Settings
from app.db import init_db, open_conn
from app.main import create_app
from app.store import Store

settings = Settings(db_path="/opt/data/cache/scratch/spa-unit.db", base_url="")

def store_factory(request):
    return Store(open_conn(settings.db_path))

app = create_app(settings, store_factory)
for r in app.routes:
    print(type(r).__name__, getattr(r, "path", getattr(r, "path_format", "?")))
