"""
Хэндлер управления картами — список, детали, пополнение, блокировка, закрытие.
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
    CB_MY_CARDS,
    CB_CARD_PREFIX,
    CB_CARD_DETAILS,
    CB_CARD_TOPUP,
    CB_CARD_BLOCK,
    CB_CARD_RESTORE,
    CB_CARD_CLOSE,
    CB_CARD_CLOSE_CONFIRM,
    CB_BACK_MENU,
    CB_CONFIRM_YES,
    CB_CONFIRM_NO,
    TOPUP_AMOUNT,
    TOPUP_CONFIRM,
    card_list_keyboard,
    card_detail_keyboard,
    card_close_confirm_keyboard,
    confirm_keyboard,
    back_to_menu_keyboard,
)
from bot.utils import (
    get_client_by_telegram_id,
    format_amount,
    format_card_status,
)
from services.card_service import (
    get_client_cards,
    get_card_by_id,
    get_card_display_name,
    get_card_last4,
    topup_card,
    block_card,
    restore_card,
    close_card,
    estimate_card_topup,
    CardServiceError,
    InsufficientFundsError,
)
from models.models import amount_db_to_human

logger = logging.getLogger("bot.cards")


# ── Список карт ───────────────────────────────────────────


async def show_cards_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показывает список всех карт клиента."""
    query = update.callback_query
    if query:
        await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return

    cards = await get_client_cards(client)

    if not cards:
        text = "У вас пока нет карт.\n\nВыпустите первую карту!"
    else:
        text = f"<b>🗂 Ваши карты ({len(cards)})</b>\n\nВыберите карту для управления:"

    keyboard = card_list_keyboard(cards)

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


# ── Детали карты ──────────────────────────────────────────


async def show_card_info(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показывает информацию о карте (без чувствительных данных)."""
    query = update.callback_query
    await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return

    card_id = query.data.replace(CB_CARD_PREFIX, "")

    try:
        card = await get_card_by_id(client, card_id)
    except CardServiceError as e:
        await query.edit_message_text(f"❌ {e}", reply_markup=back_to_menu_keyboard())
        return

    currency = card.currency
    symbol = currency.symbol or currency.code
    precision = currency.human_denominator or 2
    balance = amount_db_to_human(card.amount_db or 0, currency)
    status_text = format_card_status(card.status)
    name = card.name or "Карта"
    last4 = get_card_last4(card)

    text = (
        f"<b>💳 {name} ****{last4}</b>\n\n"
        f"Статус: {status_text}\n"
        f"Баланс: <b>{balance:.{precision}f} {symbol}</b>\n"
    )

    if card.created_at:
        text += f"Создана: {card.created_at.strftime('%d.%m.%Y %H:%M')}\n"

    keyboard = card_detail_keyboard(card)
    await query.edit_message_text(text=text, reply_markup=keyboard, parse_mode="HTML")


# ── Показ чувствительных данных ───────────────────────────


async def show_card_details(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показывает полные данные карты (PAN, CVV, expiry) спойлером."""
    query = update.callback_query
    await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return

    card_id = query.data.replace(CB_CARD_DETAILS, "")

    try:
        card = await get_card_by_id(client, card_id)
    except CardServiceError as e:
        await query.edit_message_text(f"❌ {e}", reply_markup=back_to_menu_keyboard())
        return

    creds = card.credentials or {}
    card_number = creds.get("card_number", "Не доступен")
    cvv = creds.get("cvv", "***")
    expiry_month = creds.get("expiry_month", "??")
    expiry_year = creds.get("expiry_year", "??")

    # Форматируем номер карты с пробелами
    if len(card_number) == 16:
        formatted_number = " ".join(card_number[i:i + 4] for i in range(0, 16, 4))
    else:
        formatted_number = card_number

    text = (
        f"<b>💳 Данные карты</b>\n\n"
        f"Номер: <tg-spoiler>{formatted_number}</tg-spoiler>\n"
        f"Срок: <tg-spoiler>{expiry_month}/{expiry_year}</tg-spoiler>\n"
        f"CVV: <tg-spoiler>{cvv}</tg-spoiler>\n\n"
        f"⚠️ Не передавайте данные карты третьим лицам."
    )

    keyboard = card_detail_keyboard(card)
    await query.edit_message_text(text=text, reply_markup=keyboard, parse_mode="HTML")


# ── Блокировка карты ──────────────────────────────────────


async def handle_block_card(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Блокирует карту."""
    query = update.callback_query
    await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return

    card_id = query.data.replace(CB_CARD_BLOCK, "")

    try:
        await block_card(client, card_id)
        await query.edit_message_text(
            "🔒 Карта заблокирована.\n\nВы можете разблокировать её в списке карт.",
            reply_markup=back_to_menu_keyboard(),
        )
    except CardServiceError as e:
        await query.edit_message_text(f"❌ {e}", reply_markup=back_to_menu_keyboard())


# ── Восстановление карты ─────────────────────────────────


async def handle_restore_card(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Восстанавливает заблокированную карту."""
    query = update.callback_query
    await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return

    card_id = query.data.replace(CB_CARD_RESTORE, "")

    try:
        await restore_card(client, card_id)
        await query.edit_message_text(
            "🔓 Карта разблокирована.",
            reply_markup=back_to_menu_keyboard(),
        )
    except CardServiceError as e:
        await query.edit_message_text(f"❌ {e}", reply_markup=back_to_menu_keyboard())


# ── Закрытие карты ────────────────────────────────────────


async def handle_close_card_ask(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Запрос подтверждения закрытия карты."""
    query = update.callback_query
    await query.answer()

    card_id = query.data.replace(CB_CARD_CLOSE, "")

    await query.edit_message_text(
        "⚠️ <b>Вы уверены?</b>\n\n"
        "Закрытие карты необратимо. Остаток будет возвращён на основной баланс.",
        reply_markup=card_close_confirm_keyboard(card_id),
        parse_mode="HTML",
    )


async def handle_close_card_confirm(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Подтверждение закрытия карты."""
    query = update.callback_query
    await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return

    card_id = query.data.replace(CB_CARD_CLOSE_CONFIRM, "")

    try:
        await close_card(client, card_id)
        await query.edit_message_text(
            "⚫ Карта закрывается...\n\nОстаток будет возвращён на основной баланс.",
            reply_markup=back_to_menu_keyboard(),
        )
    except CardServiceError as e:
        await query.edit_message_text(f"❌ {e}", reply_markup=back_to_menu_keyboard())


# ── Пополнение карты (ConversationHandler) ────────────────


async def start_topup(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Начало пополнения карты — запрос суммы."""
    query = update.callback_query
    await query.answer()

    card_id = query.data.replace(CB_CARD_TOPUP, "")
    context.user_data["topup_card_id"] = card_id

    await query.edit_message_text(
        "<b>📥 Пополнение карты</b>\n\nВведите сумму в USDT:",
        parse_mode="HTML",
    )
    return TOPUP_AMOUNT


async def receive_topup_amount(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Получение суммы пополнения."""
    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return ConversationHandler.END

    text_input = update.message.text.strip().replace(",", ".")
    card_id = context.user_data.get("topup_card_id")

    try:
        amount = Decimal(text_input)
    except (InvalidOperation, ValueError):
        await update.message.reply_text("Некорректная сумма. Введите число:")
        return TOPUP_AMOUNT

    if amount <= 0:
        await update.message.reply_text("Сумма должна быть положительной:")
        return TOPUP_AMOUNT

    try:
        estimate = await estimate_card_topup(client, card_id, amount)
    except InsufficientFundsError as e:
        await update.message.reply_text(f"❌ {e}", reply_markup=back_to_menu_keyboard())
        return ConversationHandler.END
    except CardServiceError as e:
        await update.message.reply_text(f"❌ {e}", reply_markup=back_to_menu_keyboard())
        return ConversationHandler.END

    context.user_data["topup_amount"] = amount

    currency = estimate["currency"]
    symbol = currency.symbol or currency.code
    precision = currency.human_denominator or 2

    text = (
        f"<b>📥 Подтверждение пополнения</b>\n\n"
        f"Сумма: <b>{estimate['amount']:.{precision}f} {symbol}</b>\n"
        f"Комиссия: <b>{estimate['fee']:.{precision}f} {symbol}</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"Итого: <b>{estimate['total']:.{precision}f} {symbol}</b>\n\n"
        f"Подтвердить?"
    )

    await update.message.reply_text(
        text=text, reply_markup=confirm_keyboard(), parse_mode="HTML"
    )
    return TOPUP_CONFIRM


async def confirm_topup(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Подтверждение пополнения карты."""
    query = update.callback_query
    await query.answer()

    if query.data == CB_CONFIRM_NO:
        await query.edit_message_text(
            "❌ Пополнение отменено.", reply_markup=back_to_menu_keyboard()
        )
        return ConversationHandler.END

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return ConversationHandler.END

    card_id = context.user_data.get("topup_card_id")
    amount = context.user_data.get("topup_amount")

    if not card_id or not amount:
        await query.edit_message_text(
            "Ошибка. Попробуйте снова.", reply_markup=back_to_menu_keyboard()
        )
        return ConversationHandler.END

    try:
        await topup_card(client, card_id, amount)
        await query.edit_message_text(
            "⏳ <b>Пополнение обрабатывается...</b>",
            reply_markup=back_to_menu_keyboard(),
            parse_mode="HTML",
        )
    except CardServiceError as e:
        await query.edit_message_text(f"❌ {e}", reply_markup=back_to_menu_keyboard())

    context.user_data.pop("topup_card_id", None)
    context.user_data.pop("topup_amount", None)
    return ConversationHandler.END


async def cancel_topup(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Отмена пополнения."""
    context.user_data.pop("topup_card_id", None)
    context.user_data.pop("topup_amount", None)
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.edit_message_text(
            "❌ Пополнение отменено.", reply_markup=back_to_menu_keyboard()
        )
    return ConversationHandler.END


def get_topup_card_conversation() -> ConversationHandler:
    """Возвращает ConversationHandler для пополнения карты."""
    return ConversationHandler(
        entry_points=[
            CallbackQueryHandler(start_topup, pattern=f"^{CB_CARD_TOPUP}"),
        ],
        states={
            TOPUP_AMOUNT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_topup_amount),
            ],
            TOPUP_CONFIRM: [
                CallbackQueryHandler(
                    confirm_topup, pattern=f"^({CB_CONFIRM_YES}|{CB_CONFIRM_NO})$"
                ),
            ],
        },
        fallbacks=[
            CallbackQueryHandler(cancel_topup, pattern=f"^{CB_BACK_MENU}$"),
            MessageHandler(filters.COMMAND, cancel_topup),
        ],
        per_user=True,
        per_chat=True,
    )
