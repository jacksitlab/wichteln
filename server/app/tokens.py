import hashlib
import re
import secrets

# 32 random bytes, base64url-encoded -> always 43 URL-safe characters
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    """Tokens are stored in the DB as SHA-256 hashes only (admin and personal tokens)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
