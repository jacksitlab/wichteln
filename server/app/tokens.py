import hashlib
import re
import secrets

# 32 zufällige Bytes, base64url-kodiert -> immer 43 Zeichen URL-sicher
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    """Tokens liegen in der DB nur als SHA-256-Hash (Admin- und Personal-Token)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
