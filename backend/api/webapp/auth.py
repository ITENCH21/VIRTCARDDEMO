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


def parse_user_agent(ua: str) -> str:
    """Extract readable device name from user-agent string."""
    if not ua:
        return "Unknown"
    ua_lower = ua.lower()
    # Device
    device = "Desktop"
    if "iphone" in ua_lower:
        device = "iPhone"
    elif "ipad" in ua_lower:
        device = "iPad"
    elif "android" in ua_lower:
        device = "Android"
    elif "macintosh" in ua_lower:
        device = "Mac"
    elif "windows" in ua_lower:
        device = "Windows"
    elif "linux" in ua_lower:
        device = "Linux"
    # Browser
    browser = ""
    if "edg/" in ua_lower:
        browser = "Edge"
    elif "chrome" in ua_lower and "safari" in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower:
        browser = "Safari"
    elif "telegram" in ua_lower or "tg" in ua_lower:
        browser = "Telegram"
    return f"{device} / {browser}" if browser else device


async def store_refresh_token(
    jti: str, client_id: str, device: str = "", ip: str = ""
) -> None:
    import json, time
    r = await get_redis()
    ttl = JWT_REFRESH_EXPIRE_DAYS * 86400
    session_data = json.dumps({
        "client_id": client_id,
        "device": device or "Unknown",
        "ip": ip or "0.0.0.0",
        "created_at": int(time.time()),
        "last_active": int(time.time()),
    })
    await r.setex(f"refresh:{jti}", ttl, session_data)
    # Track all sessions for this client
    await r.sadd(f"sessions:{client_id}", jti)
    await r.expire(f"sessions:{client_id}", ttl)


async def verify_refresh_token(jti: str) -> Optional[str]:
    """Returns client_id if refresh token is valid, None otherwise."""
    import json
    r = await get_redis()
    raw = await r.get(f"refresh:{jti}")
    if not raw:
        return None
    # Backward compatible: old tokens store plain client_id
    try:
        data = json.loads(raw)
        return data.get("client_id")
    except (json.JSONDecodeError, TypeError):
        return raw  # plain client_id string


async def update_session_activity(jti: str) -> None:
    """Update last_active timestamp for a session."""
    import json, time
    r = await get_redis()
    raw = await r.get(f"refresh:{jti}")
    if not raw:
        return
    try:
        data = json.loads(raw)
        data["last_active"] = int(time.time())
        ttl = await r.ttl(f"refresh:{jti}")
        if ttl > 0:
            await r.setex(f"refresh:{jti}", ttl, json.dumps(data))
    except (json.JSONDecodeError, TypeError):
        pass


async def revoke_refresh_token(jti: str) -> None:
    import json
    r = await get_redis()
    # Get client_id to clean sessions set
    raw = await r.get(f"refresh:{jti}")
    client_id = None
    if raw:
        try:
            data = json.loads(raw)
            client_id = data.get("client_id")
        except (json.JSONDecodeError, TypeError):
            client_id = raw
    await r.delete(f"refresh:{jti}")
    if client_id:
        await r.srem(f"sessions:{client_id}", jti)


async def get_client_sessions(client_id: str) -> list:
    """Get all active sessions for a client."""
    import json
    r = await get_redis()
    jtis = await r.smembers(f"sessions:{client_id}")
    sessions = []
    for jti in jtis:
        raw = await r.get(f"refresh:{jti}")
        if not raw:
            # Expired token, clean up
            await r.srem(f"sessions:{client_id}", jti)
            continue
        try:
            data = json.loads(raw)
            data["jti"] = jti
            sessions.append(data)
        except (json.JSONDecodeError, TypeError):
            pass
    # Sort by last_active descending
    sessions.sort(key=lambda s: s.get("last_active", 0), reverse=True)
    return sessions


async def revoke_all_sessions(client_id: str, except_jti: str = "") -> int:
    """Revoke all sessions for a client, optionally keeping one."""
    r = await get_redis()
    jtis = await r.smembers(f"sessions:{client_id}")
    count = 0
    for jti in jtis:
        if jti == except_jti:
            continue
        await r.delete(f"refresh:{jti}")
        await r.srem(f"sessions:{client_id}", jti)
        count += 1
    return count
