"""
YeezyPay Gate — микросервис для работы с YeezyPay Virtual Cards API.

Получает задачи по NATS (card_open, card_topup, card_close, card_block, card_restore),
выполняет HTTP-запросы к YeezyPay VC API и публикует результат обратно в fiscal_stream.
"""

import asyncio
import datetime
import time
import logging
import aiohttp
from typing import Optional

from base_daemon import BaseHandler
from models.models import (
    Operation,
    Account,
    Gate,
    amount_human_to_db,
    amount_db_to_human,
    operation_log,
)
from models.enums import OperationKind, LogTag
from tortoise.exceptions import DoesNotExist
from tortoise import timezone

from gates.base_gate import BaseGate

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# ── Config ──────────────────────────────────────────────

DEFAULT_TOKEN_TIMEOUT = 3600

# Типы операций YeezyPay, которые считаем депозитами
DEPOSIT_OP_KINDS = {"deposit", "incoming", "topup", "receive", "credit"}


# ── YeezyPay Gate (HTTP-клиент к VC API) ────────────────


class YeezyPayGate(BaseGate):
    """HTTP-клиент к YeezyPay Virtual Cards API (/vc-api/v1)."""

    name = "yeezypay"

    def __init__(self, credentials: dict):
        super().__init__(credentials=credentials)
        # Gate.credentials format:
        # {
        #     "yeezypay_api_url": "http://yeezypay-host:8000",
        #     "yeezypay_external_id": "your-external-id",
        #     "yeezypay_secret": "your-secret",
        #     "yeezypay_token_timeout": 3600
        # }
        if not self.credentials.get("yeezypay_api_url"):
            raise ValueError("Gate credentials missing 'yeezypay_api_url'")
        if not self.credentials.get("yeezypay_external_id"):
            raise ValueError("Gate credentials missing 'yeezypay_external_id'")
        if not self.credentials.get("yeezypay_secret"):
            raise ValueError("Gate credentials missing 'yeezypay_secret'")

        self.base_url = self.credentials["yeezypay_api_url"].rstrip("/")
        self.external_id = self.credentials["yeezypay_external_id"]
        self.secret = self.credentials["yeezypay_secret"]
        self.token_timeout = int(
            self.credentials.get("yeezypay_token_timeout") or DEFAULT_TOKEN_TIMEOUT
        )
        self.token: Optional[str] = None
        self.token_expires: float = 0
        self.session: Optional[aiohttp.ClientSession] = None

        # Crypto wallet API credentials (optional, may differ from VC API)
        self.crypto_api_url = self.credentials.get(
            "crypto_api_url", self.base_url
        ).rstrip("/")
        self.crypto_account_id = self.credentials.get(
            "crypto_account_id", self.external_id
        )
        self.crypto_secret = self.credentials.get("crypto_secret", self.secret)
        self.crypto_token_timeout = int(
            self.credentials.get("crypto_token_timeout") or DEFAULT_TOKEN_TIMEOUT
        )
        self.crypto_token: Optional[str] = None
        self.crypto_token_expires: float = 0

    async def _ensure_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=60),
                connector=aiohttp.TCPConnector(limit=50),
            )

    async def authenticate(self) -> None:
        """Получение JWT-токена через /vc-api/v1/auth."""
        await self._ensure_session()
        url = f"{self.base_url}/vc-api/v1/auth"
        payload = {
            "external_id": self.external_id,
            "secret": self.secret,
            "timeout": self.token_timeout,
        }
        async with self.session.post(url, json=payload) as resp:
            resp.raise_for_status()
            data = await resp.json()
            if not data.get("success"):
                raise RuntimeError(f"YeezyPay auth failed: {data}")
            self.token = data["token"]
            self.token_expires = time.time() + self.token_timeout - 60
            self.logger.info("YeezyPay authenticated, token obtained")

    async def _get_headers(self) -> dict:
        if not self.token or time.time() >= self.token_expires:
            await self.authenticate()
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        """Выполнение HTTP-запроса к YeezyPay API с автоматической реаутентификацией."""
        await self._ensure_session()
        headers = await self._get_headers()
        url = f"{self.base_url}{path}"

        self.logger.info("YeezyPay %s %s", method, url)

        async with self.session.request(method, url, headers=headers, **kwargs) as resp:
            # Если 401 — переаутентифицируемся и повторяем
            if resp.status == 401:
                self.logger.warning("YeezyPay 401, re-authenticating...")
                await self.authenticate()
                headers = await self._get_headers()
                async with self.session.request(
                    method, url, headers=headers, **kwargs
                ) as retry_resp:
                    retry_resp.raise_for_status()
                    return await retry_resp.json()

            resp.raise_for_status()
            return await resp.json()

    # ── Crypto Wallet API auth & request ────────────────

    async def crypto_authenticate(self) -> None:
        """Получение JWT-токена через /api/v1/crypto_wallet/auth."""
        await self._ensure_session()
        url = f"{self.crypto_api_url}/api/v1/crypto_wallet/auth"
        payload = {
            "account_id": self.crypto_account_id,
            "secret": self.crypto_secret,
            "timeout": self.crypto_token_timeout,
        }
        async with self.session.post(url, json=payload) as resp:
            resp.raise_for_status()
            data = await resp.json()
            if not data.get("token"):
                raise RuntimeError(f"Crypto wallet auth failed: {data}")
            self.crypto_token = data["token"]
            self.crypto_token_expires = time.time() + self.crypto_token_timeout - 60
            self.logger.info("Crypto wallet API authenticated, token obtained")

    async def _crypto_headers(self) -> dict:
        if not self.crypto_token or time.time() >= self.crypto_token_expires:
            await self.crypto_authenticate()
        return {
            "Authorization": f"Bearer {self.crypto_token}",
            "Content-Type": "application/json",
        }

    async def _crypto_request(self, method: str, path: str, **kwargs) -> dict:
        """HTTP-запрос к Crypto Wallet API с автоматической реаутентификацией."""
        await self._ensure_session()
        headers = await self._crypto_headers()
        url = f"{self.crypto_api_url}{path}"

        self.logger.info("CryptoWallet %s %s", method, url)

        async with self.session.request(method, url, headers=headers, **kwargs) as resp:
            if resp.status == 401:
                self.logger.warning("CryptoWallet 401, re-authenticating...")
                await self.crypto_authenticate()
                headers = await self._crypto_headers()
                async with self.session.request(
                    method, url, headers=headers, **kwargs
                ) as retry_resp:
                    retry_resp.raise_for_status()
                    return await retry_resp.json()

            resp.raise_for_status()
            return await resp.json()

    # ── Crypto Wallet operations ──────────────────────────

    async def crypto_wallet_list(
        self,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> dict:
        """GET /api/v1/crypto_wallet/list — список дочерних кошельков с балансами."""
        params = {"page": page, "page_size": page_size}
        if status:
            params["status"] = status
        return await self._crypto_request(
            "GET",
            "/api/v1/crypto_wallet/list",
            params=params,
        )

    async def crypto_wallet_info(
        self,
        wallet_id: str | None = None,
        address: str | None = None,
    ) -> dict:
        """POST /api/v1/crypto_wallet/info — информация о кошельке с балансом."""
        body = {}
        if wallet_id:
            body["wallet_id"] = wallet_id
        if address:
            body["address"] = address
        return await self._crypto_request(
            "POST",
            "/api/v1/crypto_wallet/info",
            json=body,
        )

    async def crypto_wallet_create(
        self,
        currency_code: str,
        wallet_name: str = "",
    ) -> dict:
        """POST /api/v1/crypto_wallet/create — создание дочернего кошелька."""
        body = {"currency_code": currency_code, "wallet_name": wallet_name}
        return await self._crypto_request(
            "POST",
            "/api/v1/crypto_wallet/create",
            json=body,
        )

    async def crypto_wallet_close(
        self,
        wallet_id: str | None = None,
        address: str | None = None,
    ) -> dict:
        """POST /api/v1/crypto_wallet/close — закрытие дочернего кошелька."""
        body = {}
        if wallet_id:
            body["wallet_id"] = wallet_id
        if address:
            body["address"] = address
        return await self._crypto_request(
            "POST",
            "/api/v1/crypto_wallet/close",
            json=body,
        )

    async def crypto_balance_main(self) -> dict:
        """GET /api/v1/crypto_wallet/balances/main — баланс основного кошелька."""
        return await self._crypto_request(
            "GET",
            "/api/v1/crypto_wallet/balances/main",
        )

    async def crypto_operations_list(
        self,
        wallet_id: str | None = None,
        address: str | None = None,
        page: int = 1,
        page_size: int = 20,
        kind: str | None = None,
        operation_status: str | None = None,
    ) -> dict:
        """POST /api/v1/crypto_wallet/operations/list — список операций."""
        body: dict = {"page": page, "page_size": page_size}
        if wallet_id:
            body["wallet_id"] = wallet_id
        if address:
            body["address"] = address
        if kind:
            body["kind"] = kind
        if operation_status:
            body["operation_status"] = operation_status
        return await self._crypto_request(
            "POST",
            "/api/v1/crypto_wallet/operations/list",
            json=body,
        )

    async def crypto_operation_detail(self, operation_id: str) -> dict:
        """GET /api/v1/crypto_wallet/operations/{operation_id} — детали операции."""
        return await self._crypto_request(
            "GET",
            f"/api/v1/crypto_wallet/operations/{operation_id}",
        )

    # ── Card operations ──────────────────────────────────

    async def card_open(
        self, account_external_id: str, amount: int, currency_code: str, **kwargs
    ) -> dict:
        """POST /vc-api/v1/cards/open

        Args:
            account_external_id: External ID аккаунта-источника.
            amount: Сумма в human-readable формате (Decimal-совместимое).
            currency_code: Код валюты карты.
            **kwargs: card_name, card_type.
        """
        body = {"amount": amount}
        if currency_code:
            body["card_currency"] = currency_code
        if kwargs.get("card_name"):
            body["card_name"] = kwargs["card_name"]
        if kwargs.get("card_type"):
            body["card_type"] = kwargs["card_type"]
        result = await self._request("POST", "/vc-api/v1/cards/open", json=body)
        card = result.get("card", {})
        card_id = str(card.get("id", ""))

        # card_open может вернуть карту в статусе DRAFT без credentials —
        # поллим GET /cards/{id} пока не получим sensitive-данные
        credentials = result.get("credentials") or {}
        if not credentials.get("card_number"):
            credentials = await self._poll_card_credentials(card_id)

        return {
            "card_id": card_id,
            "sensitive": {
                "card_number": credentials.get("card_number"),
                "cvv": credentials.get("cvv"),
                "expiry_month": credentials.get("expiry_month"),
                "expiry_year": credentials.get("expiry_year"),
            },
            "status": card.get("status"),
        }

    async def _poll_card_credentials(
        self, card_id: str, max_attempts: int = 10, interval: float = 3.0
    ) -> dict:
        """Поллит GET /vc-api/v1/cards/{card_id} пока не появятся credentials."""
        import asyncio

        for attempt in range(1, max_attempts + 1):
            await asyncio.sleep(interval)
            details = await self.get_card_details(card_id)
            if details:
                sensitive = details.get("sensitive", {})
                if sensitive.get("card_number"):
                    self.logger.info(
                        "Got credentials for card %s on attempt %d/%d",
                        card_id,
                        attempt,
                        max_attempts,
                    )
                    return sensitive
            self.logger.info(
                "Credentials not ready for card %s (attempt %d/%d)",
                card_id,
                attempt,
                max_attempts,
            )
        self.logger.warning(
            "Failed to get credentials for card %s after %d attempts",
            card_id,
            max_attempts,
        )
        return {}

    async def card_topup(self, card_id: str, amount: int, currency_code: str) -> dict:
        """PATCH /vc-api/v1/cards/{card_id}/topup"""
        body = {"amount": amount}
        result = await self._request(
            "PATCH", f"/vc-api/v1/cards/{card_id}/topup", json=body
        )
        return {
            "card_id": card_id,
            "status": result.get("card", {}).get("status"),
        }

    async def card_close(self, card_id: str) -> dict:
        """PATCH /vc-api/v1/cards/{card_id}/close"""
        result = await self._request("PATCH", f"/vc-api/v1/cards/{card_id}/close")
        card = result.get("card", {})
        return {
            "card_id": card_id,
            "status": card.get("status"),
            "balance_db": card.get("balance", 0),
        }

    async def card_block(self, card_id: str) -> dict:
        """PATCH /vc-api/v1/cards/{card_id}/block"""
        result = await self._request("PATCH", f"/vc-api/v1/cards/{card_id}/block")
        return {
            "card_id": card_id,
            "status": result.get("card", {}).get("status"),
        }

    async def card_restore(self, card_id: str) -> dict:
        """PUT /vc-api/v1/cards/{card_id}/restore"""
        result = await self._request("PUT", f"/vc-api/v1/cards/{card_id}/restore")
        return {
            "card_id": card_id,
            "status": result.get("card", {}).get("status"),
        }

    async def get_card_details(self, card_id: str) -> Optional[dict]:
        """GET /vc-api/v1/cards/{card_id} — полная информация о карте."""
        try:
            result = await self._request("GET", f"/vc-api/v1/cards/{card_id}")
            card = result.get("card", {})
            credentials = result.get("credentials") or {}
            return {
                "card_id": str(card.get("id", "")),
                "status": card.get("status"),
                "balance": card.get("balance"),
                "currency_code": card.get("currency_code"),
                "name": card.get("name"),
                "sensitive": {
                    "card_number": credentials.get("card_number"),
                    "cvv": credentials.get("cvv"),
                    "expiry_month": credentials.get("expiry_month"),
                    "expiry_year": credentials.get("expiry_year"),
                },
            }
        except Exception:
            self.logger.exception("Failed to get details for card %s", card_id)
            return None

    async def get_card_balance(self, card_id: str) -> Optional[int]:
        """GET /vc-api/v1/cards/{card_id}"""
        try:
            result = await self._request("GET", f"/vc-api/v1/cards/{card_id}")
            return result.get("card", {}).get("balance")
        except Exception:
            self.logger.exception("Failed to get balance for card %s", card_id)
            return None

    async def get_cards_list(self) -> list:
        """GET /vc-api/v1/cards/list — список всех карт."""
        try:
            result = await self._request("GET", "/vc-api/v1/cards/list")
            return result.get("cards", [])
        except Exception:
            self.logger.exception("Failed to get cards list")
            return []

    async def close(self) -> None:
        if self.session and not self.session.closed:
            await self.session.close()


# ── NATS Microservice ────────────────────────────────────


OPERATION_KIND_TO_HANDLER = {
    OperationKind.CARD_OPEN: "process_card_open",
    OperationKind.CARD_TOPUP: "process_card_topup",
    OperationKind.CARD_CLOSE: "process_card_close",
    OperationKind.CARD_BLOCK: "process_card_block",
    OperationKind.CARD_RESTORE: "process_card_restore",
}

# Маппинг action → метод гейта для крипто-вызовов через NATS
CRYPTO_ACTION_TO_METHOD = {
    "crypto_wallet_list": "crypto_wallet_list",
    "crypto_wallet_info": "crypto_wallet_info",
    "crypto_wallet_create": "crypto_wallet_create",
    "crypto_wallet_close": "crypto_wallet_close",
    "crypto_balance_main": "crypto_balance_main",
    "crypto_operations_list": "crypto_operations_list",
    "crypto_operation_detail": "crypto_operation_detail",
    "fetch_operation_status": None,  # Обрабатывается особо в yeezypay_crypto_process
}


class YeezyPayMicroservice(BaseHandler):
    """
    Микросервис-гейт для YeezyPay.

    Слушает NATS-топик `yeezypay_gate`, получает задачи на
    выпуск/пополнение/закрытие/блокировку/восстановление карт,
    делает запросы к YeezyPay API и отправляет результат в fiscal_stream.
    """

    name = "YeezyPayGate"
    with_nats = True
    nats_stream_name = "gates_stream"
    subjects = ["yeezypay_gate", "yeezypay_crypto", "yeezypay_callback"]

    def __init__(self, crypto_poll_period: int = 60):
        super().__init__()
        self.gate: Optional[YeezyPayGate] = None
        self.gate_model: Optional[Gate] = None
        self.crypto_poll_period = crypto_poll_period

    async def _load_gate(self):
        """Load Gate record from DB and initialize YeezyPayGate with credentials."""

        self.gate_model = await Gate.filter(
            code="yeezypay", status=Gate.Status.ACTIVE
        ).first()
        assert self.gate_model is not None
        credentials = self.gate_model.credentials or {}
        self.gate = YeezyPayGate(credentials=credentials)

    async def on_start(self):
        """Load gate from DB. Authentication is lazy — happens on first request
        via _get_headers() / _crypto_headers()."""
        await self._load_gate()
        assert self.gate is not None
        self.logger.info("YeezyPay gate loaded, auth will happen on first request")

    async def on_stop(self):
        if self.gate:
            await self.gate.close()
        await super().on_stop()

    # ── Helpers ──────────────────────────────────────────

    async def _get_operation(self, data: dict) -> Optional[Operation]:
        uid = data.get("operation_guid")
        if not uid:
            self.logger.warning("operation_guid not found in message: %r", data)
            return None
        try:
            return await Operation.get(pk=uid)
        except DoesNotExist:
            self.logger.error("Operation #%s not found", uid)
            return None

    async def _fail_operation(self, operation: Operation, error: str):
        """Помечает операцию как FAILED, освобождает холд и публикует результат в fiscal."""
        self.logger.error("Operation #%s FAILED: %s", operation.pk, error)

        # 1. Статус — критичнее всего
        await Operation.filter(pk=operation.pk).update(
            status=Operation.Status.FAILED,
            updated_at=timezone.now(),
            done_at=timezone.now(),
        )

        # 2. Освобождаем холд (атомарно через Account.unhold_amount_db)
        try:
            await operation.refresh_from_db()
            op_data = operation.data or {}
            holded_amount = (
                op_data.get("holded_amount") if isinstance(op_data, dict) else None
            )
            if holded_amount:
                await operation.fetch_related("account")
                account = operation.account
                await account.unhold_amount_db(holded_amount, operation=operation)
                self.logger.info(
                    "Released hold %s for operation %s", holded_amount, operation.pk
                )
        except Exception:
            self.logger.exception(
                "Failed to release hold for operation %s", operation.pk
            )

        # 3. Лог (не блокирует основную логику)
        try:
            await operation_log(operation.pk, LogTag.ERROR, error)
        except Exception:
            self.logger.exception("Failed to write operation log for %s", operation.pk)

        # 4. Публикуем в fiscal (опционально)
        try:
            await self._publish_to_fiscal(operation, {"error": error})
        except Exception:
            self.logger.exception(
                "Failed to publish fail to fiscal for %s", operation.pk
            )

    async def _publish_to_fiscal(self, operation: Operation, gate_result: dict):
        """Публикует результат гейта в fiscal_stream для дальнейшей обработки."""
        await operation_log(
            operation.pk, LogTag.TO_FISCAL, "Published to fiscal_stream"
        )
        if not self.nats_producer:
            self.logger.error("NATS producer not available")
            return

        await operation.refresh_from_db()
        op_data = operation.data or {}
        payload = op_data if isinstance(op_data, dict) else {}
        payload["gate"] = {
            "code": "yeezypay",
            "result": gate_result,
        }

        message = {
            "operation_guid": str(operation.pk),
            "payload": payload,
        }

        # Публикуем в fiscal_stream через топик item
        fiscal_producer = type(self.nats_producer)(
            subjects=["item"], stream_name="fiscal_stream"
        )
        try:
            await fiscal_producer.connect()
            await fiscal_producer.publish("item", message)
            self.logger.info(
                "Published result for operation #%s to fiscal_stream", operation.pk
            )
        finally:
            await fiscal_producer.close()

    async def _get_card_external_id(self, operation: Operation) -> Optional[str]:
        """Получает external_id карты из аккаунта операции."""
        await operation.fetch_related("account")
        account = operation.account
        if account.external_id:
            return account.external_id
        acc_data = account.data or {}
        if isinstance(acc_data, dict):
            return acc_data.get("gate_card_id")
        return None

    # ── Operation handlers ───────────────────────────────

    async def process_card_open(self, operation: Operation, data: dict):
        """Обработка выпуска новой карты."""
        await operation.fetch_related("account", "account__currency")
        account = operation.account
        currency = account.currency

        op_data = operation.data or {}
        amount_db = op_data.get("amount", 0) if isinstance(op_data, dict) else 0
        card_name = op_data.get("card_name") if isinstance(op_data, dict) else None
        # Целевая валюта карты (USD, EUR), отличается от валюты аккаунта (USDT)
        card_currency = (
            op_data.get("card_currency", "USD") if isinstance(op_data, dict) else "USD"
        )
        card_type = (
            op_data.get("card_type", "standard")
            if isinstance(op_data, dict)
            else "standard"
        )

        # VC API ожидает human-readable Decimal, а не fixed-point int
        amount_human = float(amount_db_to_human(amount_db, currency))

        try:
            result = await self.gate.card_open(
                account_external_id=account.external_id or str(account.pk),
                amount=amount_human,
                currency_code=card_currency,
                card_name=card_name,
                card_type=card_type,
            )
            await operation_log(
                operation.pk, LogTag.FROM_GATE, "Card opened successfully"
            )
            self.logger.info("Card opened: %r (op #%s)", result, operation.pk)

            # Обновляем статус операции на OPERATING (fiscal завершит)
            await Operation.filter(pk=operation.pk).update(
                status=Operation.Status.OPERATING,
                updated_at=timezone.now(),
            )
            await self._publish_to_fiscal(operation, result)

        except Exception as e:
            await self._fail_operation(operation, str(e))

    async def process_card_topup(self, operation: Operation, data: dict):
        """Обработка пополнения карты."""
        card_id = await self._get_card_external_id(operation)
        if not card_id:
            await self._fail_operation(operation, "Card external_id not found")
            return

        await operation.fetch_related("account", "account__currency")
        currency = operation.account.currency

        op_data = operation.data or {}
        amount_db = op_data.get("amount", 0) if isinstance(op_data, dict) else 0

        # VC API ожидает human-readable Decimal, а не fixed-point int
        amount_human = float(amount_db_to_human(amount_db, currency))

        try:
            result = await self.gate.card_topup(
                card_id=card_id,
                amount=amount_human,
                currency_code=currency.code if currency else "USD",
            )
            await operation_log(operation.pk, LogTag.FROM_GATE, "Card topped up")
            self.logger.info("Card topped up: %r (op #%s)", result, operation.pk)

            await Operation.filter(pk=operation.pk).update(
                status=Operation.Status.OPERATING,
                updated_at=timezone.now(),
            )
            await self._publish_to_fiscal(operation, result)

        except Exception as e:
            await self._fail_operation(operation, str(e))

    async def process_card_close(self, operation: Operation, data: dict):
        """Обработка закрытия карты."""
        card_id = await self._get_card_external_id(operation)
        if not card_id:
            await self._fail_operation(operation, "Card external_id not found")
            return

        try:
            result = await self.gate.card_close(card_id=card_id)
            await operation_log(operation.pk, LogTag.FROM_GATE, "Card closed")
            self.logger.info("Card closed: %r (op #%s)", result, operation.pk)

            await Operation.filter(pk=operation.pk).update(
                status=Operation.Status.OPERATING,
                updated_at=timezone.now(),
            )
            await self._publish_to_fiscal(operation, result)

        except Exception as e:
            await self._fail_operation(operation, str(e))

    async def process_card_block(self, operation: Operation, data: dict):
        """Обработка блокировки карты."""
        card_id = await self._get_card_external_id(operation)
        if not card_id:
            await self._fail_operation(operation, "Card external_id not found")
            return

        try:
            result = await self.gate.card_block(card_id=card_id)
            await operation_log(operation.pk, LogTag.FROM_GATE, "Card blocked")
            self.logger.info("Card blocked: %r (op #%s)", result, operation.pk)

            await Operation.filter(pk=operation.pk).update(
                status=Operation.Status.OPERATING,
                updated_at=timezone.now(),
            )
            await self._publish_to_fiscal(operation, result)

        except Exception as e:
            await self._fail_operation(operation, str(e))

    async def process_card_restore(self, operation: Operation, data: dict):
        """Обработка восстановления карты."""
        card_id = await self._get_card_external_id(operation)
        if not card_id:
            await self._fail_operation(operation, "Card external_id not found")
            return

        try:
            result = await self.gate.card_restore(card_id=card_id)
            await operation_log(operation.pk, LogTag.FROM_GATE, "Card restored")
            self.logger.info("Card restored: %r (op #%s)", result, operation.pk)

            await Operation.filter(pk=operation.pk).update(
                status=Operation.Status.OPERATING,
                updated_at=timezone.now(),
            )
            await self._publish_to_fiscal(operation, result)

        except Exception as e:
            await self._fail_operation(operation, str(e))

    # ── NATS entry points ─────────────────────────────────

    async def _save_wallet_to_account(self, account_id: str, result: dict) -> None:
        """Сохраняет результат создания крипто-кошелька в Account.

        Если адрес уже есть но отличается — обновляет (YeezyPay может
        перегенерировать адрес, wallet_id при этом не меняется).
        """
        try:
            account = await Account.get(pk=account_id).prefetch_related("client")
        except DoesNotExist:
            self.logger.error("Account %s not found, cannot save wallet", account_id)
            return

        address = result.get("wallet_address") or result.get("address")
        wallet_id = result.get("wallet_id") or result.get("id")
        if not address:
            self.logger.error(
                "No address in wallet result for account %s: %r",
                account_id,
                result,
            )
            return

        old_address = account.address
        address_changed = old_address and old_address != address

        if old_address and not address_changed:
            self.logger.info(
                "Account %s already has same address=%s, updating wallet_info only",
                account_id,
                account.address,
            )

        await Account.filter(pk=account_id).update(
            address=address,
            external_id=str(wallet_id) if wallet_id else account.external_id,
            data={"wallet_info": result},
        )
        self.logger.info(
            "Wallet saved to account %s: address=%s, external_id=%s",
            account_id,
            address,
            wallet_id,
        )

        if address_changed:
            self.logger.warning(
                "Address changed during wallet create for account %s: %s → %s",
                account_id,
                old_address,
                address,
            )
            await self._notify_address_changed(account, old_address, address)

    async def _update_wallet_balance(self, account_id: str, result: dict) -> None:
        """Обновляет баланс крипто-кошелька в Account по данным из crypto_wallet_info.

        Ответ API: {"success": true, "data": {"wallet_id": ..., "balance": "10.5", ...}}

        Также проверяет, не изменился ли адрес кошелька на стороне YeezyPay
        (перегенерация адресов). Если адрес изменился — обновляет и уведомляет.
        """
        try:
            account = await Account.get(pk=account_id).prefetch_related(
                "currency", "client"
            )
        except DoesNotExist:
            self.logger.error("Account %s not found, cannot update balance", account_id)
            return

        # balance лежит внутри вложенного "data"
        wallet_data = result.get("data") or {}
        balance_str = wallet_data.get("balance")
        if balance_str is None:
            self.logger.warning(
                "No balance in wallet_info result for account %s: %r",
                account_id,
                result,
            )
            return

        from decimal import Decimal, ROUND_HALF_UP

        try:
            balance_decimal = Decimal(str(balance_str))
        except Exception:
            self.logger.error(
                "Invalid balance value '%s' for account %s", balance_str, account_id
            )
            return

        denominator = account.currency.denominator if account.currency else 2
        external_amount_db = int(
            (balance_decimal * 10**denominator).to_integral_value(
                rounding=ROUND_HALF_UP
            )
        )

        # Проверяем, не изменился ли адрес кошелька
        new_address = wallet_data.get("wallet_address") or wallet_data.get("address")
        update_fields = {
            "external_amount_db": external_amount_db,
            "data": {"wallet_info": wallet_data},
            "external_updated_at": timezone.now(),
        }

        address_changed = False
        old_address = account.address

        if new_address and new_address != old_address:
            address_changed = True
            update_fields["address"] = new_address
            self.logger.warning(
                "Address changed for account %s: %s → %s",
                account_id,
                old_address,
                new_address,
            )

        await Account.filter(pk=account_id).update(**update_fields)
        self.logger.info(
            "Balance updated for account %s: %s → external_amount_db=%s",
            account_id,
            balance_str,
            external_amount_db,
        )

        # Уведомляем пользователя о смене адреса
        if address_changed:
            await self._notify_address_changed(account, old_address or "", new_address)

    async def _notify_address_changed(
        self, account: Account, old_address: str, new_address: str
    ) -> None:
        """Отправляет TG-уведомление о смене адреса кошелька."""
        try:
            from services.notification_service import (
                format_address_changed_notification,
                send_telegram_message,
            )

            client = account.client
            if not client or not client.telegram_id:
                return

            text = format_address_changed_notification(old_address, new_address)
            await send_telegram_message(client.telegram_id, text)
            self.logger.info(
                "Address change notification sent: account=%s, %s → %s",
                account.pk,
                old_address,
                new_address,
            )
        except Exception:
            self.logger.exception(
                "Failed to send address change notification, account=%s",
                account.pk,
            )

    async def _close_wallet_account(self, account_id: str, result: dict) -> None:
        """Закрывает Account после успешного закрытия крипто-кошелька в YeezyPay.

        Ответ API: {"success": true, "wallet_id": "...", "wallet_address": "...", "status": "CLOSED"}
        """
        if not result.get("success"):
            self.logger.warning(
                "Wallet close was not successful for account %s: %r",
                account_id,
                result,
            )
            return

        try:
            await Account.get(pk=account_id)
        except DoesNotExist:
            self.logger.error("Account %s not found, cannot close", account_id)
            return

        await Account.filter(pk=account_id).update(
            status="C",  # Closed — зеркалим статус из wallet API
            data={"wallet_info": result},
        )
        self.logger.info(
            "Account %s closed (wallet API status=%s)",
            account_id,
            result.get("status"),
        )

    async def yeezypay_crypto_process(self, data: dict):
        """Точка входа — обработка NATS-сообщений из топика yeezypay_crypto.

        Формат сообщения:
        {
            "action": "<action_name>",
            "params": { ... },
            "account_id": "uuid аккаунта (опционально)"
        }

        Если передан account_id, результат автоматически сохраняется в Account:
        - crypto_wallet_create → address, external_id, data
        - crypto_wallet_info   → external_amount_db (баланс), data
        - crypto_wallet_close  → status = Closed, data
        """
        self.logger.info("Received crypto task: %r", data)

        action = data.get("action")
        params = data.get("params") or {}
        reply_to = data.get("reply_to", "yeezypay_crypto_reply")
        request_id = data.get("request_id")
        account_id = data.get("account_id")

        if not action:
            self.logger.warning("Missing 'action' in crypto message: %r", data)
            return

        # Ранний перехват: fetch_operation_status обрабатывается отдельно
        if action == "fetch_operation_status":
            await self._handle_fetch_operation_status(params, reply_to, request_id)
            return

        method_name = CRYPTO_ACTION_TO_METHOD.get(action)
        if not method_name:
            self.logger.warning(
                "Unknown crypto action '%s', available: %s",
                action,
                list(CRYPTO_ACTION_TO_METHOD.keys()),
            )
            await self._publish_crypto_reply(
                reply_to,
                request_id,
                action,
                {
                    "success": False,
                    "error": f"Unknown action: {action}",
                },
            )
            return

        # Для crypto_wallet_create — проверяем дубли
        if action == "crypto_wallet_create" and account_id:
            try:
                account = await Account.get(pk=account_id)
                if account.address:
                    self.logger.info(
                        "Account %s already has wallet address=%s, skipping",
                        account_id,
                        account.address,
                    )
                    await self._publish_crypto_reply(
                        reply_to,
                        request_id,
                        action,
                        {
                            "success": True,
                            "address": account.address,
                            "wallet_id": account.external_id,
                            "already_exists": True,
                        },
                    )
                    return
            except DoesNotExist:
                self.logger.warning("Account %s not found", account_id)

        try:
            gate_method = getattr(self.gate, method_name)
            result = await gate_method(**params)
            self.logger.info("Crypto %s result: %r", action, result)

            # Сохраняем результат в Account (если передан account_id)
            if account_id:
                if action == "crypto_wallet_create":
                    await self._save_wallet_to_account(account_id, result)
                elif action == "crypto_wallet_info":
                    await self._update_wallet_balance(account_id, result)
                elif action == "crypto_wallet_close":
                    await self._close_wallet_account(account_id, result)

            await self._publish_crypto_reply(
                reply_to,
                request_id,
                action,
                result,
            )
        except Exception as e:
            self.logger.exception("Crypto %s failed: %s", action, e)
            await self._publish_crypto_reply(
                reply_to,
                request_id,
                action,
                {
                    "success": False,
                    "error": str(e),
                },
            )

    async def _publish_crypto_reply(
        self,
        reply_to: str,
        request_id: str | None,
        action: str,
        result: dict,
    ):
        """Публикует ответ крипто-запроса в указанный NATS-топик."""
        if not self.nats_producer:
            self.logger.error("NATS producer not available for crypto reply")
            return

        message = {
            "action": action,
            "result": result,
        }
        if request_id:
            message["request_id"] = request_id

        reply_producer = type(self.nats_producer)(
            subjects=[reply_to],
            stream_name="crypto_reply_stream",
        )
        try:
            await reply_producer.connect()
            await reply_producer.publish(reply_to, message)
            self.logger.info(
                "Published crypto reply for '%s' to %s",
                action,
                reply_to,
            )
        finally:
            await reply_producer.close()

    async def _handle_fetch_operation_status(
        self,
        params: dict,
        reply_to: str,
        request_id: str | None,
    ):
        """Обрабатывает запрос fetch_operation_status от admin action.

        Для DEPOSIT: запрашивает crypto_operation_detail по external_id.
        Для CARD_*: запрашивает get_card_balance по card_id из Account.
        Результат сохраняется в Operation.data['last_status_check'].
        """
        operation_id = params.get("operation_id")
        kind = params.get("kind", "")
        external_id = params.get("external_id", "")

        if not operation_id:
            self.logger.warning("fetch_operation_status: missing operation_id")
            return

        try:
            operation = await Operation.get(pk=operation_id)
        except DoesNotExist:
            self.logger.error(
                "fetch_operation_status: Operation %s not found", operation_id
            )
            return

        # Сравниваем через .value, т.к. кастомный TextChoices(Enum)
        # не наследует str — прямое "CO" == OperationKind.CARD_OPEN даёт False
        kind_value = kind.value if hasattr(kind, "value") else str(kind)

        CARD_KINDS = {
            OperationKind.CARD_OPEN.value,
            OperationKind.CARD_TOPUP.value,
            OperationKind.CARD_CLOSE.value,
            OperationKind.CARD_BLOCK.value,
            OperationKind.CARD_RESTORE.value,
        }

        result = {}
        try:
            if kind_value == OperationKind.DEPOSIT.value:
                # Для депозитов — запрашиваем детали операции по external_id
                if external_id:
                    result = await self.gate.crypto_operation_detail(external_id)
                else:
                    result = {"error": "no external_id for deposit operation"}
            elif kind_value == OperationKind.CARD_OPEN.value:
                # CARD_OPEN: operation.account — это source-аккаунт (USDT),
                # НЕ карта. Карточный Account создаётся fiscal-ом после
                # получения результата. Поэтому всегда ищем на VC API.
                if operation.status in (
                    Operation.Status.PENDING,
                    Operation.Status.OPERATING,
                ):
                    result = await self._sync_card_open(operation)
                else:
                    result = {
                        "error": "CARD_OPEN already finalized",
                        "status": str(operation.status),
                    }

            elif kind_value in CARD_KINDS:
                # CARD_TOPUP / CARD_BLOCK / CARD_CLOSE / CARD_RESTORE:
                # operation.account — это карточный Account, external_id = VC API card UUID
                await operation.fetch_related("account", "account__currency")
                account = operation.account
                card_id = account.external_id
                if not card_id and isinstance(account.data, dict):
                    card_id = account.data.get("gate_card_id")

                if card_id:
                    details = await self.gate.get_card_details(card_id)
                    if details:
                        result = details
                    else:
                        balance = await self.gate.get_card_balance(card_id)
                        result = {"card_id": card_id, "balance": balance}
                else:
                    result = {"error": "no card_id found for account"}
            else:
                result = {"error": f"unsupported operation kind: {kind_value}"}

        except Exception as e:
            self.logger.exception(
                "fetch_operation_status failed for operation %s", operation_id
            )
            result = {"error": str(e)}

        # Сохраняем результат в Operation.data
        await operation.refresh_from_db()
        op_data = operation.data or {}
        if not isinstance(op_data, dict):
            op_data = {}
        op_data["last_status_check"] = {
            "result": result,
            "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        await Operation.filter(pk=operation.pk).update(data=op_data)

        status_msg = result.get("error") or "OK"
        await operation_log(
            operation.pk, LogTag.FETCH_STATUS, f"Status check: {status_msg}"
        )

        self.logger.info(
            "fetch_operation_status for operation %s: %r", operation_id, result
        )

        await self._publish_crypto_reply(
            reply_to, request_id, "fetch_operation_status", result
        )

    async def _sync_card_open(self, operation: Operation) -> dict:
        """Ищет карту на VC API для операции CARD_OPEN и публикует в fiscal.

        Используется когда карта была создана на VC API, но callback не пришёл
        и локальный Account(VIRTUAL_CARD) ещё не создан.
        """
        op_data = operation.data or {}
        card_name = op_data.get("card_name") if isinstance(op_data, dict) else None

        cards = await self.gate.get_cards_list()
        if not cards:
            return {"error": "no cards found on VC API", "synced": False}

        # Ищем по card_name, иначе берём последнюю
        matched_card = None
        for card in cards:
            if isinstance(card, dict) and card.get("name") == card_name:
                matched_card = card
                break
        if not matched_card:
            matched_card = cards[-1] if isinstance(cards[-1], dict) else None

        if not matched_card:
            return {"error": "could not match card on VC API", "synced": False}

        card_id = str(matched_card.get("id", ""))
        card_details = await self.gate.get_card_details(card_id)
        if not card_details:
            return {
                "error": f"failed to get details for card {card_id}",
                "synced": False,
            }

        gate_result = {
            "card_id": card_details["card_id"],
            "sensitive": card_details.get("sensitive", {}),
            "status": card_details.get("status"),
        }

        # Обновляем статус на OPERATING если PENDING
        if operation.status == Operation.Status.PENDING:
            await Operation.filter(pk=operation.pk).update(
                status=Operation.Status.OPERATING,
                updated_at=timezone.now(),
            )

        # Публикуем в fiscal_stream
        await self._publish_to_fiscal(operation, gate_result)

        self.logger.info(
            "Card sync: found card %s for operation %s, published to fiscal",
            card_id,
            operation.pk,
        )

        return {
            "synced": True,
            "card_id": card_id,
            "status": card_details.get("status"),
        }

    async def yeezypay_gate_process(self, data: dict):
        """Точка входа — обработка NATS-сообщений из топика yeezypay_gate.

        Формат сообщения:
        {
            "operation_guid": "uuid",
            "payload": {
                "amount": 10000,
                "card_name": "My Card",
                ...
            }
        }
        """
        self.logger.info("Received gate task: %r", data)

        operation = await self._get_operation(data)
        if not operation:
            return

        # Только PENDING операции принимаем к обработке
        if operation.status != Operation.Status.PENDING:
            self.logger.warning(
                "Operation #%s status is %s, expected PENDING, skipping",
                operation.pk,
                operation.status,
            )
            return

        # Set gate FK on the operation
        if self.gate_model:
            await Operation.filter(pk=operation.pk).update(gate_id=self.gate_model.pk)

        await operation_log(operation.pk, LogTag.TO_GATE, "Dispatched to YeezyPay gate")

        kind = OperationKind(operation.kind)
        handler_name = OPERATION_KIND_TO_HANDLER.get(kind)

        if not handler_name:
            self.logger.warning(
                "No handler for operation kind %s (op #%s)", kind, operation.pk
            )
            return

        handler = getattr(self, handler_name)
        try:
            await handler(operation, data)
        except Exception:
            self.logger.exception(
                "Unhandled error processing operation #%s (%s)",
                operation.pk,
                handler_name,
            )
            await self._fail_operation(operation, "Internal gate error")

    # ── Crypto callback handler ────────────────────────────

    MAX_PROCESSED_IDS = 200

    async def _create_deposit_and_publish(
        self,
        account: Account,
        amount_db: int,
        external_id: str,
        source_payload: dict,
        source: str = "crypto_callback",
    ) -> Optional[Operation]:
        """Создаёт Operation(DEPOSIT, CRYPTO) и публикует в fiscal_stream.

        Дедупликация по Operation.external_id — если операция с таким ID
        уже существует, возвращает None.

        Args:
            account: дочерний крипто-кошелёк (Account с address).
            amount_db: сумма депозита в единицах БД (integer).
            external_id: внешний ID операции (operation_id / tx_hash от YeezyPay).
            source_payload: оригинальные данные от YeezyPay для сохранения в data.
            source: источник депозита ("crypto_callback" или "crypto_poll").

        Returns:
            Созданный Operation или None если дубль.
        """
        if not external_id:
            self.logger.warning(
                "Cannot create deposit operation without external_id for account %s",
                account.pk,
            )
            return None

        # Дедупликация: проверяем, нет ли уже Operation с таким external_id
        existing = await Operation.filter(
            external_id=external_id,
            kind=OperationKind.DEPOSIT,
        ).first()

        # Также ищем по tx_hash из source_payload (YeezyPay может использовать
        # свой operation_id, отличный от blockchain tx_hash)
        if not existing and source_payload.get("tx_hash"):
            tx_hash = str(source_payload["tx_hash"])
            if tx_hash != external_id:
                existing = await Operation.filter(
                    external_id=tx_hash,
                    kind=OperationKind.DEPOSIT,
                ).first()

        if existing and existing.status == Operation.Status.PENDING:
            # Промоутим PENDING операцию (от TronGrid) → OPERATING
            self.logger.info(
                "Promoting PENDING deposit: operation=%s, external_id=%s → OPERATING",
                existing.pk,
                external_id,
            )
            existing_data = existing.data or {}
            if not isinstance(existing_data, dict):
                existing_data = {}
            existing_data["source"] = source
            existing_data["trongrid_promoted"] = True
            existing_data["source_payload"] = source_payload

            await Operation.filter(pk=existing.pk).update(
                status=Operation.Status.OPERATING,
                operating_at=timezone.now(),
                amount_db=amount_db,
                gate=self.gate_model,
                data=existing_data,
            )
            await operation_log(
                existing.pk,
                LogTag.PROMOTED,
                f"PENDING→OPERATING via {source}, amount_db={amount_db}",
            )
            await existing.refresh_from_db()
            await self._publish_to_fiscal(existing, gate_result={})
            return existing

        if existing:
            self.logger.info(
                "Deposit operation already exists: external_id=%s, operation=%s, status=%s",
                external_id,
                existing.pk,
                existing.status,
            )
            return None

        if amount_db <= 0:
            self.logger.warning(
                "Invalid deposit amount_db=%s for account %s, skipping",
                amount_db,
                account.pk,
            )
            return None

        # Загружаем связанные объекты если не загружены
        await account.fetch_related("client", "currency")

        operation = await Operation.create(
            client=account.client,
            account=account,
            currency=account.currency,
            kind=OperationKind.DEPOSIT,
            method=Operation.Method.CRYPTO,
            status=Operation.Status.OPERATING,
            amount_db=amount_db,
            external_id=external_id,
            gate=self.gate_model,
            data={
                "amount": amount_db,
                "source": source,
                "source_payload": source_payload,
            },
        )
        await operation_log(
            operation.pk,
            LogTag.CREATE,
            f"DEPOSIT created via {source}, amount_db={amount_db}",
        )

        self.logger.info(
            "Created DEPOSIT operation #%s: account=%s, amount_db=%s, external_id=%s",
            operation.pk,
            account.pk,
            amount_db,
            external_id,
        )

        # Публикуем в fiscal_stream — fiscal зачислит средства через Transaction
        await self._publish_to_fiscal(operation, gate_result={})

        return operation

    def _parse_amount_db(self, amount_str: str, currency) -> int:
        """Конвертирует строковую сумму в amount_db (integer)."""
        from decimal import Decimal, ROUND_HALF_UP

        amount_decimal = Decimal(str(amount_str))
        denominator = currency.denominator if currency else 2
        return int(
            (amount_decimal * 10**denominator).to_integral_value(rounding=ROUND_HALF_UP)
        )

    async def yeezypay_callback_process(self, data: dict):
        """Точка входа — обработка callback-сообщений из In-Callbacks API.

        Формат сообщения (от in_callbacks API через NATS):
        {
            "gate_code": "yeezypay",
            "payload": { ...raw webhook body from YeezyPay... },
            "received_at": "ISO-8601"
        }

        Поток: callback → Operation(DEPOSIT, CRYPTO) → fiscal_stream.
        Движение средств (зачисление, комиссия) — только через FiscalMicroservice.
        """
        self.logger.info("Received crypto callback: %r", data)

        payload = data.get("payload") or {}
        if not payload:
            self.logger.warning("Empty payload in callback message: %r", data)
            return

        # 1. Определяем идентификатор кошелька
        wallet_id = payload.get("wallet_id") or payload.get("external_id")
        address = payload.get("address") or payload.get("wallet_address")

        if not address and not wallet_id:
            self.logger.warning("No wallet identifier in callback payload: %r", payload)
            return

        # 2. Ищем Account — приоритет по wallet_id (external_id), он стабилен.
        #    address может меняться при перегенерации на стороне YeezyPay.
        account = None
        if wallet_id:
            account = (
                await Account.filter(external_id=str(wallet_id))
                .prefetch_related("currency", "client")
                .first()
            )
        if not account and address:
            account = (
                await Account.filter(address=address)
                .prefetch_related("currency", "client")
                .first()
            )

        if not account:
            self.logger.warning(
                "Account not found for callback: address=%s, wallet_id=%s",
                address,
                wallet_id,
            )
            return

        # 3. Дедупликация (быстрая проверка по Account.data)
        operation_id = str(payload.get("operation_id") or payload.get("tx_hash") or "")
        account_data = dict(account.data) if account.data else {}
        processed = account_data.get("processed_callbacks", [])

        if operation_id and operation_id in processed:
            self.logger.info(
                "Callback already processed: operation_id=%s, account=%s",
                operation_id,
                account.pk,
            )
            return

        # 4. Создаём Operation(DEPOSIT) и отправляем в fiscal
        amount_str = payload.get("amount")
        if not amount_str:
            self.logger.warning(
                "No amount in callback payload: account=%s, payload=%r",
                account.pk,
                payload,
            )
            return

        try:
            deposit_amount_db = self._parse_amount_db(amount_str, account.currency)
            await self._create_deposit_and_publish(
                account=account,
                amount_db=deposit_amount_db,
                external_id=operation_id,
                source_payload=payload,
            )
        except Exception:
            self.logger.exception(
                "Failed to create deposit operation: account=%s, amount=%s",
                account.pk,
                amount_str,
            )
            return

        # 5. Записываем operation_id в processed-список (быстрый кэш для дедупликации)
        if operation_id and operation_id not in processed:
            processed.append(operation_id)
            if len(processed) > self.MAX_PROCESSED_IDS:
                processed = processed[-self.MAX_PROCESSED_IDS :]

            # Перечитываем (могло обновиться в _create_deposit_and_publish)
            account = await Account.get(pk=account.pk)
            account_data = dict(account.data) if account.data else {}
            account_data["processed_callbacks"] = processed
            account_data["last_callback"] = {
                "operation_id": operation_id,
                "received_at": data.get("received_at"),
            }
            await Account.filter(pk=account.pk).update(data=account_data)

    async def inner_run(self):
        self.logger.info("YeezyPayMicroservice inner run started")
        assert self.nats_consumer is not None
        await asyncio.gather(
            self.nats_consumer.consume_forever(
                batch=10,
                timeout=0.5,
                retry_backoff=0.5,
            ),
            self._periodic_crypto_poll(),
        )

    # ── Crypto polling (бывший CryptoOperationsDaemon) ────

    async def _periodic_crypto_poll(self):
        """Периодический опрос крипто-кошельков (каждые crypto_poll_period сек)."""
        self.logger.info(
            "Crypto polling started with period=%ss", self.crypto_poll_period
        )
        while self.runned:
            try:
                await self._crypto_poll_iteration()
            except Exception:
                self.logger.exception("Crypto poll iteration failed")
            await asyncio.sleep(self.crypto_poll_period)

    async def _crypto_poll_iteration(self):
        """Одна итерация: опрос балансов и операций крипто-кошельков."""
        if not self.gate:
            self.logger.warning("Gate not loaded, skipping crypto poll")
            return

        try:
            await self._sync_main_wallet_balance()
        except Exception:
            self.logger.exception("Failed to sync main wallet balance")

        try:
            await self._sync_child_wallets()
        except Exception:
            self.logger.exception("Failed to sync child wallets")

    async def _sync_main_wallet_balance(self):
        """Запрашивает баланс основного кошелька и логирует его."""
        result = await self.gate.crypto_balance_main()
        self.logger.info("Main wallet balance response: %r", result)

        data = result.get("data") or result
        balance_str = data.get("balance")

        if balance_str is not None:
            self.logger.info("Main wallet balance: %s", balance_str)
        else:
            self.logger.warning("No balance in main wallet response: %r", result)

    async def _sync_child_wallets(self):
        """Загружает все Account с external_id и обновляет их операции."""
        accounts = await Account.filter(
            external_id__isnull=False,
            status__in=[
                Account.Status.ACTIVE,
                Account.Status.RESTORED,
            ],
        ).prefetch_related("currency")

        if not accounts:
            self.logger.info("No active crypto accounts found, skipping")
            return

        self.logger.info("Found %d active crypto accounts to sync", len(accounts))

        for account in accounts:
            try:
                await self._sync_account(account)
            except Exception:
                self.logger.exception(
                    "Failed to sync account %s (address=%s)",
                    account.pk,
                    account.address,
                )

    async def _sync_account(self, account: Account):
        """Синхронизирует один аккаунт: проверяет адрес и опрашивает операции."""
        wallet_id = account.external_id

        if not wallet_id:
            self.logger.warning(
                "Account %s has no external_id (wallet_id), skipping sync",
                account.pk,
            )
            return

        # 1. Проверяем актуальность wallet info (адрес может смениться)
        try:
            await self._poll_sync_wallet_info(account, wallet_id)
            account = await Account.get(pk=account.pk).prefetch_related(
                "currency", "client"
            )
        except Exception:
            self.logger.exception(
                "Failed to sync wallet info for account %s", account.pk
            )

        # 2. Запрашиваем список операций — именно из них создаём депозиты
        try:
            ops_result = await self.gate.crypto_operations_list(
                wallet_id=wallet_id,
                page=1,
                page_size=50,
            )
            await self._poll_process_operations(account, ops_result)
        except Exception:
            self.logger.exception("Failed to get operations for account %s", account.pk)

    async def _poll_sync_wallet_info(self, account: Account, wallet_id: str):
        """Запрашивает crypto_wallet_info и обновляет адрес если он изменился."""
        result = await self.gate.crypto_wallet_info(wallet_id=wallet_id)

        wallet_data = result.get("data") or result
        new_address = wallet_data.get("wallet_address") or wallet_data.get("address")

        if not new_address:
            return

        old_address = account.address

        if new_address == old_address:
            return

        # Адрес изменился — обновляем
        self.logger.warning(
            "Address changed for account %s: %s → %s (wallet_id=%s)",
            account.pk,
            old_address,
            new_address,
            wallet_id,
        )

        await Account.filter(pk=account.pk).update(
            address=new_address,
            external_updated_at=timezone.now(),
        )

        await account.fetch_related("client")
        await self._notify_address_changed(account, old_address or "", new_address)

    def _is_deposit_operation(self, op: dict) -> bool:
        """Определяет, является ли операция от API депозитом (пополнением)."""
        op_kind = (op.get("kind") or op.get("type") or "").lower()
        return op_kind in DEPOSIT_OP_KINDS

    async def _poll_process_operations(self, account: Account, ops_result: dict):
        """Обрабатывает список операций: создаёт Operation(DEPOSIT) для новых
        пополнений и публикует в fiscal_stream.
        """
        data = ops_result.get("data") or ops_result
        operations = data.get("operations") or data.get("items") or []

        if not operations:
            self.logger.debug("No operations for account %s", account.pk)
            return

        account = await Account.get(pk=account.pk).prefetch_related(
            "currency", "client"
        )
        account_data = dict(account.data) if account.data else {}
        processed = set(account_data.get("processed_operations", []))

        new_ops_count = 0
        new_ids = []

        for op in operations:
            op_id = str(op.get("id") or op.get("operation_id") or "")
            if not op_id or op_id in processed:
                continue

            new_ops_count += 1
            new_ids.append(op_id)

            op_kind = op.get("kind") or op.get("type") or "unknown"
            op_amount = op.get("amount") or op.get("value") or "?"
            op_status = op.get("status") or "?"

            self.logger.info(
                "New operation for account %s: id=%s, kind=%s, amount=%s, status=%s",
                account.pk,
                op_id,
                op_kind,
                op_amount,
                op_status,
            )

            if self._is_deposit_operation(op):
                amount_str = str(op.get("amount") or op.get("value") or "0")
                try:
                    deposit_amount_db = self._parse_amount_db(
                        amount_str, account.currency
                    )
                    await self._create_deposit_and_publish(
                        account=account,
                        amount_db=deposit_amount_db,
                        external_id=op_id,
                        source_payload=op,
                        source="crypto_poll",
                    )
                except Exception:
                    self.logger.exception(
                        "Failed to create deposit operation: account=%s, op_id=%s",
                        account.pk,
                        op_id,
                    )

        if new_ids:
            account = await Account.get(pk=account.pk)
            account_data = dict(account.data) if account.data else {}
            existing_processed = account_data.get("processed_operations", [])

            all_processed = existing_processed + [
                oid for oid in new_ids if oid not in existing_processed
            ]
            if len(all_processed) > self.MAX_PROCESSED_IDS:
                all_processed = all_processed[-self.MAX_PROCESSED_IDS :]

            account_data["processed_operations"] = all_processed
            account_data["last_poll"] = {
                "timestamp": str(timezone.now()),
                "new_operations_count": new_ops_count,
                "total_operations_in_response": len(operations),
            }

            await Account.filter(pk=account.pk).update(data=account_data)

            self.logger.info(
                "Processed %d new operations for account %s (%d deposits)",
                new_ops_count,
                account.pk,
                sum(
                    1
                    for op in operations
                    if str(op.get("id") or op.get("operation_id") or "") in new_ids
                    and self._is_deposit_operation(op)
                ),
            )
