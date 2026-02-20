"""Auth router — Telegram Mini App / Login Widget → JWT."""

import os
import logging

from fastapi import APIRouter, HTTPException, status
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
)
from api.webapp.schemas import (
    TelegramWebAppAuth,
    TelegramLoginAuth,
    RefreshTokenRequest,
    AuthResponse,
    ClientInfo,
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
