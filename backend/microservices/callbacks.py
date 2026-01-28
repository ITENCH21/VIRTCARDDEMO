from base_daemon import BaseHandler
from models.models import Operation
from tortoise.exceptions import DoesNotExist
import logging
import aiohttp
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# example of callback message
# {
#     "type": "operation",
#     "operation_guid": "uuid-операции",
#     "callback_url": "https://example.com/webhook",
#     "callback_headers": {"Authorization": "Bearer token"},
#     "callback_data": {"additional": "data"},
# }


class CallbackMicroservice(BaseHandler):
    name = "CallbackMicroservice"
    with_nats = True
    nats_stream_name = "callbacks_stream"
    subjects = ["callback_process"]

    def __init__(self):
        super().__init__()
        self.session: Optional[aiohttp.ClientSession] = None
        self.max_retries = 3
        self.retry_delay = 1.0

    async def on_start(self):
        """Инициализация HTTP сессии для отправки коллбэков"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=100),
        )
        self.logger.info("CallbackMicroservice started")

    async def on_stop(self):
        """Закрытие HTTP сессии"""
        if self.session:
            await self.session.close()
        await super().on_stop()
        self.logger.info("CallbackMicroservice stopped")

    async def _send_callback(
        self, url: str, payload: dict, headers: Optional[dict] = None
    ) -> bool:
        """Отправка коллбэка на указанный URL с повторными попытками"""
        if not url:
            self.logger.warning("Callback URL is empty")
            return False

        if self.session is None:
            self.logger.error("HTTP session is not initialized")
            return False

        if headers is None:
            headers = {"Content-Type": "application/json"}

        for attempt in range(self.max_retries):
            try:
                self.logger.info(
                    "Sending callback to %s (attempt %d/%d)",
                    url,
                    attempt + 1,
                    self.max_retries,
                )
                async with self.session.post(
                    url, json=payload, headers=headers
                ) as response:
                    if response.status in (200, 201, 202, 204):
                        self.logger.info(
                            "Callback sent successfully to %s, status: %d",
                            url,
                            response.status,
                        )
                        return True
                    else:
                        text = await response.text()
                        self.logger.warning(
                            "Callback failed to %s, status: %d, response: %s",
                            url,
                            response.status,
                            text[:200],
                        )
                        if attempt < self.max_retries - 1:
                            await asyncio.sleep(self.retry_delay * (attempt + 1))
            except aiohttp.ClientError as e:
                self.logger.warning(
                    "Callback error to %s (attempt %d/%d): %s",
                    url,
                    attempt + 1,
                    self.max_retries,
                    e,
                )
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
            except Exception as e:
                self.logger.exception(
                    "Unexpected error sending callback to %s: %s", url, e
                )
                return False

        self.logger.error(
            "Failed to send callback to %s after %d attempts", url, self.max_retries
        )
        return False

    async def _prepare_callback_payload(self, operation: Operation, data: dict) -> dict:
        """Подготовка payload для коллбэка на основе операции"""
        await operation.fetch_related("account", "account__client", "currency")

        payload = {
            "operation_id": str(operation.id),
            "status": operation.status,
            "kind": operation.kind,
            "amount": float(operation.amount) if operation.amount else 0.0,
            "fee": float(operation.fee) if operation.fee else 0.0,
            "currency": operation.currency.code if operation.currency else None,
            "account_id": str(operation.account.id) if operation.account else None,
            "client_id": (
                str(operation.account.client.id)
                if operation.account and operation.account.client
                else None
            ),
            "created_at": (
                operation.created_at.isoformat() if operation.created_at else None
            ),
            "updated_at": (
                operation.updated_at.isoformat() if operation.updated_at else None
            ),
            "done_at": operation.done_at.isoformat() if operation.done_at else None,
        }

        # Добавляем дополнительные данные из data, если они есть
        if isinstance(data, dict) and "callback_data" in data:
            callback_data = data["callback_data"]
            if isinstance(callback_data, dict):
                payload.update(callback_data)

        return payload

    async def _process_operation_callback(self, data: dict) -> None:
        """Обработка коллбэка для операции"""
        operation_guid = data.get("operation_guid")
        if not operation_guid:
            self.logger.warning("Operation guid not found in callback data: %r", data)
            return

        try:
            operation = await Operation.get(pk=operation_guid)
        except DoesNotExist:
            self.logger.error("Operation #%s not found for callback", operation_guid)
            return

        # Получаем URL коллбэка из данных операции или из сообщения
        callback_url = data.get("callback_url")
        if not callback_url:
            # Пытаемся получить из данных операции
            operation_data = operation.data or {}
            callback_url = operation_data.get("callback_url")

        if not callback_url:
            self.logger.warning(
                "Callback URL not found for operation #%s, skipping", operation_guid
            )
            return

        # Подготавливаем payload
        payload = await self._prepare_callback_payload(operation, data)

        # Получаем дополнительные заголовки, если они есть
        headers = data.get("callback_headers", {})
        if isinstance(headers, dict):
            headers = {**headers, "Content-Type": "application/json"}
        else:
            headers = {"Content-Type": "application/json"}

        # Отправляем коллбэк
        success = await self._send_callback(callback_url, payload, headers)

        # Обновляем данные операции
        current_data = operation.data or {}
        if not isinstance(current_data, dict):
            current_data = {}

        if success:
            self.logger.info(
                "Callback processed successfully for operation #%s", operation_guid
            )
            # Добавляем метку о том, что коллбэк отправлен
            current_data["callback_sent"] = True
            current_data["callback_sent_at"] = operation.updated_at.isoformat()
        else:
            self.logger.error(
                "Failed to process callback for operation #%s", operation_guid
            )
            # Добавляем информацию об ошибке в данные операции
            current_data["callback_failed"] = True
            callback_attempts = current_data.get("callback_attempts", 0)
            if isinstance(callback_attempts, int):
                current_data["callback_attempts"] = callback_attempts + 1
            else:
                current_data["callback_attempts"] = 1

        await Operation.filter(pk=operation.pk).update(data=current_data)

    async def callback_process(self, data: dict):
        """Обработка сообщения из NATS топика callback_process"""
        self.logger.info("Received callback message: %r", data)

        try:
            callback_type = data.get("type", "operation")

            if callback_type == "operation":
                await self._process_operation_callback(data)
            else:
                self.logger.warning("Unknown callback type: %s", callback_type)

        except Exception:
            self.logger.exception("Error processing callback message: %r", data)

    async def inner_run(self):
        """Основной цикл обработки сообщений"""
        self.logger.info("CallbackMicroservice inner run started")
        assert self.nats_consumer is not None
        await self.nats_consumer.consume_forever(
            batch=10,
            timeout=0.5,
            retry_backoff=0.5,
        )
