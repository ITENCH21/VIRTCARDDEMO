import logging
import os

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("vc-bot")


def _get_token() -> str:
    token = os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("BOT_TOKEN")
    if not token:
        raise RuntimeError(
            "Missing TELEGRAM_BOT_TOKEN (or BOT_TOKEN) environment variable."
        )
    return token


async def start(update: Update) -> None:
    if update.effective_chat:
        await update.effective_chat.send_message(
            "Привет! Я бот сервиса. Напишите сообщение, и я его повторю."
        )


async def help_command(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat:
        await update.effective_chat.send_message(
            "Доступные команды: /start, /help. Сообщения будут эхо."
        )


async def echo(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_message and update.effective_chat:
        await update.effective_chat.send_message(update.effective_message.text or "")


def main() -> None:
    token = _get_token()
    app = Application.builder().token(token).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))

    logger.info("Bot started")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
