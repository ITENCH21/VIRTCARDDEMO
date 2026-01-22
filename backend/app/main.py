import asyncio
import signal

from redis.asyncio import Redis

from .config import REDIS_HOST, REDIS_PORT
from .db import close_db, init_db


async def run() -> None:
    await init_db()
    redis = Redis(host=REDIS_HOST, port=int(REDIS_PORT))
    await redis.ping()

    stop_event = asyncio.Event()

    def _stop(*_args: object) -> None:
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _stop)

    await stop_event.wait()
    await redis.close()
    await close_db()


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
