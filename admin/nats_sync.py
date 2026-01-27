import asyncio
import inspect
import json
import logging
import os
import threading
from typing import Any, Optional

import nats
from nats.js.api import AckPolicy, ConsumerConfig, DeliverPolicy, StreamConfig
from nats.errors import NoServersError

logger = logging.getLogger(__name__)


class AsyncRunner:
    """Запускает asyncio loop в отдельном потоке и позволяет вызывать coro синхронно."""

    def __init__(self):
        self._loop = asyncio.new_event_loop()
        self._ready = threading.Event()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        self._ready.wait()

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._ready.set()
        self._loop.run_forever()

    def run(self, coro, timeout: Optional[float] = None):
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result(timeout=timeout)

    def stop(self):
        if self._loop.is_running():
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread.is_alive():
            self._thread.join()
        if not self._loop.is_closed():
            self._loop.close()


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
        subjects: list[str],
        stream_name: str = "updates_stream",
    ):
        """Инициализирует producer и его подключения (синхронный API)."""
        self._nc: Optional[Any] = None
        self._js: Optional[Any] = None
        self._stream_name = stream_name
        self._subjects = subjects
        if not self._subjects:
            raise ValueError("subjects must not be empty")
        self._stream_ready = False
        self._runner = AsyncRunner()
        super().__init__()

    async def _connect_async(self):
        if self._nc is None or self._nc.is_closed:
            self._nc = await nats.connect(
                self._servers,
                connect_timeout=self._connect_timeout,
            )
            self._js = self._nc.jetstream()

    async def _ensure_stream_async(self):
        if self._stream_ready:
            return
        await self._connect_async()
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

    async def _publish_async(self, subject: str, payload: Any):
        logger.debug("Publish %r %r", subject, payload)
        await self._ensure_stream_async()
        assert self._js is not None
        payload_bytes = self.encode_payload(payload)
        await asyncio.wait_for(
            self._js.publish(subject, payload_bytes), timeout=self._op_timeout
        )
        assert self._nc is not None
        await asyncio.wait_for(self._nc.flush(), timeout=self._op_timeout)

    async def _close_async(self):
        if self._nc is not None and not self._nc.is_closed:
            await self._nc.close()

    def connect(self):
        """Устанавливает соединение с NATS и JetStream (один раз)."""
        self._runner.run(self._connect_async(), timeout=self._connect_timeout)

    def publish(self, subject: str, payload: Any):
        """Публикует сообщение в JetStream."""
        self._runner.run(
            self._publish_async(subject, payload), timeout=self._op_timeout
        )

    def close(self):
        """Закрывает соединение с NATS."""
        self._runner.run(self._close_async(), timeout=self._op_timeout)

    def stop(self):
        """Останавливает внутренний event loop."""
        self._runner.stop()

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
        subjects: list[str],
        stream_name: str = "updates_stream",
        durable: str = "updates_consumer",
    ):
        """Инициализирует consumer и его подключения (синхронный API)."""
        self._nc: Optional[Any] = None
        self._js: Optional[Any] = None
        self._subscriptions: list[Any] = []
        self._stream_name = stream_name
        self._subjects = subjects
        if not self._subjects:
            raise ValueError("No subjects discovered; define *_process methods.")
        self._durable = durable
        self._stream_ready = False
        self._runner = AsyncRunner()
        super().__init__()

    async def _connect_async(self):
        if self._nc is None or self._nc.is_closed:
            self._nc = await nats.connect(
                self._servers,
                connect_timeout=self._connect_timeout,
            )
            self._js = self._nc.jetstream()

    async def _ensure_stream_async(self):
        if self._stream_ready:
            return
        await self._connect_async()
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

    async def _ensure_subscriptions_async(self):
        if self._subscriptions:
            return
        await self._ensure_stream_async()
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

    async def _fetch_and_process_async(
        self, subscription, handler, batch: int = 10, timeout: float = 1.0
    ):
        logger.debug("Fetch %r %r", subscription, batch)
        msgs = await subscription.fetch(batch=batch, timeout=timeout)
        logger.debug("Fetched %r", msgs)
        for msg in msgs:
            try:
                await handler(msg)
                await msg.ack()
            except Exception:
                await msg.nak()

    async def _consume_forever_async(
        self,
        batch: int = 10,
        timeout: float = 1.0,
        retry_backoff: Optional[float] = None,
        max_backoff: Optional[float] = None,
    ):
        await self._ensure_subscriptions_async()
        base_backoff = self._retry_backoff if retry_backoff is None else retry_backoff
        backoff_cap = self._max_backoff if max_backoff is None else max_backoff
        backoff = base_backoff
        while True:
            try:
                for subscription in self._subscriptions:
                    await self._fetch_and_process_async(
                        subscription, self.message_process, batch=batch, timeout=timeout
                    )
                backoff = base_backoff
            except (asyncio.TimeoutError, Exception):
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, backoff_cap)

    async def _unsubscribe_async(self):
        for subscription in self._subscriptions:
            await subscription.unsubscribe()
        self._subscriptions = []

    async def _close_async(self):
        if self._nc is not None and not self._nc.is_closed:
            await self._nc.close()

    def connect(self):
        """Устанавливает соединение с NATS и JetStream (один раз)."""
        self._runner.run(self._connect_async(), timeout=self._connect_timeout)

    def consume_forever(
        self,
        batch: int = 10,
        timeout: float = 1.0,
        retry_backoff: Optional[float] = None,
        max_backoff: Optional[float] = None,
    ):
        """Бесконечно обрабатывает сообщения с экспоненциальным backoff."""
        self._runner.run(
            self._consume_forever_async(
                batch=batch,
                timeout=timeout,
                retry_backoff=retry_backoff,
                max_backoff=max_backoff,
            )
        )

    def unsubscribe(self):
        """Отписывается от pull-подписки, если она есть."""
        self._runner.run(self._unsubscribe_async(), timeout=self._op_timeout)

    def close(self):
        """Закрывает соединение с NATS."""
        self._runner.run(self._close_async(), timeout=self._op_timeout)

    def stop(self):
        """Останавливает внутренний event loop."""
        self._runner.stop()

    @staticmethod
    def decode_message_data(data: bytes) -> Any:
        text = data.decode()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text

    async def processing(self, data, topic):
        try:
            handler = getattr(self, f"{topic.lower()}_process")
            result = handler(data)
            if inspect.isawaitable(result):
                await result
        except Exception as e:
            uid = data.get("operation_guid") if isinstance(data, dict) else None
            logger.exception(e)
            if uid:  # message from tron havent uid
                logger.error("%s ERROR Manager.%s", uid, topic)

    async def message_process(self, msg):
        data = self.decode_message_data(msg.data)
        await self.processing(data, msg.subject)

    def test_process(self, data):
        logger.info("Test process %r", data)


def main():
    """Пример запуска producer/consumer и бесконечного потребления."""
    consumer = NatsConsumer(subjects=["test"], stream_name="updates_stream")
    producer = NatsProducer(subjects=["test"], stream_name="updates_stream")

    try:
        message_data = {"dict": "data"}
        producer.publish("test", message_data)
        consumer.consume_forever(
            batch=10,
            timeout=1.0,
        )
    except NoServersError as e:
        logger.error("Could not connect to NATS server: %s", e)
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    except Exception as e:
        logger.exception(e)
    finally:
        consumer.close()
        producer.close()
        consumer.stop()
        producer.stop()
        logger.info("Connection closed")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    main()
