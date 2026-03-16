"""
Хэндлер входа в Личный кабинет через magic-link.
"""

import asyncio
import logging
import os
import secrets

import redis.asyncio as aioredis
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from bot.keyboards import CB_LK_LOGIN
from bot.utils import get_client_by_telegram_id

logger = logging.getLogger("bot.lk_login")

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
SITE_URL = os.getenv("SITE_URL", "http://localhost").rstrip("/")

MAGIC_LINK_TTL = 3600  # 1 час

_redis = None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            password=REDIS_PASSWORD or None,
            db=1,
            decode_responses=True,
        )
    return _redis


async def _delete_message_later(message, delay: int) -> None:
    """Удаляет сообщение после задержки."""
    try:
        await asyncio.sleep(delay)
        await message.delete()
    except Exception:
        logger.debug("Could not delete magic-link message")


async def handle_lk_login(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Генерирует magic-link для входа в ЛК и отправляет inline-кнопку."""
    query = update.callback_query
    if query:
        await query.answer()

    client = await get_client_by_telegram_id(update.effective_user.id)
    if not client:
        await update.effective_chat.send_message(
            "Пожалуйста, используйте /start для регистрации."
        )
        return

    # Генерируем токен и сохраняем в Redis
    token = secrets.token_urlsafe(48)
    r = await _get_redis()
    await r.setex(f"magic_link:{token}", MAGIC_LINK_TTL, str(client.pk))

    link = f"{SITE_URL}/lk/auth?token={token}"

    # Telegram не принимает http:// в inline URL-кнопках — только https://
    if link.startswith("https://"):
        text = (
            "🔗 <b>Ссылка для входа в Личный кабинет</b>\n\n"
            "Нажмите кнопку ниже, чтобы открыть ЛК в браузере.\n"
            "Ссылка действительна <b>1 час</b>."
        )
        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton("🖥 Открыть ЛК", url=link)]]
        )
        msg = await update.effective_chat.send_message(
            text=text,
            reply_markup=keyboard,
            parse_mode="HTML",
        )
    else:
        # Для локальной разработки (http://localhost) — ссылка plain text
        text = (
            "🔗 <b>Ссылка для входа в Личный кабинет</b>\n\n"
            f"<code>{link}</code>\n\n"
            "⬆️ Нажмите чтобы скопировать, откройте в браузере.\n"
            "Ссылка действительна <b>1 час</b>."
        )
        msg = await update.effective_chat.send_message(
            text=text,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )

    # Планируем удаление сообщения через 1 час
    asyncio.create_task(_delete_message_later(msg, MAGIC_LINK_TTL))
