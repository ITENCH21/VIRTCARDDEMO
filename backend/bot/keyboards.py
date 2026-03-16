"""
Inline-клавиатуры для Telegram-бота.
"""

import os

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo


# ── Callback data prefixes ────────────────────────────────

# Главное меню
CB_BALANCE = "menu:balance"
CB_DEPOSIT = "menu:deposit"
CB_ISSUE_CARD = "menu:issue_card"
CB_MY_CARDS = "menu:my_cards"
CB_HISTORY = "menu:history"
CB_LK_LOGIN = "menu:lk_login"
CB_BACK_MENU = "menu:back"

# Баланс
CB_REFRESH_BALANCE = "balance:refresh"

# Карты
CB_CARD_PREFIX = "card:"  # card:<account_id>
CB_CARD_DETAILS = "card_details:"  # card_details:<account_id>
CB_CARD_TOPUP = "card_topup:"  # card_topup:<account_id>
CB_CARD_BLOCK = "card_block:"  # card_block:<account_id>
CB_CARD_RESTORE = "card_restore:"  # card_restore:<account_id>
CB_CARD_CLOSE = "card_close:"  # card_close:<account_id>

# Подтверждения
CB_CONFIRM_YES = "confirm:yes"
CB_CONFIRM_NO = "confirm:no"
CB_CARD_CLOSE_CONFIRM = "card_close_confirm:"  # card_close_confirm:<account_id>

# История
CB_HISTORY_PREV = "history:prev:"  # history:prev:<offset>
CB_HISTORY_NEXT = "history:next:"  # history:next:<offset>

# Выпуск карты (ConversationHandler states)
ISSUE_AMOUNT, ISSUE_NAME, ISSUE_CONFIRM = range(3)
TOPUP_AMOUNT, TOPUP_CONFIRM = range(10, 12)

WEBAPP_URL = os.getenv("TELEGRAM_WEBAPP_URL", "").strip()


# ── Клавиатуры ────────────────────────────────────────────


def main_menu_keyboard() -> InlineKeyboardMarkup:
    """Главное меню бота."""
    buttons = []
    buttons.append(
        [InlineKeyboardButton("🖥 Войти в ЛК", callback_data=CB_LK_LOGIN)]
    )
    if WEBAPP_URL:
        buttons.append(
            [InlineKeyboardButton("📱 Открыть приложение", web_app=WebAppInfo(WEBAPP_URL))]
        )
    buttons.extend(
        [
            [InlineKeyboardButton("💰 Баланс", callback_data=CB_BALANCE)],
            [InlineKeyboardButton("📥 Пополнить", callback_data=CB_DEPOSIT)],
            [InlineKeyboardButton("💳 Выпустить карту", callback_data=CB_ISSUE_CARD)],
            [InlineKeyboardButton("🗂 Мои карты", callback_data=CB_MY_CARDS)],
            [InlineKeyboardButton("📋 История", callback_data=CB_HISTORY)],
        ]
    )
    return InlineKeyboardMarkup(buttons)


def back_to_menu_keyboard() -> InlineKeyboardMarkup:
    """Кнопка «Назад в меню»."""
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("◀️ Меню", callback_data=CB_BACK_MENU)],
        ]
    )


def balance_keyboard() -> InlineKeyboardMarkup:
    """Клавиатура на экране баланса."""
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🔄 Обновить", callback_data=CB_REFRESH_BALANCE)],
            [InlineKeyboardButton("📥 Пополнить", callback_data=CB_DEPOSIT)],
            [InlineKeyboardButton("◀️ Меню", callback_data=CB_BACK_MENU)],
        ]
    )


def deposit_keyboard() -> InlineKeyboardMarkup:
    """Клавиатура на экране пополнения."""
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("💰 Баланс", callback_data=CB_BALANCE)],
            [InlineKeyboardButton("◀️ Меню", callback_data=CB_BACK_MENU)],
        ]
    )


def confirm_keyboard() -> InlineKeyboardMarkup:
    """Клавиатура подтверждения."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("✅ Подтвердить", callback_data=CB_CONFIRM_YES),
                InlineKeyboardButton("❌ Отмена", callback_data=CB_CONFIRM_NO),
            ],
        ]
    )


def card_list_keyboard(cards: list) -> InlineKeyboardMarkup:
    """Клавиатура со списком карт клиента.

    Args:
        cards: список Account (kind=VIRTUAL_CARD)
    """
    buttons = []
    for card in cards:
        creds = card.credentials or {}
        card_number = creds.get("card_number", "")
        last4 = card_number[-4:] if card_number and len(card_number) >= 4 else "****"
        name = card.name or "Карта"

        status_map = {
            "A": "🟢",
            "R": "🟢",
            "L": "🔴",
            "C": "⚫",
            "D": "🟡",
            "B": "🔴",
        }
        emoji = status_map.get(card.status, "⚪")

        buttons.append(
            [
                InlineKeyboardButton(
                    f"{emoji} {name} ****{last4}",
                    callback_data=f"{CB_CARD_PREFIX}{card.pk}",
                )
            ]
        )

    buttons.append(
        [InlineKeyboardButton("💳 Выпустить новую", callback_data=CB_ISSUE_CARD)]
    )
    buttons.append([InlineKeyboardButton("◀️ Меню", callback_data=CB_BACK_MENU)])
    return InlineKeyboardMarkup(buttons)


def card_detail_keyboard(card) -> InlineKeyboardMarkup:
    """Клавиатура на экране деталей карты."""
    buttons = []

    if card.status in ["A", "R"]:  # Active, Restored
        buttons.append(
            [
                InlineKeyboardButton(
                    "💳 Показать данные", callback_data=f"{CB_CARD_DETAILS}{card.pk}"
                ),
            ]
        )
        buttons.append(
            [
                InlineKeyboardButton(
                    "📥 Пополнить", callback_data=f"{CB_CARD_TOPUP}{card.pk}"
                ),
            ]
        )
        buttons.append(
            [
                InlineKeyboardButton(
                    "🔒 Заблокировать", callback_data=f"{CB_CARD_BLOCK}{card.pk}"
                ),
            ]
        )
        buttons.append(
            [
                InlineKeyboardButton(
                    "🗑 Закрыть", callback_data=f"{CB_CARD_CLOSE}{card.pk}"
                ),
            ]
        )
    elif card.status == "L":  # Blocked
        buttons.append(
            [
                InlineKeyboardButton(
                    "🔓 Разблокировать", callback_data=f"{CB_CARD_RESTORE}{card.pk}"
                ),
            ]
        )
        buttons.append(
            [
                InlineKeyboardButton(
                    "🗑 Закрыть", callback_data=f"{CB_CARD_CLOSE}{card.pk}"
                ),
            ]
        )

    buttons.append([InlineKeyboardButton("◀️ К списку", callback_data=CB_MY_CARDS)])
    return InlineKeyboardMarkup(buttons)


def card_close_confirm_keyboard(card_account_id: str) -> InlineKeyboardMarkup:
    """Подтверждение закрытия карты."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "✅ Да, закрыть",
                    callback_data=f"{CB_CARD_CLOSE_CONFIRM}{card_account_id}",
                ),
                InlineKeyboardButton("❌ Отмена", callback_data=CB_MY_CARDS),
            ],
        ]
    )


def history_keyboard(
    offset: int, total: int, page_size: int = 10
) -> InlineKeyboardMarkup:
    """Клавиатура пагинации истории."""
    buttons = []
    nav = []
    if offset > 0:
        nav.append(
            InlineKeyboardButton(
                "◀️", callback_data=f"{CB_HISTORY_PREV}{max(0, offset - page_size)}"
            )
        )
    if offset + page_size < total:
        nav.append(
            InlineKeyboardButton(
                "▶️", callback_data=f"{CB_HISTORY_NEXT}{offset + page_size}"
            )
        )
    if nav:
        buttons.append(nav)
    buttons.append([InlineKeyboardButton("◀️ Меню", callback_data=CB_BACK_MENU)])
    return InlineKeyboardMarkup(buttons)
