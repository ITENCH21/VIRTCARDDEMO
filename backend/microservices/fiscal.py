from base_daemon import BaseHandler
import logging

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


class FiscalMicroservice(BaseHandler):
    name = "FiscalMicroservice"
    with_nats = True
    nats_stream_name = "fiscal_stream"
    subjects = ["fiscal"]

    async def on_start(self):
        pass

    async def on_stop(self):
        await super().on_stop()

    async def fiscal_process(self, data: dict):
        self.logger.info("Fiscal process %r", data)

    async def inner_run(self):
        logger.info("Inner run")
        assert self.nats_consumer is not None
        await self.nats_consumer.consume_forever(
            batch=10,
            timeout=0.5,
            retry_backoff=0.5,
        )
