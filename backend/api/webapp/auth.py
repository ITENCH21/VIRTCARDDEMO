"""
Telegram authentication + JWT token management.

Supports two auth flows:
1. Telegram Mini App — HMAC-SHA256 validation of initData
2. Telegram Login Widget — SHA256-based signature validation
"""

import hashlib
import hmac
import json
import os
import time
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import unquote, parse_qsl

import jwt
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
JWT_REFRESH_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            password=REDIS_PASSWORD or None,
            db=1,
            decode_responses=True,
        )
    return _redis


# ── Telegram Mini App validation ─────────────────────────


def validate_mini_app_init_data(init_data: str, max_age: int = 86400) -> Optional[dict]:
    """Validate Telegram Mini App initData via HMAC-SHA256.

    Returns parsed user dict or None if invalid.
    """
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    except Exception:
        return None

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    # Check auth_date freshness
    auth_date_str = parsed.get("auth_date", "")
    if auth_date_str:
        try:
            auth_date = int(auth_date_str)
            if time.time() - auth_date > max_age:
                logger.warning("initData expired: auth_date=%s", auth_date)
                return None
        except ValueError:
            return None

    # Build data-check-string (sorted key=value pairs)
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))

    # secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()

    # computed_hash = HMAC-SHA256(secret_key, data_check_string)
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        logger.warning("initData HMAC mismatch")
        return None

    # Parse user JSON
    user_json = parsed.get("user", "")
    if user_json:
        try:
            return json.loads(unquote(user_json))
        except (json.JSONDecodeError, TypeError):
            return None

    return None


# ── Telegram Login Widget validation ─────────────────────


def validate_login_widget_data(data: dict, max_age: int = 86400) -> Optional[int]:
    """Validate Telegram Login Widget data.

    Returns telegram_id or None if invalid.
    """
    data = dict(data)
    received_hash = data.pop("hash", None)
    if not received_hash:
        return None

    auth_date_str = data.get("auth_date", "")
    if auth_date_str:
        try:
            auth_date = int(auth_date_str)
            if time.time() - auth_date > max_age:
                return None
        except ValueError:
            return None

    # data-check-string
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))

    # secret_key = SHA256(BOT_TOKEN)
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()

    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    try:
        return int(data.get("id", 0))
    except (ValueError, TypeError):
        return None


# ── JWT management ───────────────────────────────────────


def create_access_token(client_id: str, telegram_id: int) -> str:
    payload = {
        "sub": str(client_id),
        "tg_id": telegram_id,
        "type": "access",
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=JWT_ACCESS_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(client_id: str, telegram_id: int) -> tuple[str, str]:
    """Returns (token, jti) where jti is stored in Redis."""
    jti = str(uuid.uuid4())
    payload = {
        "sub": str(client_id),
        "tg_id": telegram_id,
        "type": "refresh",
        "jti": jti,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, jti


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        logger.debug("Token expired")
        return None
    except jwt.InvalidTokenError:
        logger.debug("Invalid token")
        return None


async def store_refresh_token(jti: str, client_id: str) -> None:
    r = await get_redis()
    ttl = JWT_REFRESH_EXPIRE_DAYS * 86400
    await r.setex(f"refresh:{jti}", ttl, client_id)


async def verify_refresh_token(jti: str) -> Optional[str]:
    """Returns client_id if refresh token is valid, None otherwise."""
    r = await get_redis()
    client_id = await r.get(f"refresh:{jti}")
    return client_id


async def revoke_refresh_token(jti: str) -> None:
    r = await get_redis()
    await r.delete(f"refresh:{jti}")
