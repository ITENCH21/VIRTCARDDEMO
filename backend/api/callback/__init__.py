import os
import logging

from api.base import create_app

# from .routers import

routers = []

settings = {
    "fastapi_init_kwargs": {
        "title": "Callback API",
    },
    "nats": (
        "callbacks_stream",
        [
            "callback",
        ],
    ),
    "debug": os.getenv("DEBUG", "").lower() in ("enable", "true", "1"),
    "base_path": "/api/callback",
}


app = create_app(routers, **settings)
logger = logging.getLogger()
