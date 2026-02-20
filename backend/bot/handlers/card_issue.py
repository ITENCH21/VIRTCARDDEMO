"""
Хэндлер выпуска карты — ConversationHandler.

Флоу:
1. Пользователь нажимает «Выпустить карту»
2. Бот спрашивает сумму
3. Бот показывает расчёт (сумма + комиссия) и просит подтверждение
4. При подтверждении — создаёт операцию
"""

import logging
from decimal import Decimal, InvalidOperation

from telegram import Update
from telegram.ext import (
    ContextTypes,
    ConversationHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
)

from bot.keyboards import (
    CB_ISSUE_CARD,
    CB_CONFIRM_YES,
    CB_CONFIRM_NO,
    CB_BACK_MENU,
    ISSUE_AMOUNT,
    ISSUE_NAME,
    ISSUE_CONFIRM,
    confirm_keyboard,
    back_to_menu_keyboard,
)
from bot.utils import get_client_by_telegram_id, format_amount
from services.card_service import (
    estimate_card_open,
    issue_card,
    CardServiceError,
    InsufficientFundsError,
    NoTarifError,
)

logger = logging.getLogger("bot.card_issue")


async def start_issue(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Начало флоу выпуска карты — запрос суммы."""
    query = update.callback_query
    if query:
        await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return ConversationHandler.END

    text = (
        "<b>💳 Выпуск виртуальной карты</b>\n\n"
        "Введите сумму в USDT для зачисления на карту:"
    )

    if query:
        await query.edit_message_text(text=text, parse_mode="HTML")
    else:
        await update.effective_chat.send_message(text=text, parse_mode="HTML")

    return ISSUE_AMOUNT


async def receive_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Получение суммы, расчёт комиссии, запрос подтверждения."""
    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return ConversationHandler.END

    text_input = update.message.text.strip().replace(",", ".")

    try:
        amount = Decimal(text_input)
    except (InvalidOperation, ValueError):
        await update.message.reply_text(
            "Некорректная сумма. Введите число (например, 100 или 50.5):"
        )
        return ISSUE_AMOUNT

    if amount <= 0:
        await update.message.reply_text(
            "Сумма должна быть положительной. Введите ещё раз:"
        )
        return ISSUE_AMOUNT

    try:
        estimate = await estimate_card_open(client, amount)
    except InsufficientFundsError as e:
        await update.message.reply_text(
            f"❌ {e}\n\nВведите меньшую сумму или пополните баланс.",
            reply_markup=back_to_menu_keyboard(),
        )
        return ConversationHandler.END
    except NoTarifError:
        await update.message.reply_text(
            "❌ Тариф на выпуск карт не настроен. Обратитесь в поддержку.",
            reply_markup=back_to_menu_keyboard(),
        )
        return ConversationHandler.END
    except CardServiceError as e:
        await update.message.reply_text(
            f"❌ Ошибка: {e}",
            reply_markup=back_to_menu_keyboard(),
        )
        return ConversationHandler.END

    currency = estimate["currency"]
    symbol = currency.symbol or currency.code
    precision = currency.human_denominator or 2

    # Сохраняем в context для подтверждения
    context.user_data["issue_amount"] = amount
    context.user_data["issue_estimate"] = {
        "amount": float(estimate["amount"]),
        "fee": float(estimate["fee"]),
        "total": float(estimate["total"]),
    }

    text = (
        f"<b>💳 Подтверждение выпуска карты</b>\n\n"
        f"Сумма на карту: <b>{estimate['amount']:.{precision}f} {symbol}</b>\n"
        f"Комиссия: <b>{estimate['fee']:.{precision}f} {symbol}</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"Итого списание: <b>{estimate['total']:.{precision}f} {symbol}</b>\n\n"
        f"Подтвердите выпуск карты:"
    )

    await update.message.reply_text(
        text=text,
        reply_markup=confirm_keyboard(),
        parse_mode="HTML",
    )
    return ISSUE_CONFIRM


async def confirm_issue(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Подтверждение выпуска карты."""
    query = update.callback_query
    await query.answer()

    if query.data == CB_CONFIRM_NO:
        await query.edit_message_text(
            "❌ Выпуск карты отменён.",
            reply_markup=back_to_menu_keyboard(),
        )
        return ConversationHandler.END

    # CB_CONFIRM_YES
    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return ConversationHandler.END

    amount = context.user_data.get("issue_amount")
    if not amount:
        await query.edit_message_text(
            "Ошибка: данные потеряны. Попробуйте снова.",
            reply_markup=back_to_menu_keyboard(),
        )
        return ConversationHandler.END

    try:
        await issue_card(client, amount)
        await query.edit_message_text(
            "⏳ <b>Карта выпускается...</b>\n\n"
            "Вы получите уведомление когда карта будет готова.",
            reply_markup=back_to_menu_keyboard(),
            parse_mode="HTML",
        )
    except InsufficientFundsError as e:
        await query.edit_message_text(
            f"❌ {e}",
            reply_markup=back_to_menu_keyboard(),
        )
    except CardServiceError as e:
        await query.edit_message_text(
            f"❌ Ошибка: {e}",
            reply_markup=back_to_menu_keyboard(),
        )

    # Очищаем context
    context.user_data.pop("issue_amount", None)
    context.user_data.pop("issue_estimate", None)

    return ConversationHandler.END


async def cancel_issue(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Отмена выпуска карты."""
    context.user_data.pop("issue_amount", None)
    context.user_data.pop("issue_estimate", None)

    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.edit_message_text(
            "❌ Выпуск карты отменён.",
            reply_markup=back_to_menu_keyboard(),
        )
    else:
        await update.effective_chat.send_message(
            "❌ Выпуск карты отменён.",
            reply_markup=back_to_menu_keyboard(),
        )
    return ConversationHandler.END


def get_issue_card_conversation() -> ConversationHandler:
    """Возвращает ConversationHandler для выпуска карты."""
    return ConversationHandler(
        entry_points=[
            CallbackQueryHandler(start_issue, pattern=f"^{CB_ISSUE_CARD}$"),
        ],
        states={
            ISSUE_AMOUNT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_amount),
            ],
            ISSUE_CONFIRM: [
                CallbackQueryHandler(
                    confirm_issue, pattern=f"^({CB_CONFIRM_YES}|{CB_CONFIRM_NO})$"
                ),
            ],
        },
        fallbacks=[
            CallbackQueryHandler(cancel_issue, pattern=f"^{CB_BACK_MENU}$"),
            MessageHandler(filters.COMMAND, cancel_issue),
        ],
        per_user=True,
        per_chat=True,
    )
