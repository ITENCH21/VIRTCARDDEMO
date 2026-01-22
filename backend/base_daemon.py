import asyncio
import logging
import time

from models import start_orm, stop_orm

logging.basicConfig(
    format="[%(asctime)s] %(levelname)s  <%(module)s> %(message)s",
    level=logging.INFO,
)


class BaseHandler:
    name = None
    with_orm = True

    def __init__(self):
        self.name = self.name or self.__class__.__name__

        self.logger = logging.getLogger(self.name)
        self.runned = False
        self.logger.info("Init")
        self.iter_count = 0

    async def inner_run(self):
        raise NotImplementedError("one_iter")

    async def on_start(self):
        raise NotImplementedError("on_start")

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
            await self.on_stop()

    async def on_stop(self):
        self.logger.info("Daemon stopped")
        return


class BaseHandlerWorker:
    name = None
    with_orm = True

    def __init__(self, period):
        self.name = self.name or self.__class__.__name__
        self.logger = logging.getLogger(self.name)
        self.runned = False
        self.iter_count = 0
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

    async def run(self):
        await start_orm()
        self.runned = True
        self.logger.info("Daemon running...")
        await asyncio.create_task(self.inner_run())

    async def post_stop(self):
        await stop_orm()


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
