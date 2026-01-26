import asyncio
import logging
import time

from models import start_orm, stop_orm
from common.nats_async import NatsProducer, NatsConsumer


logging.basicConfig(
    format="[%(asctime)s] %(levelname)s  <%(module)s> %(message)s",
    level=logging.INFO,
)


class BaseHandler:
    name = None
    with_orm = True
    with_nats = False
    nats_stream_name = "updates_stream"
    subjects = None

    def __init__(self):
        self.name = self.name or self.__class__.__name__
        self.logger = logging.getLogger(self.name)
        self.runned = False
        self.logger.info("Init")
        self.iter_count = 0
        self.nats_producer = None
        self.nats_consumer = None

    async def inner_run(self):
        raise NotImplementedError("one_iter")

    async def on_start(self):
        raise NotImplementedError("on_start")

    async def start_nats(self):
        assert self.subjects is not None, "subjects must be set"
        self.nats_producer = NatsProducer(
            stream_name=self.nats_stream_name, subjects=self.subjects
        )
        self.nats_consumer = NatsConsumer(stream_name=self.nats_stream_name)
        await self.nats_producer.connect()
        await self.nats_consumer.connect()

    async def run(self):
        if self.with_orm:
            await start_orm()
        await self.on_start()
        self.runned = True
        self.logger.info("Daemon running...")
        await asyncio.sleep(3)
        try:
            await self.inner_run()
        finally:
            if self.with_orm:
                await stop_orm()
            if self.with_nats:
                if self.nats_producer is not None:
                    await self.nats_producer.close()
                if self.nats_consumer is not None:
                    await self.nats_consumer.close()
            await self.on_stop()

    async def on_stop(self):
        self.logger.info("Daemon stopped")
        return


class PeriodicBaseHandler(BaseHandler):
    def __init__(self, period):
        super().__init__()
        self.period = period
        self.cooldown = False
        self.cooldown_period = 60

    async def one_iter(self):
        raise NotImplementedError("one_iter")

    async def inner_run(self):
        while self.runned:
            if not self.cooldown:
                self.iter_count += 1
                self.logger.info(
                    "Start iter %r with period %r", self.iter_count, self.period
                )
                start_at = time.time()
                try:
                    await self.one_iter()
                except Exception as err:
                    self.logger.exception(err)

                sleep = self.period - (time.time() - start_at)
                self.logger.info("Delayed for %r seconds", sleep)
                await asyncio.sleep(sleep)
            else:
                self.logger.info(
                    "Cooldown after %r iter for %r",
                    self.iter_count,
                    self.cooldown_period,
                )
                await asyncio.sleep(self.cooldown_period)
                self.cooldown = False
