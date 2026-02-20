"""
Сервис для вывода криптовалюты (USDT TRC-20).

Flow: estimate → create → оператор вручную complete/fail через Django admin.
Без автоматической публикации в NATS.
"""

import logging
import re
from decimal import Decimal

from models.models import (
    Client,
    Operation,
    amount_db_to_human,
    amount_human_to_db,
    fmt_amount,
    operation_log,
)
from models.enums import OperationKind, LogTag
from services.balance_service import (
    get_crypto_account,
    get_available_balance_db_sync,
    calc_withdraw_fee,
)

logger = logging.getLogger("withdraw_service")


class WithdrawServiceError(Exception):
    """Базовая ошибка сервиса вывода."""


class InsufficientFundsError(WithdrawServiceError):
    """Недостаточно средств."""

    def __init__(self, available: Decimal, required: Decimal, currency_symbol: str):
        self.available = available
        self.required = required
        self.currency_symbol = currency_symbol
        super().__init__(
            f"Недостаточно средств: доступно {fmt_amount(available)} {currency_symbol}, "
            f"требуется {fmt_amount(required)} {currency_symbol}"
        )


class NoTarifError(WithdrawServiceError):
    """Тариф не найден."""


class AccountNotFoundError(WithdrawServiceError):
    """Аккаунт не найден."""


class InvalidAddressError(WithdrawServiceError):
    """Невалидный адрес."""


class SelfAddressError(WithdrawServiceError):
    """Попытка вывода на собственный адрес."""


# TRC-20: starts with 'T', 34 chars, base58 alphabet
_TRC20_RE = re.compile(
    r"^T[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{33}$"
)


def validate_trc20_address(address: str) -> None:
    """Проверяет формат TRC-20 адреса."""
    if not _TRC20_RE.match(address):
        raise InvalidAddressError("Invalid TRC-20 address format")


async def estimate_withdraw(client: Client, amount: Decimal) -> dict:
    """Предварительный расчёт вывода (сумма + комиссия).

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

    result = await calc_withdraw_fee(amount, currency)
    if result is None:
        raise NoTarifError("Тариф на вывод не настроен")

    fee, tarif_info = result
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
        "tarif_info": tarif_info,
    }


async def create_withdraw(client: Client, amount: Decimal, address: str) -> Operation:
    """Создаёт операцию вывода USDT.

    1. Рассчитывает комиссию
    2. Проверяет баланс
    3. Создаёт Operation(WITHDRAW, PENDING)
    4. Холдит средства (amount + fee)

    Без публикации в NATS — оператор обрабатывает вручную.
    """
    address = address.strip()
    validate_trc20_address(address)

    estimate = await estimate_withdraw(client, amount)
    account = estimate["account"]
    currency = estimate["currency"]

    # Проверка: нельзя выводить на свой же адрес в нашей системе
    if account.address and account.address.lower() == address.lower():
        raise SelfAddressError("Cannot withdraw to your own deposit address")

    operation = await Operation.create(
        client=client,
        account=account,
        kind=OperationKind.WITHDRAW,
        method=Operation.Method.CRYPTO,
        status=Operation.Status.PENDING,
        currency=currency,
        amount_db=estimate["amount_db"],
        fee_db=estimate["fee_db"],
        account_data=address,
        data={
            "holded_amount": estimate["total_db"],
            "fee_estimate": {
                "fee_db": estimate["fee_db"],
                "fee_human": float(estimate["fee"]),
            },
            "address": address,
        },
    )

    # Холдим средства (amount + fee)
    await account.hold_amount_db(estimate["total_db"], operation=operation)

    await operation_log(operation.pk, LogTag.CREATE, f"Withdraw {amount} to {address}")

    logger.info(
        "Withdraw operation created: #%s, amount=%s, fee=%s, address=%s",
        operation.pk,
        estimate["amount"],
        estimate["fee"],
        address,
    )

    return operation
