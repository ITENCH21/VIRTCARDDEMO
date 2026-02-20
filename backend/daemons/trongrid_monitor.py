"""
TronGrid Monitor Daemon — быстрое обнаружение USDT TRC20 депозитов
через TronGrid API (~15с polling).

Создаёт Operation(DEPOSIT, CRYPTO, status=PENDING) при обнаружении
нового tx_hash. Баланс НЕ зачисляется — только раннее уведомление.
Подтверждение и зачисление происходит через CryptoOperationsDaemon
или callback от YeezyPay, которые промоутят PENDING → OPERATING → fiscal.

USDT TRC20 contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t (6 decimals)
"""

import asyncio
import datetime
import logging
import os
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

import aiohttp

from base_daemon import PeriodicBaseHandler
from models.models import Account, Gate, Operation, amount_db_to_human
from models.enums import OperationKind
from services.notification_service import (
    format_deposit_detected_notification,
    send_telegram_message,
)

logger = logging.getLogger(__name__)

# USDT TRC20 contract address (mainnet)
USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
USDT_DECIMALS = 6

TRONGRID_BASE_URL = "https://api.trongrid.io"

# Максимум обработанных tx_hash в Account.data для дедупликации
MAX_PROCESSED_TXS = 500

# Порог для предупреждения о зависших PENDING операциях (30 минут)
STALE_PENDING_MINUTES = 30

# Rate limiting: пауза каждые N аккаунтов (free tier = 15 req/s)
RATE_LIMIT_BATCH_SIZE = 10
RATE_LIMIT_SLEEP = 1.0


class TronGridMonitorDaemon(PeriodicBaseHandler):
    """Мониторит TRC20 транзакции через TronGrid API.

    Для каждого Account с address создаёт Operation(DEPOSIT, PENDING)
    при обнаружении нового входящего USDT перевода.
    """

    name = "TronGridMonitor"
    with_nats = False  # Пишет напрямую в БД + отправляет TG через httpx

    def __init__(self, period: int = 15):
        super().__init__(period=period)
        self.api_key: Optional[str] = None
        self.session: Optional[aiohttp.ClientSession] = None
        self.gate_model: Optional[Gate] = None

    async def on_start(self):
        """Загружает API key и инициализирует HTTP-сессию."""
        # Пробуем загрузить API key из Gate.credentials
        self.gate_model = await Gate.filter(
            code="yeezypay", status=Gate.Status.ACTIVE
        ).first()

        if self.gate_model and self.gate_model.credentials:
            self.api_key = self.gate_model.credentials.get("trongrid_api_key")

        # Fallback на env
        if not self.api_key:
            self.api_key = os.environ.get("TRONGRID_API_KEY", "")

        if not self.api_key:
            self.logger.warning(
                "No TronGrid API key found. Using free tier (rate limited)."
            )

        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
        )

        self.logger.info(
            "TronGridMonitor started, period=%ss, api_key=%s",
            self.period,
            "set" if self.api_key else "not set",
        )

    async def on_stop(self):
        if self.session and not self.session.closed:
            await self.session.close()
        await super().on_stop()

    async def one_iter(self):
        """Одна итерация: опрос TronGrid по всем активным аккаунтам."""
        if not self.session or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
            )

        # Загружаем все активные аккаунты с крипто-адресами
        accounts = await Account.filter(
            address__isnull=False,
            status__in=[Account.Status.ACTIVE, Account.Status.RESTORED],
        ).prefetch_related("currency", "client")

        if not accounts:
            self.logger.debug("No active crypto accounts found")
            return

        self.logger.info("Checking %d accounts for TRC20 deposits", len(accounts))

        for i, account in enumerate(accounts):
            try:
                await self._check_account(account)
            except Exception:
                self.logger.exception(
                    "Failed to check account %s (address=%s)",
                    account.pk,
                    account.address,
                )

            # Rate limiting
            if (i + 1) % RATE_LIMIT_BATCH_SIZE == 0 and i + 1 < len(accounts):
                await asyncio.sleep(RATE_LIMIT_SLEEP)

        # Проверяем stale PENDING операции
        await self._check_stale_pending()

    async def _check_account(self, account: Account):
        """Проверяет один аккаунт на наличие новых TRC20 транзакций."""
        address = account.address
        if not address:
            return

        transactions = await self._fetch_trc20_transactions(address)
        if not transactions:
            return

        # Загружаем уже обработанные tx_hash из Account.data
        account_data = dict(account.data) if account.data else {}
        processed_txs = set(account_data.get("processed_trongrid_txs", []))

        new_txs = []
        for tx in transactions:
            tx_hash = tx.get("transaction_id", "")
            if not tx_hash or tx_hash in processed_txs:
                continue

            # Проверяем что это входящий перевод на наш адрес
            to_addr = tx.get("to", "")
            if to_addr.lower() != address.lower():
                continue

            # Проверяем что контракт — USDT
            contract = tx.get("token_info", {}).get("address", "")
            if contract != USDT_CONTRACT:
                continue

            new_txs.append(tx)

        if not new_txs:
            return

        self.logger.info(
            "Found %d new TRC20 transactions for account %s",
            len(new_txs),
            account.pk,
        )

        new_tx_hashes = []
        for tx in new_txs:
            tx_hash = tx.get("transaction_id", "")
            try:
                created = await self._create_pending_deposit(account, tx)
                if created:
                    new_tx_hashes.append(tx_hash)
            except Exception:
                self.logger.exception(
                    "Failed to create deposit for tx %s, account %s",
                    tx_hash,
                    account.pk,
                )

        # Обновляем processed_trongrid_txs в Account.data
        if new_tx_hashes:
            account = await Account.get(pk=account.pk)
            account_data = dict(account.data) if account.data else {}
            existing = account_data.get("processed_trongrid_txs", [])
            all_processed = existing + [h for h in new_tx_hashes if h not in existing]
            if len(all_processed) > MAX_PROCESSED_TXS:
                all_processed = all_processed[-MAX_PROCESSED_TXS:]
            account_data["processed_trongrid_txs"] = all_processed
            await Account.filter(pk=account.pk).update(data=account_data)

    async def _fetch_trc20_transactions(self, address: str) -> list[dict]:
        """GET TRC20 транзакций с TronGrid API."""
        url = f"{TRONGRID_BASE_URL}/v1/accounts/{address}/transactions/trc20"
        params = {
            "only_to": "true",
            "contract_address": USDT_CONTRACT,
            "limit": 20,
        }
        headers = {}
        if self.api_key:
            headers["TRON-PRO-API-KEY"] = self.api_key

        try:
            async with self.session.get(url, params=params, headers=headers) as resp:
                if resp.status != 200:
                    self.logger.warning(
                        "TronGrid API error %s for address %s",
                        resp.status,
                        address,
                    )
                    return []
                data = await resp.json()
                return data.get("data", [])
        except Exception:
            self.logger.exception("TronGrid request failed for address %s", address)
            return []

    async def _create_pending_deposit(
        self, account: Account, tx: dict
    ) -> Optional[Operation]:
        """Создаёт Operation(DEPOSIT, CRYPTO, PENDING) по TronGrid транзакции.

        Дедупликация: по Operation.external_id = tx_hash.
        Не создаёт OPERATING — только PENDING (раннее уведомление).
        """
        tx_hash = tx.get("transaction_id", "")
        if not tx_hash:
            return None

        # Дедупликация по external_id в Operation
        existing = await Operation.filter(
            external_id=tx_hash,
            kind=OperationKind.DEPOSIT,
        ).first()
        if existing:
            self.logger.debug(
                "Deposit already exists for tx_hash=%s (operation=%s)",
                tx_hash,
                existing.pk,
            )
            return None

        # Парсим сумму: TronGrid возвращает raw value (6 decimals для USDT)
        raw_value = tx.get("value", "0")
        try:
            amount_trongrid = Decimal(str(raw_value)) / Decimal(10**USDT_DECIMALS)
        except Exception:
            self.logger.error("Invalid value in tx %s: %s", tx_hash, raw_value)
            return None

        if amount_trongrid <= 0:
            return None

        # Конвертируем в amount_db через currency.denominator
        currency = account.currency
        if not currency:
            self.logger.warning("Account %s has no currency, skipping", account.pk)
            return None

        denominator = currency.denominator
        amount_db = int(
            (amount_trongrid * Decimal(10**denominator)).to_integral_value(
                rounding=ROUND_HALF_UP
            )
        )

        if amount_db <= 0:
            return None

        # Создаём PENDING операцию
        operation = await Operation.create(
            client=account.client,
            account=account,
            currency=currency,
            kind=OperationKind.DEPOSIT,
            method=Operation.Method.CRYPTO,
            status=Operation.Status.PENDING,
            amount_db=amount_db,
            external_id=tx_hash,
            gate=self.gate_model,
            data={
                "source": "trongrid_monitor",
                "tx_hash": tx_hash,
                "from_address": tx.get("from", ""),
                "block_timestamp": tx.get("block_timestamp"),
                "trongrid_detected_at": datetime.datetime.now(
                    datetime.timezone.utc
                ).isoformat(),
                "raw_value": str(raw_value),
            },
        )

        self.logger.info(
            "Created PENDING deposit: operation=%s, tx_hash=%s, "
            "amount=%s %s, account=%s",
            operation.pk,
            tx_hash,
            amount_trongrid,
            currency.code,
            account.pk,
        )

        # Отправляем Telegram-уведомление
        await self._notify_deposit_detected(account, amount_trongrid, currency)

        return operation

    async def _notify_deposit_detected(
        self, account: Account, amount: Decimal, currency
    ):
        """Отправляет TG-уведомление о найденном (но ещё не подтверждённом) депозите."""
        try:
            client = account.client
            if not client or not client.telegram_id:
                return

            currency_symbol = currency.symbol or currency.code
            text = format_deposit_detected_notification(amount, currency_symbol)
            await send_telegram_message(client.telegram_id, text)
        except Exception:
            self.logger.exception(
                "Failed to send deposit detected notification, account=%s",
                account.pk,
            )

    async def _check_stale_pending(self):
        """Проверяет stale PENDING операции от trongrid_monitor (старше 30 мин)."""
        from tortoise import timezone as tz

        threshold = tz.now() - datetime.timedelta(minutes=STALE_PENDING_MINUTES)

        stale_ops = await Operation.filter(
            status=Operation.Status.PENDING,
            kind=OperationKind.DEPOSIT,
            method=Operation.Method.CRYPTO,
            created_at__lt=threshold,
        ).limit(50)

        for op in stale_ops:
            op_data = op.data or {}
            if (
                isinstance(op_data, dict)
                and op_data.get("source") == "trongrid_monitor"
            ):
                self.logger.warning(
                    "Stale PENDING deposit: operation=%s, tx_hash=%s, "
                    "created_at=%s (>%d min)",
                    op.pk,
                    op_data.get("tx_hash", "?"),
                    op.created_at,
                    STALE_PENDING_MINUTES,
                )
