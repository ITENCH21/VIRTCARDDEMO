"""
Сервис уведомлений — отправка Telegram-сообщений клиентам.

Используется демоном уведомлений и может вызываться из хэндлеров бота.
"""

import os
import logging
from decimal import Decimal
from typing import Optional

import httpx

from models.models import (
    Account,
    Client,
    Operation,
    amount_db_to_human,
)
from models.enums import OperationKind

logger = logging.getLogger("notification_service")

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TG_API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"


async def send_telegram_message(
    telegram_id: int,
    text: str,
    parse_mode: str = "HTML",
    reply_markup: Optional[dict] = None,
) -> bool:
    """Отправляет сообщение в Telegram через Bot API."""
    if not BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set")
        return False

    payload = {
        "chat_id": telegram_id,
        "text": text,
        "parse_mode": parse_mode,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{TG_API_URL}/sendMessage", json=payload)
            if resp.status_code != 200:
                logger.warning("Telegram API error %s: %s", resp.status_code, resp.text)
                return False
            return True
    except Exception:
        logger.exception("Failed to send Telegram message to %s", telegram_id)
        return False


# ── Форматирование уведомлений ────────────────────────────


def format_deposit_detected_notification(amount: Decimal, currency_symbol: str) -> str:
    """Уведомление о найденном, но ещё не подтверждённом депозите (TronGrid)."""
    return (
        f"<b>Обнаружено поступление</b>\n\n"
        f"Сумма: <b>{amount} {currency_symbol}</b>\n"
        f"Ожидаем подтверждения..."
    )


def format_address_changed_notification(old_address: str, new_address: str) -> str:
    """Уведомление о смене адреса крипто-кошелька."""
    old_short = (
        f"{old_address[:6]}...{old_address[-4:]}"
        if old_address and len(old_address) > 10
        else old_address or "—"
    )
    new_short = (
        f"{new_address[:6]}...{new_address[-4:]}"
        if len(new_address) > 10
        else new_address
    )
    return (
        f"<b>Адрес кошелька изменён</b>\n\n"
        f"Старый: <code>{old_short}</code>\n"
        f"Новый: <code>{new_short}</code>\n\n"
        f"Используйте новый адрес для пополнения.\n"
        f"Полный адрес: <code>{new_address}</code>"
    )


def format_deposit_notification(operation: Operation, currency_symbol: str) -> str:
    """Форматирует уведомление о депозите."""
    amount = operation.amount
    return (
        f"<b>Баланс пополнен</b>\n\n"
        f"Сумма: <b>{amount} {currency_symbol}</b>\n"
        f"Статус: Завершено"
    )


def format_card_open_notification(
    operation: Operation, card_last4: str, currency_symbol: str
) -> str:
    """Форматирует уведомление о выпуске карты."""
    amount = operation.amount
    return (
        f"<b>Карта выпущена</b>\n\n"
        f"Карта: ****{card_last4}\n"
        f"Сумма: <b>{amount} {currency_symbol}</b>\n"
        f"Статус: Готова к использованию"
    )


def format_card_topup_notification(
    operation: Operation, card_last4: str, currency_symbol: str
) -> str:
    """Форматирует уведомление о пополнении карты."""
    amount = operation.amount
    return (
        f"<b>Карта пополнена</b>\n\n"
        f"Карта: ****{card_last4}\n"
        f"Сумма: <b>{amount} {currency_symbol}</b>"
    )


def format_card_close_notification(card_last4: str) -> str:
    """Форматирует уведомление о закрытии карты."""
    return f"<b>Карта ****{card_last4} закрыта</b>\n\nОстаток возвращён на основной баланс."


def format_card_block_notification(card_last4: str) -> str:
    """Форматирует уведомление о блокировке карты."""
    return f"<b>Карта ****{card_last4} заблокирована</b>"


def format_card_restore_notification(card_last4: str) -> str:
    """Форматирует уведомление о разблокировке карты."""
    return f"<b>Карта ****{card_last4} разблокирована</b>"


def format_withdraw_notification(operation: Operation, currency_symbol: str) -> str:
    """Форматирует уведомление о выводе средств."""
    amount = operation.amount
    fee = operation.fee

    op_data = operation.data or {}
    address = ""
    if isinstance(op_data, dict):
        address = op_data.get("address", operation.account_data or "")
    addr_short = (
        f"{address[:6]}...{address[-4:]}"
        if address and len(address) > 10
        else address or "—"
    )

    lines = [
        "<b>Вывод выполнен</b>\n",
        f"Сумма: <b>{amount} {currency_symbol}</b>",
    ]
    if fee:
        lines.append(f"Комиссия: {fee} {currency_symbol}")
    lines.append(f"Адрес: <code>{addr_short}</code>")
    lines.append("\nСтатус: Завершено")
    return "\n".join(lines)


def format_operation_failed_notification(operation: Operation, kind_label: str) -> str:
    """Форматирует уведомление о неудавшейся операции."""
    op_data = operation.data or {}
    error = ""
    if isinstance(op_data, dict):
        gate = op_data.get("gate", {})
        if isinstance(gate, dict):
            result = gate.get("result", {})
            if isinstance(result, dict):
                error = result.get("error", "")
    reason = f"\nПричина: {error[:100]}" if error else ""
    return (
        f"<b>❌ Операция не выполнена</b>\n\n"
        f"Тип: {kind_label}{reason}\n\n"
        f"Средства возвращены на баланс. "
        f"Попробуйте повторить позже или обратитесь в поддержку."
    )


# ── Отправка уведомления по операции ──────────────────────


KIND_LABELS = {
    OperationKind.DEPOSIT: "Депозит",
    OperationKind.WITHDRAW: "Вывод",
    OperationKind.CARD_OPEN: "Выпуск карты",
    OperationKind.CARD_TOPUP: "Пополнение карты",
    OperationKind.CARD_CLOSE: "Закрытие карты",
    OperationKind.CARD_BLOCK: "Блокировка карты",
    OperationKind.CARD_RESTORE: "Разблокировка карты",
}


async def notify_operation(operation: Operation) -> bool:
    """Отправляет уведомление клиенту по завершённой операции.

    Returns:
        True если уведомление отправлено.
    """
    await operation.fetch_related("client", "account", "currency")
    client = operation.client
    account = operation.account

    if not client.telegram_id:
        logger.warning("Client %s has no telegram_id", client.pk)
        return False

    currency_symbol = (
        operation.currency.symbol or operation.currency.code
        if operation.currency
        else "USDT"
    )
    kind = OperationKind(operation.kind)

    text = None

    # FAILED — универсальное уведомление об ошибке
    if operation.status == Operation.Status.FAILED:
        kind_label = KIND_LABELS.get(kind, kind.value)
        text = format_operation_failed_notification(operation, kind_label)

    elif kind == OperationKind.WITHDRAW:
        text = format_withdraw_notification(operation, currency_symbol)

    elif kind == OperationKind.DEPOSIT:
        text = format_deposit_notification(operation, currency_symbol)

    elif kind == OperationKind.CARD_OPEN:
        card_last4 = "****"
        op_data = operation.data or {}
        if isinstance(op_data, dict):
            gate_result = op_data.get("gate", {}).get("result", {})
            sensitive = gate_result.get("sensitive", {})
            card_number = sensitive.get("card_number", "")
            if card_number and len(card_number) >= 4:
                card_last4 = card_number[-4:]
        text = format_card_open_notification(operation, card_last4, currency_symbol)

    elif kind == OperationKind.CARD_TOPUP:
        card_last4 = _get_card_last4_from_account(account)
        text = format_card_topup_notification(operation, card_last4, currency_symbol)

    elif kind == OperationKind.CARD_CLOSE:
        card_last4 = _get_card_last4_from_account(account)
        text = format_card_close_notification(card_last4)

    elif kind == OperationKind.CARD_BLOCK:
        card_last4 = _get_card_last4_from_account(account)
        text = format_card_block_notification(card_last4)

    elif kind == OperationKind.CARD_RESTORE:
        card_last4 = _get_card_last4_from_account(account)
        text = format_card_restore_notification(card_last4)

    if not text:
        logger.debug(
            "No notification text for operation %s kind=%s", operation.pk, kind
        )
        return False

    return await send_telegram_message(client.telegram_id, text)


def _get_card_last4_from_account(account: Account) -> str:
    """Извлекает последние 4 цифры карты из Account.credentials."""
    creds = account.credentials or {}
    card_number = creds.get("card_number", "")
    if card_number and len(card_number) >= 4:
        return card_number[-4:]
    return "****"
