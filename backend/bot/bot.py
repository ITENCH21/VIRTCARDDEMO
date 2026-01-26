import asyncio
import logging
import os

from models import start_orm
from telegram import Update
from tortoise import timezone
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)
from models.models import Client
from .register import get_or_create_client


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("vc-bot")


token = os.environ["TELEGRAM_BOT_TOKEN"]


async def start(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    client: Client = await get_or_create_client(
        telegram_id=update.effective_user.id,
        first_name=update.effective_user.first_name,
        last_name=update.effective_user.last_name,
        # email=update.effective_chat.email,
        # phone=update.effective_user.phone,
        username=update.effective_user.username,
        telegram_language_code=update.effective_user.language_code,
        # telegram_photo_url=update.effective_user.photo_url,
        telegram_auth_date=timezone.now(),
    )
    logger.info("Client: %s", client)
    await update.effective_chat.send_message(
        f"Привет, {client.name}! Добро пожаловать в сервис."
    )


async def echo(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_message and update.effective_chat:
        await update.effective_chat.send_message(update.effective_message.text or "")


def main() -> None:
    app = Application.builder().token(token).build()
    asyncio.run(start_orm())
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))

    logger.info("Bot started")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
