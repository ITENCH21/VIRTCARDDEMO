"""
WebApp API — REST API для веб-интерфейса (Telegram Mini App + standalone).

Аутентификация: Telegram initData / Login Widget → JWT.
Сервисы: balance_service, card_service, Client CRUD.
"""

import os

from fastapi.middleware.cors import CORSMiddleware

from api.base import create_app
from api.webapp.routers import (
    auth,
    balance,
    cards,
    deposit,
    operations,
    profile,
    withdraw,
    ws,
)

routers = [
    auth.router,
    balance.router,
    cards.router,
    deposit.router,
    operations.router,
    profile.router,
    withdraw.router,
    ws.router,
]

settings = {
    "fastapi_init_kwargs": {
        "title": "WebApp API",
    },
    "debug": os.getenv("DEBUG", "").lower() in ("enable", "true", "1"),
    "base_path": "/api/v1",
}

app = create_app(routers, **settings)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
