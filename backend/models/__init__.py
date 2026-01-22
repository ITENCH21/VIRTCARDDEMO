import logging

from tortoise import Tortoise, connections
from config import PG_CONNECT

logger = logging.getLogger("models")

TORTOISE_ORM = {
    "connections": {
        "default": {
            "engine": "tortoise.backends.asyncpg",
            "credentials": PG_CONNECT,
        },
    },
    "apps": {
        "models": {
            "models": [
                "models.models",
            ],
            "default_connection": "default",
        },
    },
}


async def start_orm():
    await Tortoise.init(config=TORTOISE_ORM)
    logger.info("Tortoise-ORM started")


async def stop_orm():
    await connections.close_all()
    logger.info("Tortoise-ORM shutdown")


__all__ = []
