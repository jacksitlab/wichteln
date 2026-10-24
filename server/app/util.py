from datetime import date, datetime, timezone


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def iso_today_or_none(value: date | None) -> str | None:
    return value.isoformat() if value else None
