import asyncio
import inspect
import json
import logging
import os
from typing import Any, Optional

import nats
from nats.js.api import AckPolicy, ConsumerConfig, DeliverPolicy, StreamConfig
from nats.errors import NoServersError


logger = logging.getLogger(__name__)


class NatsConfig:
    def __init__(self):
        """Читает настройки NATS из переменных окружения."""
        raw_servers = os.getenv("NATS_SERVERS", "127.0.0.1:4222")
        # nats.py ожидает схему; добавляем по умолчанию и если ее нет
        self._servers = self._normalize_servers(raw_servers)
        self._connect_timeout = float(os.getenv("NATS_CONNECT_TIMEOUT", "2.0"))
        self._op_timeout = float(os.getenv("NATS_OP_TIMEOUT", "5.0"))
        self._max_ack_pending = int(os.getenv("NATS_MAX_ACK_PENDING", "200"))
        self._max_deliver = int(os.getenv("NATS_MAX_DELIVER", "5"))
        self._retry_backoff = float(os.getenv("NATS_RETRY_BACKOFF", "0.5"))
        self._max_backoff = float(os.getenv("NATS_MAX_BACKOFF", "5.0"))

    @staticmethod
    def _normalize_servers(servers: str) -> list[str]:
        normalized = []
        for server in servers.split(","):
            server = server.strip()
            if not server:
                continue
            if "://" not in server:
                server = f"nats://{server}"
            normalized.append(server)
        return normalized


class NatsProducer(NatsConfig):
    def __init__(
        self,
        stream_name: str = "updates_stream",
        subjects: Optional[list[str]] = None,
    ):
        """Инициализирует producer и его подключения."""
        self._nc: Optional[Any] = None
        self._js: Optional[Any] = None
        self._stream_name = stream_name
        self._subjects = subjects if subjects is not None else [">"]
        if not self._subjects:
            raise ValueError("subjects must not be empty")
        self._stream_ready = False
        super().__init__()

    async def connect(self):
        """Устанавливает соединение с NATS и JetStream (один раз)."""
        if self._nc is None or self._nc.is_closed:
            self._nc = await nats.connect(
                self._servers,
                connect_timeout=self._connect_timeout,
            )
            self._js = self._nc.jetstream()

    async def _ensure_stream(self):
        """Гарантирует наличие JetStream-стрима."""
        if self._stream_ready:
            return
        await self.connect()
        assert self._js is not None
        try:
            info = await self._js.stream_info(self._stream_name)
            existing_subjects = set(info.config.subjects or [])
            desired_subjects = set(self._subjects)
            if not desired_subjects.issubset(existing_subjects):
                merged_subjects = sorted(existing_subjects | desired_subjects)
                await self._js.update_stream(
                    StreamConfig(name=self._stream_name, subjects=merged_subjects)
                )
        except Exception:
            await self._js.add_stream(
                StreamConfig(name=self._stream_name, subjects=self._subjects)
            )
        self._stream_ready = True

    async def publish(self, subject: str, payload: Any):
        """Публикует сообщение в JetStream."""
        logger.debug("Publish %r %r", subject, payload)
        await self._ensure_stream()
        assert self._js is not None

        payload_bytes = self.encode_payload(payload)
        await asyncio.wait_for(
            self._js.publish(subject, payload_bytes), timeout=self._op_timeout
        )
        assert self._nc is not None
        await asyncio.wait_for(self._nc.flush(), timeout=self._op_timeout)

    async def close(self):
        """Закрывает соединение с NATS."""
        if self._nc is not None and not self._nc.is_closed:
            await self._nc.close()

    @staticmethod
    def encode_payload(payload: Any) -> bytes:
        if isinstance(payload, bytes):
            return payload
        if isinstance(payload, str):
            return payload.encode()
        return json.dumps(payload, ensure_ascii=False).encode()


class NatsConsumer(NatsConfig):
    def __init__(
        self,
        stream_name: str = "updates_stream",
        durable: str = "updates_consumer",
    ):
        """Инициализирует consumer и его подключения."""
        self._nc: Optional[Any] = None
        self._js: Optional[Any] = None
        self._subscriptions: list[Any] = []
        self._stream_name = stream_name
        self._subjects = self.discover_subjects()
        if not self._subjects:
            raise ValueError("No subjects discovered; define *_process methods.")
        self._durable = durable
        self._stream_ready = False
        super().__init__()

    async def connect(self):
        """Устанавливает соединение с NATS и JetStream (один раз)."""
        if self._nc is None or self._nc.is_closed:
            self._nc = await nats.connect(
                self._servers,
                connect_timeout=self._connect_timeout,
            )
            self._js = self._nc.jetstream()

    async def _ensure_stream(self):
        """Гарантирует наличие JetStream-стрима."""
        if self._stream_ready:
            return
        await self.connect()
        assert self._js is not None
        try:
            info = await self._js.stream_info(self._stream_name)
            existing_subjects = set(info.config.subjects or [])
            desired_subjects = set(self._subjects)
            if not desired_subjects.issubset(existing_subjects):
                merged_subjects = sorted(existing_subjects | desired_subjects)
                await self._js.update_stream(
                    StreamConfig(name=self._stream_name, subjects=merged_subjects)
                )
        except Exception:
            await self._js.add_stream(
                StreamConfig(name=self._stream_name, subjects=self._subjects)
            )
        self._stream_ready = True

    async def _ensure_subscriptions(self):
        """Создает pull-подписки на все subjects, если их еще нет."""
        if self._subscriptions:
            return
        await self._ensure_stream()
        assert self._js is not None
        consumer_config = ConsumerConfig(
            deliver_policy=DeliverPolicy.ALL,
            ack_policy=AckPolicy.EXPLICIT,
            max_ack_pending=self._max_ack_pending,
            max_deliver=self._max_deliver,
        )
        for subject in self._subjects:
            subscription = await asyncio.wait_for(
                self._js.pull_subscribe(
                    subject,
                    durable=f"{self._durable}_{subject}",
                    config=consumer_config,
                ),
                timeout=self._op_timeout,
            )
            self._subscriptions.append(subscription)

    async def _fetch_and_process(
        self, subscription, handler, batch: int = 10, timeout: float = 1.0
    ):
        """Забирает batch сообщений из подписки, вызывает handler и делает ack/nak."""
        logger.debug("Fetch %r %r", subscription, batch)
        msgs = await subscription.fetch(batch=batch, timeout=timeout)
        logger.debug("Fetched %r", msgs)
        for msg in msgs:
            try:
                await handler(msg)
                await msg.ack()
            except Exception:
                await msg.nak()

    async def consume_forever(
        self,
        batch: int = 10,
        timeout: float = 1.0,
        retry_backoff: Optional[float] = None,
        max_backoff: Optional[float] = None,
    ):
        """Бесконечно обрабатывает сообщения с экспоненциальным backoff."""
        await self._ensure_subscriptions()
        base_backoff = self._retry_backoff if retry_backoff is None else retry_backoff
        backoff_cap = self._max_backoff if max_backoff is None else max_backoff
        backoff = base_backoff
        while True:
            try:
                for subscription in self._subscriptions:
                    await self._fetch_and_process(
                        subscription, self.message_process, batch=batch, timeout=timeout
                    )
                backoff = base_backoff
            except (asyncio.TimeoutError, Exception):
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, backoff_cap)

    async def unsubscribe(self):
        """Отписывается от pull-подписки, если она есть."""
        for subscription in self._subscriptions:
            await subscription.unsubscribe()
        self._subscriptions = []

    async def close(self):
        """Закрывает соединение с NATS."""
        if self._nc is not None and not self._nc.is_closed:
            await self._nc.close()

    @staticmethod
    def decode_message_data(data: bytes) -> Any:
        text = data.decode()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text

    def discover_subjects(self) -> list[str]:
        subjects = []
        for name in dir(self):
            if not name.endswith("_process"):
                continue
            if name in {"message_process", "processing", "_fetch_and_process"}:
                continue
            method = getattr(self, name, None)
            if method is None:
                continue
            if not inspect.iscoroutinefunction(method):
                continue
            subjects.append(name[: -len("_process")])
        logger.debug("Discovered subjects: %s", subjects)
        return subjects

    async def processing(self, data, topic):
        try:
            await getattr(self, f"{topic.lower()}_process")(data)
        except Exception as e:
            uid = data.get("operation_guid")
            logger.exception(e)
            if uid:  # message from tron havent uid
                logger.error("%s ERROR Manager.%s", uid, topic)

    async def message_process(self, msg):
        data = self.decode_message_data(msg.data)
        await self.processing(data, msg.subject)

    async def test_process(self, data):
        logger.info("Test process %r", data)


async def main():
    """Пример запуска producer/consumer и бесконечного потребления."""
    consumer = NatsConsumer(stream_name="updates_stream")
    producer = NatsProducer(
        stream_name="updates_stream", subjects=consumer.discover_subjects()
    )

    try:
        message_data = {"dict": "data"}
        await producer.publish("test", message_data)

        await consumer.consume_forever(
            batch=10,
            timeout=1.0,
        )
    except NoServersError as e:
        logger.error("Could not connect to NATS server: %s", e)
    except asyncio.CancelledError:
        logger.info("Shutdown requested")
    except Exception as e:
        logger.exception(e)
    finally:
        await consumer.close()
        await producer.close()
        logger.info("Connection closed")


if __name__ == "__main__":
    # Run the main asynchronous function
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(main())
