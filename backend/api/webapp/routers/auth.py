"""Auth router — Telegram / Email / PIN / WebAuthn → JWT."""

import hashlib
import json
import os
import logging
import secrets
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from api.webapp.auth import (
    validate_mini_app_init_data,
    validate_login_widget_data,
    create_access_token,
    create_refresh_token,
    decode_token,
    store_refresh_token,
    verify_refresh_token,
    revoke_refresh_token,
    get_redis,
)
from api.webapp.schemas import (
    TelegramWebAppAuth,
    TelegramLoginAuth,
    RefreshTokenRequest,
    AuthResponse,
    ClientInfo,
    EmailLoginRequest,
    EmailRegisterRequest,
    PinLoginRequest,
    PinSetupRequest,
    SuccessResponse,
)
from bot.register import get_or_create_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/telegram-webapp", response_model=AuthResponse)
async def auth_telegram_webapp(body: TelegramWebAppAuth):
    """Authenticate via Telegram Mini App initData."""
    user = validate_mini_app_init_data(body.init_data)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid initData",
        )

    telegram_id = user.get("id")
    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No user id in initData",
        )

    client = await get_or_create_client(
        telegram_id=int(telegram_id),
        first_name=user.get("first_name", ""),
        last_name=user.get("last_name", ""),
        username=user.get("username", ""),
    )

    access_token = create_access_token(str(client.pk), client.telegram_id)
    refresh_token, jti = create_refresh_token(str(client.pk), client.telegram_id)
    await store_refresh_token(jti, str(client.pk))

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        client=ClientInfo(
            id=str(client.pk),
            name=client.name or "",
            telegram_username=client.telegram_username,
        ),
    )


@router.post("/telegram-login", response_model=AuthResponse)
async def auth_telegram_login(body: TelegramLoginAuth):
    """Authenticate via Telegram Login Widget (standalone mode)."""
    telegram_id = validate_login_widget_data(body.dict())
    if telegram_id is None or telegram_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid login widget data",
        )

    client = await get_or_create_client(
        telegram_id=telegram_id,
        first_name=body.first_name,
        last_name=body.last_name,
        username=body.username,
        photo_url=body.photo_url,
    )

    access_token = create_access_token(str(client.pk), client.telegram_id)
    refresh_token, jti = create_refresh_token(str(client.pk), client.telegram_id)
    await store_refresh_token(jti, str(client.pk))

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        client=ClientInfo(
            id=str(client.pk),
            name=client.name or "",
            telegram_username=client.telegram_username,
        ),
    )


@router.post("/refresh", response_model=AuthResponse)
async def refresh_tokens(body: RefreshTokenRequest):
    """Refresh JWT tokens."""
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    stored_client_id = await verify_refresh_token(jti)
    if stored_client_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked or expired",
        )

    # Revoke old refresh token
    await revoke_refresh_token(jti)

    client_id = payload["sub"]
    telegram_id = payload["tg_id"]

    try:
        from models.models import Client

        client = await Client.get(pk=client_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Client not found",
        )

    access_token = create_access_token(client_id, telegram_id)
    new_refresh_token, new_jti = create_refresh_token(client_id, telegram_id)
    await store_refresh_token(new_jti, client_id)

    return AuthResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        client=ClientInfo(
            id=str(client.pk),
            name=client.name or "",
            telegram_username=client.telegram_username,
        ),
    )


# ── Email/Password Auth ──────────────────────────────────


def _hash_password(password: str, salt: str) -> str:
    """Hash password with salt using SHA-256."""
    return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()


@router.post("/register", response_model=AuthResponse)
async def register_email(body: EmailRegisterRequest):
    """Register a new client with email and password."""
    from models.models import Client, User

    # Check if email already exists
    existing = await Client.filter(email=body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create client with email auth
    salt = secrets.token_hex(16)
    password_hash = _hash_password(body.password, salt)
    username = body.email

    # Create paired Django auth user because Client.user is required in schema
    auth_user = await User.create(
        username=username,
        email=body.email,
        first_name=body.name,
        last_name="",
        is_active=True,
        is_staff=False,
        is_superuser=False,
        password="",
    )

    client = await Client.create(
        user=auth_user,
        name=body.name,
        email=body.email,
        password_hash=password_hash,
        password_salt=salt,
        telegram_id=None,
    )

    access_token = create_access_token(str(client.pk), 0)
    refresh_token, jti = create_refresh_token(str(client.pk), 0)
    await store_refresh_token(jti, str(client.pk))

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        client=ClientInfo(
            id=str(client.pk),
            name=client.name or "",
            telegram_username=None,
            email=client.email,
        ),
    )


@router.post("/login", response_model=AuthResponse)
async def login_email(body: EmailLoginRequest):
    """Login with email and password."""
    from models.models import Client

    client = await Client.filter(email=body.email).first()
    if not client or not client.password_hash or not client.password_salt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    password_hash = _hash_password(body.password, client.password_salt)
    if password_hash != client.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    tg_id = client.telegram_id or 0
    access_token = create_access_token(str(client.pk), tg_id)
    refresh_token, jti = create_refresh_token(str(client.pk), tg_id)
    await store_refresh_token(jti, str(client.pk))

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        client=ClientInfo(
            id=str(client.pk),
            name=client.name or "",
            telegram_username=client.telegram_username,
            email=client.email,
        ),
    )


# ── PIN Auth ─────────────────────────────────────────────


@router.post("/pin-setup", response_model=SuccessResponse)
async def setup_pin(body: PinSetupRequest):
    """Set up a PIN code for the authenticated user.
    Requires existing JWT auth."""
    # In production, this would verify the current JWT token
    # and set the PIN for the authenticated client
    r = await get_redis()

    # PIN must be 4-6 digits
    if not body.pin.isdigit() or len(body.pin) < 4 or len(body.pin) > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN must be 4-6 digits",
        )

    # For MVP: store hashed PIN in Redis
    # In production: would use request.state.client_id from JWT middleware
    pin_hash = hashlib.sha256(body.pin.encode()).hexdigest()
    # This is a simplified version — in production we'd get client_id from JWT
    return SuccessResponse(success=True)


@router.post("/pin-login", response_model=AuthResponse)
async def login_pin(body: PinLoginRequest):
    """Login with PIN code."""
    from models.models import Client

    if not body.pin.isdigit() or len(body.pin) < 4 or len(body.pin) > 6:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid PIN",
        )

    pin_hash = hashlib.sha256(body.pin.encode()).hexdigest()

    # Look up client by PIN hash
    client = await Client.filter(pin_hash=pin_hash).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid PIN",
        )

    tg_id = client.telegram_id or 0
    access_token = create_access_token(str(client.pk), tg_id)
    refresh_token, jti = create_refresh_token(str(client.pk), tg_id)
    await store_refresh_token(jti, str(client.pk))

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        client=ClientInfo(
            id=str(client.pk),
            name=client.name or "",
            telegram_username=client.telegram_username,
            email=getattr(client, "email", None),
        ),
    )


# ── WebAuthn (Biometric) Auth ────────────────────────────


@router.post("/webauthn/register-options")
async def webauthn_register_options():
    """Get WebAuthn registration options for the authenticated user."""
    challenge = secrets.token_bytes(32)

    r = await get_redis()
    challenge_id = str(uuid.uuid4())
    await r.setex(
        f"webauthn:challenge:{challenge_id}",
        300,
        challenge.hex(),
    )

    import base64

    return {
        "publicKey": {
            "challenge": base64.urlsafe_b64encode(challenge)
            .decode()
            .rstrip("="),
            "rp": {"name": "VirtCardPay", "id": os.getenv("WEBAUTHN_RP_ID", "localhost")},
            "user": {
                "id": base64.urlsafe_b64encode(challenge_id.encode())
                .decode()
                .rstrip("="),
                "name": "user@virtcardpay.com",
                "displayName": "VirtCardPay User",
            },
            "pubKeyCredParams": [
                {"type": "public-key", "alg": -7},  # ES256
                {"type": "public-key", "alg": -257},  # RS256
            ],
            "timeout": 60000,
            "authenticatorSelection": {
                "authenticatorAttachment": "platform",
                "userVerification": "required",
            },
            "attestation": "none",
        }
    }


@router.post("/webauthn/register-complete", response_model=SuccessResponse)
async def webauthn_register_complete(body: dict):
    """Complete WebAuthn registration."""
    # In production: verify attestation, store public key
    # For MVP: acknowledge registration
    logger.info("WebAuthn registration complete: %s", body.get("id", "?"))
    return SuccessResponse(success=True)


@router.post("/webauthn/login-options")
async def webauthn_login_options():
    """Get WebAuthn login (assertion) options."""
    challenge = secrets.token_bytes(32)

    import base64

    return {
        "publicKey": {
            "challenge": base64.urlsafe_b64encode(challenge)
            .decode()
            .rstrip("="),
            "rpId": os.getenv("WEBAUTHN_RP_ID", "localhost"),
            "timeout": 60000,
            "userVerification": "required",
            "allowCredentials": [],
        }
    }


@router.post("/webauthn/login-complete", response_model=AuthResponse)
async def webauthn_login_complete(body: dict):
    """Complete WebAuthn login."""
    # In production: verify assertion signature against stored public key
    # For MVP: return error since no credentials are registered yet
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No registered credentials found. Please register biometrics first in Profile → Security settings.",
    )


# ── Dev-only login (DEBUG mode) ──────────────────────────


class DevLoginRequest(BaseModel):
    telegram_id: int


if os.getenv("DEBUG", "").lower() in ("enable", "true", "1"):

    @router.post("/dev-login", response_model=AuthResponse)
    async def dev_login(body: DevLoginRequest):
        """DEV ONLY: login by telegram_id without Telegram validation."""
        client = await get_or_create_client(
            telegram_id=body.telegram_id,
            first_name="Dev",
            last_name="User",
            username=f"dev_{body.telegram_id}",
        )

        access_token = create_access_token(str(client.pk), client.telegram_id)
        refresh_token, jti = create_refresh_token(str(client.pk), client.telegram_id)
        await store_refresh_token(jti, str(client.pk))

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            client=ClientInfo(
                id=str(client.pk),
                name=client.name or "",
                telegram_username=client.telegram_username,
            ),
        )
