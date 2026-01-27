import asyncio
from decimal import Decimal

import httpx
from base_daemon import PeriodicBaseHandler
from models.models import Currency, CurrencyRate
from tortoise.exceptions import DoesNotExist


class RatesDaemon(PeriodicBaseHandler):
    """
    Daemon для парсинга курсов валют (USDT to USD, USDT to EUR)
    и записи их в базу данных.
    """

    name = "RatesDaemon"
    # Обновление курсов каждые 5 минут
    period = 300

    # Пары валют для парсинга
    RATE_PAIRS = [
        ("USDT-TRC20", "USD"),
        ("USDT-TRC20", "EUR"),
    ]

    async def on_start(self):
        """Инициализация при запуске daemon'а"""
        self.logger.info("Rates daemon started")
        # Проверяем наличие валют в базе
        for from_code, to_code in self.RATE_PAIRS:
            try:
                currency_from = await Currency.get(code=from_code, is_active=True)
                currency_to = await Currency.get(code=to_code, is_active=True)
                self.logger.info(
                    f"Found currencies: {currency_from.code} -> {currency_to.code}"
                )
            except DoesNotExist:
                self.logger.warning(
                    f"Currency not found: {from_code} or {to_code}. "
                    f"Please ensure currencies are created in database."
                )

    async def fetch_rate_from_binance(self, symbol: str) -> Decimal | None:
        """
        Получает курс валютной пары с Binance API.

        Args:
            symbol: Символ пары (например, 'USDTUSD' или 'EURUSDT')

        Returns:
            Курс валютной пары или None в случае ошибки
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Binance API для получения текущей цены
                url = "https://api.binance.com/api/v3/ticker/price"
                params = {"symbol": symbol}
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                price = Decimal(str(data["price"]))
                self.logger.info(f"Fetched rate from Binance: {symbol} = {price}")
                return price
        except httpx.HTTPError as e:
            self.logger.error(f"HTTP error fetching rate for {symbol}: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Error fetching rate for {symbol}: {e}")
            return None

    async def get_rate(self, from_code: str, to_code: str) -> Decimal | None:
        """
        Получает курс между двумя валютами.

        Args:
            from_code: Код валюты "из"
            to_code: Код валюты "в"

        Returns:
            Курс валютной пары или None в случае ошибки
        """
        # Специальная обработка для USDT/USD
        # USDT - стейблкоин, привязан к USD, курс обычно ~1:1
        if from_code == "USDT-TRC20" and to_code == "USD":
            # Пробуем получить курс через BUSD или другие стейблкоины
            # Но обычно USDT/USD = 1.0
            # Можно также попробовать получить через другие пары
            symbol = "BUSDUSDT"  # BUSD/USDT как индикатор
            rate_busd = await self.fetch_rate_from_binance(symbol)
            if rate_busd is not None:
                # BUSD/USDT обычно близок к 1, используем его как индикатор
                return Decimal("1.0") / rate_busd
            # Если не удалось получить, возвращаем 1.0 как дефолт
            self.logger.info("Using default rate 1.0 for USDT/USD")
            return Decimal("1.0")

        # Для USDT/EUR используем пару EURUSDT на Binance
        if from_code == "USDT-TRC20" and to_code == "EUR":
            symbol = "EURUSDT"
            rate = await self.fetch_rate_from_binance(symbol)
            if rate is not None:
                # EURUSDT показывает сколько USDT за 1 EUR, нужно инвертировать
                return Decimal("1") / rate

        # Общая логика для других пар
        # Пробуем прямую пару
        symbol = f"{from_code}{to_code}"
        rate = await self.fetch_rate_from_binance(symbol)
        if rate is not None:
            return rate

        # Если прямая пара не найдена, пробуем обратную
        symbol_reverse = f"{to_code}{from_code}"
        rate_reverse = await self.fetch_rate_from_binance(symbol_reverse)
        if rate_reverse is not None:
            # Инвертируем курс
            return Decimal("1") / rate_reverse

        return None

    async def save_rate(
        self, currency_from: Currency, currency_to: Currency, rate: Decimal
    ):
        """
        Сохраняет или обновляет курс валют в базе данных.

        Args:
            currency_from: Валюта "из"
            currency_to: Валюта "в"
            rate: Курс обмена
        """
        try:
            # Пытаемся получить существующий курс
            try:
                currency_rate = await CurrencyRate.get(
                    currency_from=currency_from, currency_to=currency_to
                )
                # Обновляем существующий курс
                currency_rate.rate = rate
                currency_rate.human_rate = rate
                currency_rate.is_manual = False
                await currency_rate.save()
                self.logger.info(
                    f"Updated rate: {currency_from.code}/{currency_to.code} = {rate}"
                )
            except DoesNotExist:
                # Создаем новый курс
                currency_rate = await CurrencyRate.create(
                    currency_from=currency_from,
                    currency_to=currency_to,
                    rate=rate,
                    human_rate=rate,
                    is_manual=False,
                )
                self.logger.info(
                    f"Created rate: {currency_from.code}/{currency_to.code} = {rate}"
                )
        except Exception as e:
            self.logger.error(
                f"Error saving rate {currency_from.code}/{currency_to.code}: {e}"
            )

    async def one_iter(self):
        """Основная итерация daemon'а - парсинг и сохранение курсов"""
        self.logger.info("Starting rates update iteration")

        for from_code, to_code in self.RATE_PAIRS:
            try:
                # Получаем валюты из базы
                try:
                    currency_from = await Currency.get(code=from_code, is_active=True)
                    currency_to = await Currency.get(code=to_code, is_active=True)
                except DoesNotExist:
                    self.logger.warning(
                        f"Skipping {from_code}/{to_code}: currency not found in database"
                    )
                    continue

                # Получаем курс
                rate = await self.get_rate(from_code, to_code)
                if rate is None:
                    self.logger.warning(
                        f"Failed to fetch rate for {from_code}/{to_code}"
                    )
                    continue

                # Сохраняем курс
                await self.save_rate(currency_from, currency_to, rate)

            except Exception as e:
                self.logger.exception(
                    f"Error processing rate pair {from_code}/{to_code}: {e}"
                )

        self.logger.info("Rates update iteration completed")
