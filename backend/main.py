import asyncio
import typer


app = typer.Typer()


def run_daemon(coro):
    asyncio.run(coro)


@app.command()
def bot():
    from bot.bot import main  # pylint: disable=import-outside-toplevel

    main()


if __name__ == "__main__":
    app()
