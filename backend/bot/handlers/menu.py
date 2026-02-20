"""
Хэндлер главного меню бота.
"""

import logging

from telegram import Update
from telegram.ext import ContextTypes

from bot.keyboards import main_menu_keyboard, CB_BACK_MENU
from bot.utils import get_client_by_telegram_id

logger = logging.getLogger("bot.menu")


async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показывает главное меню. Вызывается после /start или по кнопке «Назад»."""
    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        await update.effective_chat.send_message(
            "Пожалуйста, используйте /start для регистрации."
        )
        return

    text = f"Привет, <b>{client.name}</b>!\n\nВыберите действие:"
    keyboard = main_menu_keyboard()

    # Если вызвано из callback — редактируем сообщение
    if update.callback_query:
        await update.callback_query.answer()
        try:
            await update.callback_query.edit_message_text(
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


async def back_to_menu_callback(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Обработчик кнопки «Назад в меню»."""
    await show_main_menu(update, context)
