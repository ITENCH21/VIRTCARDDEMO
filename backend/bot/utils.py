"""
Утилиты для Telegram-бота: форматирование, QR-коды, общие хелперы.
"""

import io
import logging
from decimal import Decimal
from typing import Optional

from models.models import Account, Client, Currency, Operation, amount_db_to_human
from models.enums import OperationKind
from tortoise.exceptions import DoesNotExist

logger = logging.getLogger("bot.utils")


# ── Получение клиента ──────────────────────────────────────


async def get_client_by_telegram_id(telegram_id: int) -> Optional[Client]:
    """Возвращает клиента по telegram_id."""
    try:
        return await Client.get(telegram_id=telegram_id)
    except DoesNotExist:
        return None


# ── QR-код ─────────────────────────────────────────────────


def generate_qr_code(data: str) -> io.BytesIO:
    """Генерирует QR-код и возвращает как BytesIO (PNG).

    Использует segno (если доступен) или qrcode.
    """
    buf = io.BytesIO()
    try:
        import segno

        qr = segno.make(data)
        qr.save(buf, kind="png", scale=8, border=2)
    except ImportError:
        try:
            import qrcode

            qr = qrcode.make(data)
            qr.save(buf, format="PNG")
        except ImportError:
            logger.warning(
                "Neither segno nor qrcode installed, QR generation unavailable"
            )
            return None
    buf.seek(0)
    return buf


# ── Форматирование ─────────────────────────────────────────


def format_amount(amount: Decimal, currency: Currency) -> str:
    """Форматирует сумму с символом валюты."""
    precision = currency.human_denominator or 2
    formatted = f"{amount:.{precision}f}"
    symbol = currency.symbol or currency.code
    return f"{formatted} {symbol}"


def format_operation_kind(kind: str) -> str:
    """Возвращает человекочитаемое название типа операции."""
    kind_map = {
        OperationKind.DEPOSIT: "Пополнение",
        OperationKind.WITHDRAW: "Вывод",
        OperationKind.CARD_OPEN: "Выпуск карты",
        OperationKind.CARD_TOPUP: "Пополнение карты",
        OperationKind.CARD_CLOSE: "Закрытие карты",
        OperationKind.CARD_BLOCK: "Блокировка карты",
        OperationKind.CARD_RESTORE: "Разблокировка карты",
        OperationKind.SERVICE: "Сервисная",
        OperationKind.SYSTEM: "Системная",
        OperationKind.ADJUSTMENT: "Корректировка",
    }
    return kind_map.get(kind, kind)


def format_operation_status(status: str) -> str:
    """Возвращает человекочитаемый статус операции."""
    status_map = {
        Operation.Status.PENDING: "⏳ Ожидание",
        Operation.Status.OPERATING: "🔄 Обработка",
        Operation.Status.COMPLETE: "✅ Завершена",
        Operation.Status.FAILED: "❌ Ошибка",
        Operation.Status.UNKNOWN: "❓ Неизвестно",
    }
    return status_map.get(status, status)


def format_card_status(status: str) -> str:
    """Возвращает человекочитаемый статус карты."""
    status_map = {
        Account.Status.ACTIVE: "🟢 Активна",
        Account.Status.RESTORED: "🟢 Активна",
        Account.Status.BLOCKED: "🔴 Заблокирована",
        Account.Status.CLOSED: "⚫ Закрыта",
        Account.Status.DRAFT: "🟡 Создаётся",
        Account.Status.BANNED: "🔴 Заблокирована",
    }
    return status_map.get(status, status)
