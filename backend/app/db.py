from tortoise import Tortoise
from tortoise.contrib.fastapi import register_tortoise

from .config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)


def postgres_dsn() -> str:
    return (
        f"postgres://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
        f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )


TORTOISE_ORM = {
    "connections": {
        "default": {
            "engine": "tortoise.backends.asyncpg",
            "credentials": {
                "host": POSTGRES_HOST,
                "port": POSTGRES_PORT,
                "user": POSTGRES_USER,
                "password": POSTGRES_PASSWORD,
                "database": POSTGRES_DB,
            },
        },
    },
    "apps": {"models": {"models": ["app.models", "models.models"]}},
}


async def init_db() -> None:
    await Tortoise.init(config=TORTOISE_ORM)
    await Tortoise.generate_schemas()


async def close_db() -> None:
    await Tortoise.close_connections()


def register_db(app):
    register_tortoise(app, config=TORTOISE_ORM, generate_schemas=False)
