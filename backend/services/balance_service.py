"""
Сервис для работы с балансами клиента.

Предоставляет методы для получения балансов, форматирования сумм,
проверки достаточности средств.
"""

import logging
from decimal import Decimal
from typing import Optional

from models.models import (
    Account,
    Client,
    Currency,
    amount_db_to_human,
    amount_human_to_db,
    CardOpenTarifLine,
    CardTopUpTarifLine,
    WithdrawTarifLine,
)

logger = logging.getLogger("balance_service")

CRYPTO_CURRENCY_CODE = "USDT-TRC20"


async def get_client_accounts(client: Client) -> list[Account]:
    """Возвращает все активные аккаунты клиента (только DEFAULT, не карты)."""
    return await Account.filter(
        client=client,
        kind=Account.Kind.DEFAULT,
        status__in=[Account.Status.ACTIVE, Account.Status.RESTORED],
    ).prefetch_related("currency")


async def get_crypto_account(client: Client) -> Optional[Account]:
    """Возвращает основной USDT-TRC20 аккаунт клиента."""
    return (
        await Account.filter(
            client=client,
            kind=Account.Kind.DEFAULT,
            currency__code=CRYPTO_CURRENCY_CODE,
            status__in=[Account.Status.ACTIVE, Account.Status.RESTORED],
        )
        .prefetch_related("currency")
        .first()
    )


async def get_account_balance_human(account: Account) -> Decimal:
    """Возвращает баланс аккаунта в human-readable формате."""
    if not account.currency_id:
        await account.fetch_related("currency")
    return amount_db_to_human(account.amount_db or 0, account.currency)


async def get_available_balance_db(account: Account) -> int:
    """Возвращает доступный баланс (за вычетом холда) в db-формате."""
    return (account.amount_db or 0) - (account.amount_holded_db or 0)


async def get_available_balance_human(account: Account) -> Decimal:
    """Возвращает доступный баланс в human-readable формате."""
    if not account.currency_id:
        await account.fetch_related("currency")
    available_db = get_available_balance_db_sync(account)
    return amount_db_to_human(available_db, account.currency)


def get_available_balance_db_sync(account: Account) -> int:
    """Синхронная версия: доступный баланс (amount - holded)."""
    return (account.amount_db or 0) - (account.amount_holded_db or 0)


def format_amount(amount: Decimal, currency: Currency) -> str:
    """Форматирует сумму с символом валюты."""
    precision = currency.human_denominator or 2
    formatted = f"{amount:.{precision}f}"
    symbol = currency.symbol or currency.code
    return f"{formatted} {symbol}"


async def format_account_balance(account: Account) -> str:
    """Форматирует баланс аккаунта для отображения в боте."""
    if not account.currency_id:
        await account.fetch_related("currency")
    balance = amount_db_to_human(account.amount_db or 0, account.currency)
    return format_amount(balance, account.currency)


async def check_sufficient_funds(
    account: Account, amount_db: int, fee_db: int = 0
) -> bool:
    """Проверяет, достаточно ли средств на аккаунте (с учётом холда)."""
    available = get_available_balance_db_sync(account)
    return available >= (amount_db + fee_db)


async def calc_card_open_fee(
    amount: Decimal, currency: Currency, method: str = "VC"
) -> Optional[Decimal]:
    """Рассчитывает комиссию за выпуск карты."""
    tarifline = await CardOpenTarifLine.filter(
        tarif__status="A",
        is_active=True,
        currency_id=currency.pk,
        method=method,
    ).first()
    if not tarifline:
        return None
    return tarifline.calc_fee(amount)


async def calc_card_topup_fee(
    amount: Decimal, currency: Currency, method: str = "VC"
) -> Optional[Decimal]:
    """Рассчитывает комиссию за пополнение карты."""
    tarifline = await CardTopUpTarifLine.filter(
        tarif__status="A",
        is_active=True,
        currency_id=currency.pk,
        method=method,
    ).first()
    if not tarifline:
        return None
    return tarifline.calc_fee(amount)


async def calc_withdraw_fee(
    amount: Decimal, currency: Currency, method: str = "CPT"
) -> Optional[tuple[Decimal, dict]]:
    """Рассчитывает комиссию за вывод криптовалюты.

    Returns (fee, tarif_info) or None if no tariff found.
    """
    tarifline = await WithdrawTarifLine.filter(
        tarif__status="A",
        is_active=True,
        currency_id=currency.pk,
        method=method,
    ).first()
    if not tarifline:
        return None
    fee = tarifline.calc_fee(amount)
    tarif_info = {
        "fee_percent": tarifline.fee_percent,
        "fee_fixed": tarifline.fee_fixed,
        "fee_minimal": tarifline.fee_minimal,
    }
    return fee, tarif_info
