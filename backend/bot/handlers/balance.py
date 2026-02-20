"""
Хэндлер просмотра баланса.
"""

import logging
from decimal import Decimal

from telegram import Update
from telegram.ext import ContextTypes

from bot.keyboards import balance_keyboard, CB_BALANCE, CB_REFRESH_BALANCE
from bot.utils import get_client_by_telegram_id, format_amount
from services.balance_service import get_client_accounts, get_available_balance_human
from models.models import amount_db_to_human

logger = logging.getLogger("bot.balance")


async def show_balance(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показывает баланс по всем аккаунтам клиента."""
    query = update.callback_query
    if query:
        await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return

    accounts = await get_client_accounts(client)

    if not accounts:
        text = "У вас пока нет аккаунтов."
    else:
        lines = ["<b>💰 Ваш баланс</b>\n"]
        for acc in accounts:
            currency = acc.currency
            balance = amount_db_to_human(acc.amount_db or 0, currency)
            holded = amount_db_to_human(acc.amount_holded_db or 0, currency)
            available = balance - holded

            symbol = currency.symbol or currency.code
            precision = currency.human_denominator or 2

            line = f"<b>{currency.code}</b>: {available:.{precision}f} {symbol}"
            if holded > 0:
                line += f"  (холд: {holded:.{precision}f})"

            # Показываем адрес кошелька если есть
            if acc.address:
                line += f"\n   <code>{acc.address}</code>"
            elif currency.kind == "C":
                line += "\n   ⏳ Кошелёк создаётся..."

            lines.append(line)

        text = "\n".join(lines)

    keyboard = balance_keyboard()

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
