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
def out_callbacks():
    """Запуск сервиса исходящих коллбэков (доставка вебхуков клиентам)"""
    from microservices.out_callbacks import (  # pylint: disable=import-outside-toplevel
        OutCallbackMicroservice,
    )

    daemon = OutCallbackMicroservice()
    asyncio.run(daemon.run())


@app.command()
def yeezypay_gate(crypto_poll_period: int = 60):
    """Запуск гейта YeezyPay (карточные операции + опрос крипто-кошельков)"""
    from gates.impls.yeezypay import (  # pylint: disable=import-outside-toplevel
        YeezyPayMicroservice,
    )

    daemon = YeezyPayMicroservice(crypto_poll_period=crypto_poll_period)
    asyncio.run(daemon.run())


@app.command()
def in_callbacks(host: str = "0.0.0.0", port: int = 8001):
    """Запуск API для приёма входящих вебхуков от гейтов (CALL_GATES env)"""
    import uvicorn  # pylint: disable=import-outside-toplevel
    from api.in_callbacks import (  # pylint: disable=import-outside-toplevel
        app as callback_app,
    )

    uvicorn.run(callback_app, host=host, port=port)


@app.command()
def trongrid_monitor(period: int = 15):
    """Запуск TronGrid мониторинга — быстрое обнаружение USDT TRC20 депозитов"""
    from daemons.trongrid_monitor import (  # pylint: disable=import-outside-toplevel
        TronGridMonitorDaemon,
    )

    daemon = TronGridMonitorDaemon(period=period)
    asyncio.run(daemon.run())


@app.command()
def webapp_api(host: str = "0.0.0.0", port: int = 8002):
    """Запуск WebApp API для веб-интерфейса (Telegram Mini App + standalone)"""
    import uvicorn  # pylint: disable=import-outside-toplevel
    from api.webapp import (  # pylint: disable=import-outside-toplevel
        app as webapp_app,
    )

    uvicorn.run(webapp_app, host=host, port=port)


@app.command()
def notifications(period: int = 15):
    """Запуск daemon'а для отправки Telegram-уведомлений о завершённых операциях"""
    from daemons.notifications import (  # pylint: disable=import-outside-toplevel
        NotificationDaemon,
    )

    daemon = NotificationDaemon(period=period)
    asyncio.run(daemon.run())


if __name__ == "__main__":
    app()
