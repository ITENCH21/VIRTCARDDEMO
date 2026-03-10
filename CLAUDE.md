# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Обзор

YeezyPay — платформа для выпуска виртуальных карт, обработки транзакций и интеграции с криптовалютными кошельками. Async-first архитектура на Python с event-driven микросервисами через NATS JetStream.

## Tech Stack

- **Backend API**: FastAPI + Tortoise ORM (async), pydantic 1.10
- **Admin**: Django 4.0.6 + DRF (sync)
- **DB**: PostgreSQL 14.2, **Cache**: Redis 7
- **Message Broker**: NATS JetStream
- **Bot**: python-telegram-bot 22.6
- **Webapp**: React 18 + TypeScript + Vite (Telegram Mini App)
- **Infra**: Docker Compose, Nginx
- **Форматирование**: black (line-length=88), flake8

## Команды

### Запуск

```bash
docker compose up                    # Весь стек (НЕ docker-compose)
docker compose up admin webapp_api   # Отдельные сервисы
docker compose build <service>       # Пересборка контейнера
```

### Django Admin (миграции, статика)

```bash
docker compose exec admin python manage.py makemigrations
docker compose exec admin python manage.py migrate
docker compose exec admin python manage.py collectstatic --no-input
docker compose exec admin python manage.py createsuperuser
```

### Backend CLI (typer, внутри контейнера)

```bash
python -m main rates                              # Демон курсов валют
python -m main fiscal                             # Обработка транзакций
python -m main yeezypay-gate                      # Операции с картами
python -m main in-callbacks --host 0.0.0.0 --port 8001  # Входящие вебхуки от гейтов
python -m main out-callbacks                            # Исходящие вебхуки клиентам
python -m main webapp-api --host 0.0.0.0 --port 8002
python -m main bot
python -m main yeezypay-crypto-ops --period 60
python -m main trongrid-monitor --period 15
python -m main notifications --period 15
```

### Webapp (React)

```bash
cd webapp && npm install && npm run dev    # Dev-сервер (Vite, proxy → localhost:8002)
cd webapp && npm run build                 # TypeScript check + Vite build → dist/
```

### Форматирование и линтинг

```bash
black --line-length 88 <file_or_dir>
flake8 <file_or_dir>
```

## Архитектура

### Двойная модельная система

Django ORM (admin/) — **источник истины** для схемы БД. Tortoise ORM (backend/models/) — async-зеркало тех же таблиц. Djangoise-мост (`backend/models/djangoise/`) транслирует `Meta.db_table` → `Meta.table` для совместимости.

**При изменении моделей**: менять и Django-модель в `admin/*/models.py`, и Tortoise-модель в `backend/models/models.py`. Миграции генерирует только Django.

### Event-driven потоки (NATS JetStream)

```
API/Bot/Admin → Operation(PENDING) → gates_stream
                                         ↓
                                   YeezyPayMicroservice → вызов YeezyPay API
                                         ↓
                                   fiscal_stream → FiscalMicroservice
                                         ↓
                                   Transaction + AccountMove (двойная запись)
                                         ↓
                                   callbacks_stream → OutCallbackMicroservice → webhook
```

Потоки:
- `fiscal_stream` [subjects: `item`, `{gate}_callback`] — результаты транзакций
- `gates_stream` [subjects: `yeezypay_crypto`, `yeezypay_callback`] — задачи для шлюзов
- `callbacks_stream` [subject: `callback_process`] — доставка вебхуков

### Слои backend

- **API** (`api/webapp/routers/`) — валидация, JWT-аутентификация, ответы. Auth: Telegram initData → HMAC-SHA256, JWT access (15 мин) + refresh (7 дней) в Redis
- **Services** (`services/`) — бизнес-логика: card_service, balance_service, withdraw_service, notification_service. Stateless, async
- **Microservices** (`microservices/`) — NATS-консьюмеры: fiscal (транзакции, двойная запись), out_callbacks (доставка исходящих вебхуков с retry)
- **Daemons** (`daemons/`) — периодические задачи. Наследуют `PeriodicBaseHandler` (period + cooldown). rates (5 мин), notifications (15 сек), yeezypay_crypto_ops (60 сек), trongrid_monitor (15 сек)
- **Gates** (`gates/`) — абстракция шлюзов. `BaseGate` ABC → `YeezyPayGate` (card_open/topup/close/block/restore + crypto wallets)

### Daemon base classes

`BaseHandler` (`backend/base_daemon.py`) — with_orm, with_nats, lifecycle: `on_start()` → `inner_run()` → `on_stop()`, graceful shutdown по SIGINT/SIGTERM.
`PeriodicBaseHandler` — extends BaseHandler, `one_iter()` + period + exponential cooldown on error.

### Fixed-point арифметика

Все суммы хранятся как integer в `_db`-полях. Конвертация через `denominator` валюты:
```python
amount_db = int(Decimal(amount_human) * 10**currency.denominator)  # ROUND_HALF_UP
amount_human = Decimal(amount_db) / 10**currency.denominator
```
Утилиты: `amount_db_to_human()`, `amount_human_to_db()`, `fmt_amount()` в `backend/models/models.py`.

### Hold-семантика

- `amount_db` — полный баланс
- `amount_holded_db` — заблокировано под операции
- Доступно: `amount_db - amount_holded_db`
- Атомарные методы: `account.hold_amount_db()`, `account.unhold_amount_db()`

### Operation lifecycle

`PENDING → OPERATING → COMPLETE | FAILED | UNKNOWN`. Каждый шаг логируется в OperationLog с тегами (CREATE, HOLD_AMOUNT, TO_GATE, FROM_GATE, TO_FISCAL, DONE, ERROR).

## Ключевые модели

- **Client** → User + telegram_id + ClientGroup (рефералы) → Account[]
- **Account** — amount_db, kind (DEFAULT/VIRTUAL_CARD), status, currency, external_id, address
- **Operation** — kind (CARD_OPEN/TOPUP/BLOCK/CLOSE/DEPOSIT/WITHDRAW/...), status, amount_db, fee_db, gate, parent
- **Transaction** + **AccountMove** — двойная запись (debit/credit)
- **Currency** + **CurrencyRate** — denominator (fixed-point), human_denominator (display)
- **Gate** — kind, code, credentials (JSON)
- **Tarif** + **TarifLine** — fee_percent, fee_fixed, fee_minimal, amount ranges. Подклассы: DepositTarif, WithdrawTarif, CardOpenTarif, CardTopUpTarif, ExchangeTarif

## Webapp (React)

Telegram Mini App + standalone SPA. React Router v6, basename `/app`. Vite собирает в `dist/`.

- **Контексты**: AuthContext (JWT + Telegram initData auto-login), ThemeContext (Telegram тема → CSS vars)
- **API-клиент** (`webapp/src/api/client.ts`): fetch-обёртка с auto-refresh JWT на 401
- **Polling**: usePolling hook — 3 сек первые 30 сек, потом 10 сек, таймаут 5 мин
- **Роуты**: `/` dashboard, `/cards` list/issue/detail/topup, `/deposit`, `/withdraw`, `/history`, `/profile`

## Docker-сервисы

| Сервис | Порт | Назначение |
|--------|------|------------|
| admin | 7002→8000 | Django admin |
| webapp_api | 8002 | WebApp REST API (JWT) |
| in_callbacks | 8001 | Приём входящих вебхуков от шлюзов |
| out_callbacks | — | Доставка исходящих вебхуков клиентам (NATS consumer) |
| bot | — | Telegram бот |
| fiscal | — | Обработка транзакций (NATS consumer) |
| yeezypay_gate | — | Карточные операции (NATS consumer) |
| rates | — | Курсы валют (каждые 5 мин) |
| yeezypay_crypto_ops | — | Крипто-операции (каждые 60 сек) |
| trongrid_monitor | — | USDT TRC20 мониторинг (каждые 15 сек) |
| notifications | — | Telegram-уведомления (каждые 15 сек) |
| webapp_build | — | Сборка React → dist/ |
| db | 7432→5432 | PostgreSQL |
| redis | 6379 | Кеш + JWT-хранилище |
| nats | 4222 | NATS JetStream |
| nginx | 80 | Reverse proxy |

## Правила

- Только `docker compose` (не `docker-compose`)
- Async-код в backend (asyncio, Tortoise ORM), sync в admin (Django ORM)
- Модели дублируются: менять в обоих местах, миграции через Django
- Переменные окружения: `default.env` (шаблон) + `.env` (секреты, не в git)
- Gate credentials хранятся как JSON в БД (динамическая конфигурация)
- Тарифы — записи в БД, не код
- Admin взаимодействует с backend через NATS (fire-and-forget), не напрямую
- NATS-утилиты общие для admin и backend: `common/nats_utils.py`
