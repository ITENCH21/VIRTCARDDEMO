"""
conftest.py — создание/удаление изолированной тестовой БД.

Перед запуском тестов:
    1. Подключается к PostgreSQL (к БД 'postgres')
    2. Создаёт БД test_django_db
    3. Применяет Django-миграции (через manage.py)
    4. Создаёт таблицы finance_transaction / finance_accountmove (ещё нет миграции)
    5. Переключает TORTOISE_ORM на тестовую БД

После тестов:
    6. Закрывает все соединения
    7. Дропает test_django_db
"""

import asyncio
import os
import subprocess
import sys

import asyncpg
import pytest

# ── path hack ──────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
ADMIN_DIR = os.path.join(PROJECT_ROOT, "admin")
for p in (BACKEND_DIR, PROJECT_ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

# ── Параметры подключения ──────────────────────────────────
PG_HOST = os.environ.get("POSTGRES_HOST", "localhost")
PG_PORT = int(os.environ.get("POSTGRES_PORT", "7432"))
PG_USER = os.environ.get("POSTGRES_USER", "postgres")
PG_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")
MAIN_DB = os.environ.get("POSTGRES_DB", "django_db")
TEST_DB = f"test_{MAIN_DB}"

# ── SQL для таблиц, которых нет в Django-миграциях ─────────
EXTRA_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS finance_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    parent_id UUID REFERENCES finance_transaction(id) ON DELETE SET NULL,
    status VARCHAR(1) NOT NULL DEFAULT 'D',
    kind VARCHAR(1) NOT NULL,
    account_from_id UUID NOT NULL REFERENCES clients_account(id),
    account_to_id UUID NOT NULL REFERENCES clients_account(id),
    currency_from_id INTEGER NOT NULL REFERENCES currencies_currency(id),
    currency_to_id INTEGER NOT NULL REFERENCES currencies_currency(id),
    operation_id UUID NOT NULL REFERENCES operations_operation(id),
    amount_db BIGINT NOT NULL DEFAULT 0,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS finance_accountmove (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    account_id UUID NOT NULL REFERENCES clients_account(id),
    currency_id INTEGER NOT NULL REFERENCES currencies_currency(id),
    amount_db BIGINT NOT NULL DEFAULT 0,
    transaction_id UUID NOT NULL REFERENCES finance_transaction(id),
    status VARCHAR(1) NOT NULL DEFAULT 'D',
    direction INTEGER NOT NULL DEFAULT 0
);
"""


def _run_django_migrate(db_name: str):
    """Запуск Django migrate для указанной БД."""
    env = os.environ.copy()
    env["POSTGRES_DB"] = db_name
    env["POSTGRES_HOST"] = PG_HOST
    env["POSTGRES_PORT"] = str(PG_PORT)
    env["POSTGRES_USER"] = PG_USER
    env["POSTGRES_PASSWORD"] = PG_PASSWORD
    env["PYTHONPATH"] = f"{ADMIN_DIR}:{PROJECT_ROOT}"

    result = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--no-input"],
        cwd=ADMIN_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Django migrate failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        )


async def _create_test_db():
    """Создаёт тестовую БД (DROP IF EXISTS + CREATE)."""
    conn = await asyncpg.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        database="postgres",
    )
    try:
        # Принудительно отключаем все соединения к тестовой БД (если осталась)
        await conn.execute(
            f"""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = '{TEST_DB}' AND pid <> pg_backend_pid()
        """
        )
        await conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
        await conn.execute(f"CREATE DATABASE {TEST_DB}")
    finally:
        await conn.close()


async def _drop_test_db():
    """Удаляет тестовую БД."""
    conn = await asyncpg.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        database="postgres",
    )
    try:
        await conn.execute(
            f"""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = '{TEST_DB}' AND pid <> pg_backend_pid()
        """
        )
        await conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
    finally:
        await conn.close()


async def _create_extra_tables():
    """Создаёт таблицы finance_transaction / finance_accountmove."""
    conn = await asyncpg.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        database=TEST_DB,
    )
    try:
        await conn.execute(EXTRA_TABLES_SQL)
    finally:
        await conn.close()


def pytest_configure(config):
    """
    Вызывается pytest до сбора тестов.
    Создаём тестовую БД и применяем миграции (синхронно).
    """
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_create_test_db())
    finally:
        loop.close()

    # Django migrate (синхронный subprocess)
    _run_django_migrate(TEST_DB)

    # Extra tables (finance_transaction / finance_accountmove)
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_create_extra_tables())
    finally:
        loop.close()

    # Переключаем env на тестовую БД — все дальнейшие импорты config.py
    # увидят TEST_DB вместо основной
    os.environ["POSTGRES_DB"] = TEST_DB


def pytest_unconfigure(config):
    """Вызывается pytest после завершения всех тестов. Дропаем тестовую БД."""
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_drop_test_db())
    finally:
        loop.close()
