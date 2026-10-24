import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    db_path: str
    base_url: str  # z.B. "https://wichtel.example.com" (ohne trailing slash)


def settings_from_env() -> Settings:
    return Settings(
        db_path=os.environ.get("WICHTEL_DB_PATH", "data/wichtel.db"),
        base_url=os.environ.get("WICHTEL_BASE_URL", "").rstrip("/"),
    )
