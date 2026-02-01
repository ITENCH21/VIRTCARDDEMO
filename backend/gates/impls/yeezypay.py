"""
YeezyPay Gate — микросервис для работы с YeezyPay Virtual Cards API.

Получает задачи по NATS (card_open, card_topup, card_close, card_block, card_restore),
выполняет HTTP-запросы к YeezyPay VC API и публикует результат обратно в fiscal_stream.
"""

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
)
from models.enums import OperationKind
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

    # ── Card operations ──────────────────────────────────

    async def card_open(
        self, account_external_id: str, amount: int, currency_code: str, **kwargs
    ) -> dict:
        """POST /vc-api/v1/cards/open"""
        body = {"amount": amount}
        if kwargs.get("card_name"):
            body["card_name"] = kwargs["card_name"]
        result = await self._request("POST", "/vc-api/v1/cards/open", json=body)
        card = result.get("card", {})
        credentials = result.get("credentials") or {}
        return {
            "card_id": str(card.get("id", "")),
            "sensitive": {
                "card_number": credentials.get("card_number"),
                "cvv": credentials.get("cvv"),
                "expiry_month": credentials.get("expiry_month"),
                "expiry_year": credentials.get("expiry_year"),
            },
            "status": card.get("status"),
        }

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

    async def get_card_balance(self, card_id: str) -> Optional[int]:
        """GET /vc-api/v1/cards/{card_id}"""
        try:
            result = await self._request("GET", f"/vc-api/v1/cards/{card_id}")
            return result.get("card", {}).get("balance")
        except Exception:
            self.logger.exception("Failed to get balance for card %s", card_id)
            return None

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
    subjects = ["yeezypay_gate"]

    def __init__(self):
        super().__init__()
        self.gate: Optional[YeezyPayGate] = None
        self.gate_model: Optional[Gate] = None

    async def _load_gate(self):
        """Load Gate record from DB and initialize YeezyPayGate with credentials."""

        self.gate_model = await Gate.filter(
            code="yeezypay", status=Gate.Status.ACTIVE
        ).first()
        assert self.gate_model is not None
        credentials = self.gate_model.credentials or {}
        self.gate = YeezyPayGate(credentials=credentials)

    async def on_start(self):
        """Load gate from DB and authenticate."""
        await self._load_gate()
        assert self.gate is not None
        try:
            await self.gate.authenticate()
            self.logger.info("YeezyPay gate authenticated on start")
        except Exception:
            self.logger.exception(
                "Failed to authenticate on start, will retry on first request"
            )

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
        """Помечает операцию как FAILED и публикует результат в fiscal."""
        self.logger.error("Operation #%s FAILED: %s", operation.pk, error)
        await Operation.filter(pk=operation.pk).update(
            status=Operation.Status.FAILED,
            updated_at=timezone.now(),
            done_at=timezone.now(),
        )
        await self._publish_to_fiscal(operation, {"error": error})

    async def _publish_to_fiscal(self, operation: Operation, gate_result: dict):
        """Публикует результат гейта в fiscal_stream для дальнейшей обработки."""
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
        amount = op_data.get("amount", 0) if isinstance(op_data, dict) else 0
        card_name = op_data.get("card_name") if isinstance(op_data, dict) else None

        try:
            result = await self.gate.card_open(
                account_external_id=account.external_id or str(account.pk),
                amount=amount,
                currency_code=currency.code if currency else "USD",
                card_name=card_name,
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
        amount = op_data.get("amount", 0) if isinstance(op_data, dict) else 0

        try:
            result = await self.gate.card_topup(
                card_id=card_id,
                amount=amount,
                currency_code=currency.code if currency else "USD",
            )
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
            self.logger.info("Card restored: %r (op #%s)", result, operation.pk)

            await Operation.filter(pk=operation.pk).update(
                status=Operation.Status.OPERATING,
                updated_at=timezone.now(),
            )
            await self._publish_to_fiscal(operation, result)

        except Exception as e:
            await self._fail_operation(operation, str(e))

    # ── NATS entry point ─────────────────────────────────

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

    async def inner_run(self):
        self.logger.info("YeezyPayMicroservice inner run started")
        assert self.nats_consumer is not None
        await self.nats_consumer.consume_forever(
            batch=10,
            timeout=0.5,
            retry_backoff=0.5,
        )
