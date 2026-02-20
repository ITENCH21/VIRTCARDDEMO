# YeezyPay — Virtual Card Processing Platform

## Обзор

Платформа для выпуска и управления виртуальными картами, обработки транзакций и интеграции с криптовалютными кошельками. Async-first архитектура на Python.

## Tech Stack

- **Backend API**: FastAPI + Tortoise ORM (async)
- **Admin**: Django 4 + DRF
- **DB**: PostgreSQL 14.2
- **Message Broker**: NATS JetStream
- **Cache**: Redis 7
- **Bot**: python-telegram-bot 22.6
- **Infra**: Docker Compose, Nginx
- **Валидация**: pydantic 1.10
- **Форматирование**: black (line-length=88), flake8

## Структура проекта

```
admin/          — Django admin-панель (clients, currencies, tarifs, operations, finance, cards)
backend/
  app/          — Инициализация (config, db, main)
  models/       — Tortoise ORM модели + enums + djangoise-мост
  api/          — FastAPI эндпоинты (gate_callbacks, callback, webapp)
  api/webapp/   — WebApp REST API (auth, balance, cards, deposit, operations, profile)
  gates/        — Интеграции платёжных шлюзов (base_gate.py, impls/yeezypay.py)
  services/     — Бизнес-логика (card_service, balance_service, notification_service)
  microservices/— Fiscal (транзакции), Callbacks (вебхуки)
  daemons/      — Периодические задачи (rates, yeezypay_crypto_operations)
  main.py       — CLI точка входа (typer)
bot/            — Telegram-бот (регистрация, создание аккаунтов)
common/         — Общие утилиты (nats_utils)
webapp/         — React + Vite + TypeScript фронтенд (Telegram Mini App + standalone)
nginx/          — Конфигурация reverse proxy
```

## Запуск

```bash
docker compose up
```

проект запускается только через "docker compose", не docker-compose

### Сервисы (docker-compose)

| Сервис | Порт | Назначение |
|--------|------|------------|
| admin | 7002→8000 | Django admin |
| bot | — | Telegram бот |
| rates | — | Демон курсов валют (каждые 5 мин) |
| fiscal | — | Обработка транзакций |
| yeezypay_gate | — | Операции с картами |
| gate_callbacks | 8001 | Приём вебхуков от шлюзов |
| webapp_api | 8002 | WebApp REST API (JWT auth) |
| webapp_build | — | Сборка React фронтенда |
| yeezypay_crypto_ops | — | Опрос крипто-операций (каждые 60с) |
| db | 7432→5432 | PostgreSQL |
| redis | 6379 | Кеш |
| nats | 4222 | Брокер сообщений |

### CLI команды (backend/main.py через typer)

```bash
python -m main rates
python -m main fiscal
python -m main yeezypay-gate
python -m main gate-callbacks --host 0.0.0.0 --port 8001
python -m main yeezypay-crypto-ops --period 60
python -m main bot
python -m main webapp-api --host 0.0.0.0 --port 8002
```

## Ключевые модели

- **Client** → User + telegram_id + группа (рефералы) → имеет Account[]
- **Account** — баланс (amount_db), тип (DEFAULT/VIRTUAL_CARD), статус, валюта
- **Operation** — CARD_OPEN, CARD_TOPUP, CARD_BLOCK, CARD_CLOSE, DEPOSIT, WITHDRAW и т.д.
- **Transaction** + **AccountMove** — двойная запись движения средств
- **Currency** + **CurrencyRate** — валюты с denominator (fixed-point)
- **Gate** — платёжный шлюз (credentials в JSON)
- **Tarif** + **TarifLine** — тарифы: процент, фикс, минимум

## Межсервисная коммуникация (NATS JetStream)

```
fiscal_stream    → item, {gate}_callback     # Обработка транзакций
gates_stream     → yeezypay_crypto, yeezypay_callback  # Операции шлюза
callbacks_stream → callback_process           # Доставка вебхуков
```

## Бизнес-логика: жизненный цикл карты

1. Пользователь → Operation(CARD_OPEN, PENDING)
2. YeezyPayMicroservice → вызов YeezyPay API `/vc-api/v1/card/open`
3. Результат → fiscal_stream
4. FiscalMicroservice → транзакции, обновление баланса

## Конвертация сумм

```python
amount_db = int(amount_human * 10**denominator)
amount_human = Decimal(amount_db) / 10**denominator
```

## Переменные окружения

Основные в `default.env`: POSTGRES_*, REDIS_*, NATS_SERVERS, TELEGRAM_BOT_TOKEN, CALL_GATES, JWT_SECRET, JWT_ACCESS_TOKEN_EXPIRE_MINUTES, JWT_REFRESH_TOKEN_EXPIRE_DAYS.

## Правила разработки

- Форматирование: `black --line-length 88`
- Линтинг: `flake8`
- Миграции: `python admin/manage.py makemigrations && python admin/manage.py migrate`
- Async-код в backend (asyncio, Tortoise ORM), sync в admin (Django ORM)
- Модели дублируются: Tortoise (backend/models/) и Django (admin/*/models.py) — djangoise-мост
