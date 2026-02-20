"""
Сервис для работы с виртуальными картами.

Создание операций на выпуск/пополнение/блокировку/закрытие/восстановление карт,
публикация в NATS для обработки гейтом, проверка условий.
"""

import uuid
import logging
from decimal import Decimal
from typing import Optional

from tortoise import timezone
from tortoise.exceptions import DoesNotExist

from models.models import (
    Account,
    Client,
    Operation,
    Currency,
    amount_db_to_human,
    amount_human_to_db,
    fmt_amount,
    operation_log,
)
from models.enums import OperationKind, LogTag
from common.nats_utils import AsyncNatsProducer
from services.balance_service import (
    get_crypto_account,
    get_available_balance_db_sync,
    calc_card_open_fee,
    calc_card_topup_fee,
)

logger = logging.getLogger("card_service")

CRYPTO_CURRENCY_CODE = "USDT-TRC20"


class CardServiceError(Exception):
    """Базовая ошибка сервиса карт."""


class InsufficientFundsError(CardServiceError):
    """Недостаточно средств."""

    def __init__(self, available: Decimal, required: Decimal, currency_symbol: str):
        self.available = available
        self.required = required
        self.currency_symbol = currency_symbol
        super().__init__(
            f"Недостаточно средств: доступно {fmt_amount(available)} {currency_symbol}, "
            f"требуется {fmt_amount(required)} {currency_symbol}"
        )


class NoTarifError(CardServiceError):
    """Тариф не найден."""


class AccountNotFoundError(CardServiceError):
    """Аккаунт не найден."""


class CardNotFoundError(CardServiceError):
    """Карта не найдена."""


class InvalidCardStatusError(CardServiceError):
    """Некорректный статус карты для операции."""


# ── Получение карт ────────────────────────────────────────


async def get_client_cards(client: Client) -> list[Account]:
    """Возвращает все карты клиента (Account kind=VIRTUAL_CARD)."""
    return (
        await Account.filter(
            client=client,
            kind=Account.Kind.VIRTUAL_CARD,
        )
        .prefetch_related("currency", "parent")
        .order_by("-created_at")
    )


async def get_active_cards(client: Client) -> list[Account]:
    """Возвращает активные карты клиента."""
    return (
        await Account.filter(
            client=client,
            kind=Account.Kind.VIRTUAL_CARD,
            status__in=[
                Account.Status.ACTIVE,
                Account.Status.RESTORED,
            ],
        )
        .prefetch_related("currency", "parent")
        .order_by("-created_at")
    )


async def get_card_by_id(client: Client, card_account_id: str) -> Account:
    """Возвращает карту по ID (с проверкой принадлежности клиенту)."""
    try:
        card = await Account.get(
            pk=card_account_id,
            client=client,
            kind=Account.Kind.VIRTUAL_CARD,
        )
        await card.fetch_related("currency", "parent")
        return card
    except DoesNotExist:
        raise CardNotFoundError("Карта не найдена")


def get_card_last4(card: Account) -> str:
    """Возвращает последние 4 цифры карты."""
    creds = card.credentials or {}
    card_number = creds.get("card_number", "")
    if card_number and len(card_number) >= 4:
        return card_number[-4:]
    return "****"


def get_card_display_name(card: Account) -> str:
    """Форматирует имя карты для отображения."""
    last4 = get_card_last4(card)
    name = card.name or "Карта"
    return f"{name} ****{last4}"


def get_card_status_emoji(card: Account) -> str:
    """Возвращает эмодзи статуса карты."""
    status_map = {
        Account.Status.ACTIVE: "🟢",
        Account.Status.RESTORED: "🟢",
        Account.Status.BLOCKED: "🔴",
        Account.Status.CLOSED: "⚫",
        Account.Status.DRAFT: "🟡",
        Account.Status.BANNED: "🔴",
    }
    return status_map.get(card.status, "⚪")


# ── Выпуск карты ──────────────────────────────────────────


async def estimate_card_open(client: Client, amount: Decimal) -> dict:
    """Предварительный расчёт выпуска карты (сумма + комиссия).

    Returns:
        {
            "amount": Decimal,
            "fee": Decimal,
            "total": Decimal,
            "amount_db": int,
            "fee_db": int,
            "total_db": int,
            "currency": Currency,
            "account": Account,
        }
    """
    account = await get_crypto_account(client)
    if not account:
        raise AccountNotFoundError("USDT-TRC20 аккаунт не найден")

    currency = account.currency
    amount_db = amount_human_to_db(amount, currency)

    fee = await calc_card_open_fee(amount, currency)
    if fee is None:
        raise NoTarifError("Тариф на выпуск карты не настроен")

    fee_db = amount_human_to_db(fee, currency)
    total = amount + fee
    total_db = amount_db + fee_db

    available_db = get_available_balance_db_sync(account)
    if available_db < total_db:
        available_human = amount_db_to_human(available_db, currency)
        raise InsufficientFundsError(
            available_human, total, currency.symbol or currency.code
        )

    return {
        "amount": amount,
        "fee": fee,
        "total": total,
        "amount_db": amount_db,
        "fee_db": fee_db,
        "total_db": total_db,
        "currency": currency,
        "account": account,
    }


async def issue_card(
    client: Client,
    amount: Decimal,
    card_name: str = "",
) -> Operation:
    """Выпускает виртуальную карту.

    1. Рассчитывает комиссию
    2. Проверяет баланс
    3. Холдит средства
    4. Создаёт Operation(CARD_OPEN, PENDING)
    5. Публикует задачу в NATS → yeezypay_gate

    Returns:
        Созданная Operation.
    """
    estimate = await estimate_card_open(client, amount)
    account = estimate["account"]
    currency = estimate["currency"]

    # Создаём операцию
    operation = await Operation.create(
        client=client,
        account=account,
        kind=OperationKind.CARD_OPEN,
        method=Operation.Method.VIRTUAL_CARD,
        status=Operation.Status.PENDING,
        currency=currency,
        amount_db=estimate["amount_db"],
        fee_db=estimate["fee_db"],
        data={
            "amount": estimate["amount_db"],
            "card_name": card_name or None,
            "holded_amount": estimate["total_db"],
            "fee_estimate": {
                "fee_db": estimate["fee_db"],
                "fee_human": float(estimate["fee"]),
            },
        },
    )

    # Холдим средства (amount + fee) — атомарно через select_for_update
    await account.hold_amount_db(estimate["total_db"], operation=operation)

    logger.info(
        "Card issue operation created: #%s, amount=%s, fee=%s",
        operation.pk,
        estimate["amount"],
        estimate["fee"],
    )

    # Публикуем в NATS
    await _publish_gate_task(operation)

    return operation


# ── Пополнение карты ──────────────────────────────────────


async def estimate_card_topup(
    client: Client, card_account_id: str, amount: Decimal
) -> dict:
    """Предварительный расчёт пополнения карты."""
    card = await get_card_by_id(client, card_account_id)
    if card.status not in [Account.Status.ACTIVE, Account.Status.RESTORED]:
        raise InvalidCardStatusError("Карта не активна")

    parent = card.parent
    if not parent:
        raise AccountNotFoundError("Родительский аккаунт не найден")
    await parent.fetch_related("currency")

    currency = parent.currency
    amount_db = amount_human_to_db(amount, currency)

    fee = await calc_card_topup_fee(amount, currency)
    if fee is None:
        fee = Decimal("0")

    fee_db = amount_human_to_db(fee, currency)
    total = amount + fee
    total_db = amount_db + fee_db

    available_db = get_available_balance_db_sync(parent)
    if available_db < total_db:
        available_human = amount_db_to_human(available_db, currency)
        raise InsufficientFundsError(
            available_human, total, currency.symbol or currency.code
        )

    return {
        "amount": amount,
        "fee": fee,
        "total": total,
        "amount_db": amount_db,
        "fee_db": fee_db,
        "total_db": total_db,
        "currency": currency,
        "card": card,
        "parent_account": parent,
    }


async def topup_card(
    client: Client, card_account_id: str, amount: Decimal
) -> Operation:
    """Пополняет виртуальную карту."""
    estimate = await estimate_card_topup(client, card_account_id, amount)
    card = estimate["card"]

    operation = await Operation.create(
        client=client,
        account=card,
        kind=OperationKind.CARD_TOPUP,
        method=Operation.Method.VIRTUAL_CARD,
        status=Operation.Status.PENDING,
        currency=estimate["currency"],
        amount_db=estimate["amount_db"],
        fee_db=estimate["fee_db"],
        data={
            "amount": estimate["amount_db"],
            "holded_amount": estimate["total_db"],
        },
    )

    # Холдим средства на parent — card.parent_id определит правильный аккаунт
    await card.hold_amount_db(estimate["total_db"], operation=operation)

    logger.info("Card topup operation created: #%s, card=%s", operation.pk, card.pk)
    await _publish_gate_task(operation)
    return operation


# ── Блокировка / Восстановление / Закрытие ───────────────


async def block_card(client: Client, card_account_id: str) -> Operation:
    """Блокирует карту."""
    card = await get_card_by_id(client, card_account_id)
    if card.status not in [Account.Status.ACTIVE, Account.Status.RESTORED]:
        raise InvalidCardStatusError("Карта не активна — нельзя заблокировать")

    operation = await Operation.create(
        client=client,
        account=card,
        kind=OperationKind.CARD_BLOCK,
        method=Operation.Method.VIRTUAL_CARD,
        status=Operation.Status.PENDING,
        currency=card.currency,
        data={},
    )

    logger.info("Card block operation created: #%s, card=%s", operation.pk, card.pk)
    await _publish_gate_task(operation)
    return operation


async def restore_card(client: Client, card_account_id: str) -> Operation:
    """Восстанавливает заблокированную карту."""
    card = await get_card_by_id(client, card_account_id)
    if card.status != Account.Status.BLOCKED:
        raise InvalidCardStatusError("Карта не заблокирована — нельзя восстановить")

    operation = await Operation.create(
        client=client,
        account=card,
        kind=OperationKind.CARD_RESTORE,
        method=Operation.Method.VIRTUAL_CARD,
        status=Operation.Status.PENDING,
        currency=card.currency,
        data={},
    )

    logger.info("Card restore operation created: #%s, card=%s", operation.pk, card.pk)
    await _publish_gate_task(operation)
    return operation


async def close_card(client: Client, card_account_id: str) -> Operation:
    """Закрывает карту (возврат остатка на основной аккаунт)."""
    card = await get_card_by_id(client, card_account_id)
    if card.status in [Account.Status.CLOSED, Account.Status.BANNED]:
        raise InvalidCardStatusError("Карта уже закрыта")

    operation = await Operation.create(
        client=client,
        account=card,
        kind=OperationKind.CARD_CLOSE,
        method=Operation.Method.VIRTUAL_CARD,
        status=Operation.Status.PENDING,
        currency=card.currency,
        amount_db=card.amount_db or 0,
        data={},
    )

    logger.info("Card close operation created: #%s, card=%s", operation.pk, card.pk)
    await _publish_gate_task(operation)
    return operation


# ── NATS publisher ────────────────────────────────────────


async def _publish_gate_task(operation: Operation) -> None:
    """Публикует задачу на обработку гейтом в NATS."""
    producer = AsyncNatsProducer(
        subjects=["yeezypay_gate"],
        stream_name="gates_stream",
    )
    try:
        await producer.connect()
        message = {
            "operation_guid": str(operation.pk),
            "payload": operation.data if isinstance(operation.data, dict) else {},
        }
        await producer.publish("yeezypay_gate", message)
        logger.info("Published gate task for operation #%s", operation.pk)
    except Exception:
        logger.exception("Failed to publish gate task for operation #%s", operation.pk)
        raise
    finally:
        await producer.close()
