import asyncio


async def run() -> None:
    while True:
        await asyncio.sleep(60)


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
