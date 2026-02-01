import logging
from abc import ABC, abstractmethod
from typing import Optional


class BaseGate(ABC):
    """Базовый интерфейс для гейтов виртуальных карт."""

    name: str = "base"

    def __init__(self, credentials: dict | None = None):
        self.logger = logging.getLogger(f"gate.{self.name}")
        self.credentials = credentials or {}

    @abstractmethod
    async def authenticate(self) -> None:
        """Аутентификация на стороне провайдера."""

    @abstractmethod
    async def card_open(
        self, account_external_id: str, amount: int, currency_code: str, **kwargs
    ) -> dict:
        """Выпуск новой виртуальной карты.

        Возвращает dict с ключами:
            card_id: str — внешний id карты
            sensitive: dict — card_number, cvv, expiry_month, expiry_year
        """

    @abstractmethod
    async def card_topup(self, card_id: str, amount: int, currency_code: str) -> dict:
        """Пополнение виртуальной карты.

        Возвращает dict с результатом пополнения.
        """

    @abstractmethod
    async def card_close(self, card_id: str) -> dict:
        """Закрытие виртуальной карты.

        Возвращает dict с balance_db — остаток средств на карте.
        """

    @abstractmethod
    async def card_block(self, card_id: str) -> dict:
        """Блокировка виртуальной карты."""

    @abstractmethod
    async def card_restore(self, card_id: str) -> dict:
        """Восстановление виртуальной карты."""

    async def get_card_balance(self, card_id: str) -> Optional[int]:
        """Получение баланса карты (опционально)."""
        return None

    async def close(self) -> None:
        """Закрытие сессий/соединений."""
