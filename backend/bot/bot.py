import asyncio
import logging
import os

from models import start_orm
from telegram import Update
from tortoise import timezone
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
    MessageHandler,
    filters,
)
from models.models import Client
from .register import get_or_create_client

# Handlers
from .handlers.menu import show_main_menu, back_to_menu_callback
from .handlers.balance import show_balance
from .handlers.deposit import show_deposit
from .handlers.card_issue import get_issue_card_conversation
from .handlers.cards import (
    show_cards_list,
    show_card_info,
    show_card_details,
    handle_block_card,
    handle_restore_card,
    handle_close_card_ask,
    handle_close_card_confirm,
    get_topup_card_conversation,
)
from .handlers.history import show_history, history_page_callback

# Keyboard constants
from .keyboards import (
    CB_BALANCE,
    CB_REFRESH_BALANCE,
    CB_DEPOSIT,
    CB_ISSUE_CARD,
    CB_MY_CARDS,
    CB_HISTORY,
    CB_BACK_MENU,
    CB_CARD_PREFIX,
    CB_CARD_DETAILS,
    CB_CARD_BLOCK,
    CB_CARD_RESTORE,
    CB_CARD_CLOSE,
    CB_CARD_CLOSE_CONFIRM,
    CB_HISTORY_PREV,
    CB_HISTORY_NEXT,
    main_menu_keyboard,
)


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("vc-bot")


token = os.environ["TELEGRAM_BOT_TOKEN"]


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    referral_code = context.args[0] if context.args else ""
    client: Client = await get_or_create_client(
        telegram_id=update.effective_user.id,
        first_name=update.effective_user.first_name,
        last_name=update.effective_user.last_name,
        username=update.effective_user.username,
        referral_code=referral_code,
        telegram_language_code=update.effective_user.language_code,
        telegram_auth_date=timezone.now(),
    )
    logger.info("Client: %s", client)

    # Показываем главное меню после регистрации
    text = f"Привет, <b>{client.name}</b>!\n\nВыберите действие:"
    await update.effective_chat.send_message(
        text=text,
        reply_markup=main_menu_keyboard(),
        parse_mode="HTML",
    )


def main() -> None:
    app = Application.builder().token(token).build()
    asyncio.run(start_orm())

    # ── /start ────────────────────────────────────────────
    app.add_handler(CommandHandler("start", start))

    # ── ConversationHandlers (должны идти ПЕРЕД простыми callback handlers) ──
    app.add_handler(get_issue_card_conversation())
    app.add_handler(get_topup_card_conversation())

    # ── Главное меню ──────────────────────────────────────
    app.add_handler(
        CallbackQueryHandler(back_to_menu_callback, pattern=f"^{CB_BACK_MENU}$")
    )

    # ── Баланс ────────────────────────────────────────────
    app.add_handler(
        CallbackQueryHandler(
            show_balance, pattern=f"^({CB_BALANCE}|{CB_REFRESH_BALANCE})$"
        )
    )

    # ── Пополнение ────────────────────────────────────────
    app.add_handler(CallbackQueryHandler(show_deposit, pattern=f"^{CB_DEPOSIT}$"))

    # ── Мои карты ─────────────────────────────────────────
    app.add_handler(CallbackQueryHandler(show_cards_list, pattern=f"^{CB_MY_CARDS}$"))
    app.add_handler(CallbackQueryHandler(show_card_info, pattern=f"^{CB_CARD_PREFIX}"))
    app.add_handler(
        CallbackQueryHandler(show_card_details, pattern=f"^{CB_CARD_DETAILS}")
    )
    app.add_handler(
        CallbackQueryHandler(handle_block_card, pattern=f"^{CB_CARD_BLOCK}")
    )
    app.add_handler(
        CallbackQueryHandler(handle_restore_card, pattern=f"^{CB_CARD_RESTORE}")
    )
    app.add_handler(
        CallbackQueryHandler(handle_close_card_ask, pattern=f"^{CB_CARD_CLOSE}")
    )
    app.add_handler(
        CallbackQueryHandler(
            handle_close_card_confirm, pattern=f"^{CB_CARD_CLOSE_CONFIRM}"
        )
    )

    # ── История ───────────────────────────────────────────
    app.add_handler(CallbackQueryHandler(show_history, pattern=f"^{CB_HISTORY}$"))
    app.add_handler(
        CallbackQueryHandler(
            history_page_callback, pattern=f"^({CB_HISTORY_PREV}|{CB_HISTORY_NEXT})"
        )
    )

    logger.info("Bot started with full menu")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
