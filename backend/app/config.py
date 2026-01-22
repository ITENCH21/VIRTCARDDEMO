import os


def env(name: str, default: str) -> str:
    return os.getenv(name, default)


POSTGRES_HOST = env("POSTGRES_HOST", "postgres")
POSTGRES_PORT = env("POSTGRES_PORT", "5432")
POSTGRES_DB = env("POSTGRES_DB", "app_db")
POSTGRES_USER = env("POSTGRES_USER", "app_user")
POSTGRES_PASSWORD = env("POSTGRES_PASSWORD", "app_password")

REDIS_HOST = env("REDIS_HOST", "redis")
REDIS_PORT = env("REDIS_PORT", "6379")
