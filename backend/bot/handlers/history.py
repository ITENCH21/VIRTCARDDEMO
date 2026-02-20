"""
Хэндлер истории операций.
"""

import logging

from telegram import Update
from telegram.ext import ContextTypes

from bot.keyboards import (
    CB_HISTORY,
    CB_HISTORY_PREV,
    CB_HISTORY_NEXT,
    history_keyboard,
    back_to_menu_keyboard,
)
from bot.utils import (
    get_client_by_telegram_id,
    format_operation_kind,
    format_operation_status,
)
from models.models import Operation, amount_db_to_human

logger = logging.getLogger("bot.history")

PAGE_SIZE = 10


async def show_history(
    update: Update, context: ContextTypes.DEFAULT_TYPE, offset: int = 0
) -> None:
    """Показывает историю операций клиента с пагинацией."""
    query = update.callback_query
    if query:
        await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return

    # Считаем общее количество операций
    total = await Operation.filter(client=client).count()

    if total == 0:
        text = "📋 <b>История операций</b>\n\nОпераций пока нет."
        keyboard = back_to_menu_keyboard()
    else:
        operations = (
            await Operation.filter(client=client)
            .prefetch_related("currency")
            .order_by("-created_at")
            .offset(offset)
            .limit(PAGE_SIZE)
        )

        lines = [
            f"<b>📋 История операций</b> ({offset + 1}-{min(offset + PAGE_SIZE, total)} из {total})\n"
        ]

        for op in operations:
            kind_text = format_operation_kind(op.kind)
            status_text = format_operation_status(op.status)

            amount_str = ""
            if op.amount_db and op.currency:
                amount = amount_db_to_human(op.amount_db, op.currency)
                symbol = op.currency.symbol or op.currency.code
                precision = op.currency.human_denominator or 2
                amount_str = f" {amount:.{precision}f} {symbol}"

            date_str = op.created_at.strftime("%d.%m %H:%M") if op.created_at else ""

            lines.append(
                f"{status_text} <b>{kind_text}</b>{amount_str}  <i>{date_str}</i>"
            )

        text = "\n".join(lines)
        keyboard = history_keyboard(offset, total, PAGE_SIZE)

    if query:
        try:
            await query.edit_message_text(
                text=text, reply_markup=keyboard, parse_mode="HTML"
            )
        except Exception:
            await update.effective_chat.send_message(
                text=text, reply_markup=keyboard, parse_mode="HTML"
            )
    else:
        await update.effective_chat.send_message(
            text=text, reply_markup=keyboard, parse_mode="HTML"
        )


async def history_page_callback(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Обработка пагинации истории."""
    query = update.callback_query
    data = query.data

    # Извлекаем offset из callback_data
    if data.startswith(CB_HISTORY_PREV):
        offset = int(data.replace(CB_HISTORY_PREV, ""))
    elif data.startswith(CB_HISTORY_NEXT):
        offset = int(data.replace(CB_HISTORY_NEXT, ""))
    else:
        offset = 0

    await show_history(update, context, offset=offset)
