import asyncio
import typer


app = typer.Typer()


def run_daemon(coro):
    asyncio.run(coro)


@app.command()
def bot():
    from bot.bot import main  # pylint: disable=import-outside-toplevel

    main()


@app.command()
def fiscal():
    from microservices.fiscal import (
        FiscalMicroservice,
    )  # pylint: disable=import-outside-toplevel

    daemon = FiscalMicroservice()
    asyncio.run(daemon.run())


@app.command()
def rates(period: int = 300):
    """Запуск daemon'а для парсинга курсов валют"""
    from daemons.rates import RatesDaemon  # pylint: disable=import-outside-toplevel

    daemon = RatesDaemon(period=period)  # 5 минут
    asyncio.run(daemon.run())


@app.command()
def callbacks():
    """Запуск сервиса обработки коллбэков"""
    from microservices.callbacks import (
        CallbackMicroservice,
    )  # pylint: disable=import-outside-toplevel

    daemon = CallbackMicroservice()
    asyncio.run(daemon.run())


if __name__ == "__main__":
    app()
