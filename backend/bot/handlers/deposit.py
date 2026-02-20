"""
Хэндлер пополнения — показ адреса кошелька и QR-кода.
"""

import logging

from telegram import Update, InputFile
from telegram.ext import ContextTypes

from bot.keyboards import deposit_keyboard, CB_DEPOSIT
from bot.utils import get_client_by_telegram_id, generate_qr_code
from services.balance_service import get_crypto_account

logger = logging.getLogger("bot.deposit")


async def show_deposit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показывает адрес кошелька для пополнения + QR-код."""
    query = update.callback_query
    if query:
        await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        return

    account = await get_crypto_account(client)
    keyboard = deposit_keyboard()

    if not account:
        text = (
            "USDT-TRC20 аккаунт не найден. Попробуйте /start для повторной регистрации."
        )
        if query:
            await query.edit_message_text(
                text=text, reply_markup=keyboard, parse_mode="HTML"
            )
        else:
            await update.effective_chat.send_message(
                text=text, reply_markup=keyboard, parse_mode="HTML"
            )
        return

    address = account.address
    if not address:
        text = (
            "⏳ <b>Кошелёк создаётся</b>\n\n"
            "Подождите немного, адрес для пополнения появится в течение минуты.\n"
            "Нажмите «Баланс» чтобы проверить."
        )
        if query:
            await query.edit_message_text(
                text=text, reply_markup=keyboard, parse_mode="HTML"
            )
        else:
            await update.effective_chat.send_message(
                text=text, reply_markup=keyboard, parse_mode="HTML"
            )
        return

    text = (
        "<b>📥 Пополнение баланса</b>\n\n"
        "Отправьте <b>USDT (TRC-20)</b> на адрес:\n\n"
        f"<code>{address}</code>\n\n"
        "⚠️ <b>Важно:</b>\n"
        "• Отправляйте только <b>USDT</b> по сети <b>TRC-20 (TRON)</b>\n"
        "• Минимальная сумма: 1 USDT\n"
        "• Зачисление: ~1-3 минуты после подтверждения в блокчейне"
    )

    # Если callback — сначала убираем старое сообщение, потом отправляем новое с QR
    if query:
        try:
            await query.edit_message_text(
                text=text, reply_markup=keyboard, parse_mode="HTML"
            )
        except Exception:
            await update.effective_chat.send_message(
                text=text, reply_markup=keyboard, parse_mode="HTML"
            )

    # Отправляем QR-код отдельным сообщением
    qr_buf = generate_qr_code(address)
    if qr_buf:
        try:
            await update.effective_chat.send_photo(
                photo=InputFile(qr_buf, filename="wallet_qr.png"),
                caption=f"QR-код адреса: {address}",
            )
        except Exception:
            logger.exception("Failed to send QR code")

    if not query:
        await update.effective_chat.send_message(
            text=text, reply_markup=keyboard, parse_mode="HTML"
        )
