from typing import Any
import random
import string
import logging

from models.models import Account, Client, ClientGroup, Currency, User, DoesNotExist

logger = logging.getLogger("register")


def gen_token(size=32, chars=[string.ascii_letters, string.digits, string.punctuation]):
    return "".join(random.choice("".join(chars)) for _ in range(size))


def gen_username(size=32):
    return gen_token(size, [string.ascii_letters, string.digits])


async def get_or_create_client(
    telegram_id: int,
    first_name: str = "",
    last_name: str = "",
    email: str = "",
    phone: str = "",
    username: str = "",
    referral_code: str = "",
    **kwargs: Any,
) -> Client:

    logger.info("Telegram register")

    try:
        client = await Client.get(telegram_id=telegram_id)
    except DoesNotExist:
        logger.info("Create new user on telegram register!")
        if not username:
            username = f"{first_name}_{telegram_id}"
        if await User.filter(username=username).exists():
            username = f"{username}_{gen_username(8)}"

        group = None
        if referral_code:
            try:
                group = await ClientGroup.get(referral_code=referral_code)
                logger.info("Referral group found: %s", group.name)
            except DoesNotExist:
                logger.warning("Referral code not found: %s", referral_code)

        user = await User.create(
            username=username,
            first_name=first_name,
            last_name=last_name or "",
            password="",
            email=email or "",
        )
        client = await Client.create(
            user=user,
            email=email,
            phone=phone,
            name=f"{first_name} {last_name or ''}",
            telegram_id=telegram_id,
            telegram_username=username,
            telegram_photo_url=kwargs.get("photo_url"),
            telegram_auth_date=kwargs.get("date"),
            telegram_language_code=kwargs.get("language_code"),
            group=group,
        )
        await create_default_accounts(client)

    return client


async def create_default_accounts(client: Client) -> None:
    currencies = await Currency.filter(is_active=True)
    for currency in currencies:
        exists = await Account.filter(client=client, currency=currency).exists()
        if not exists:
            await Account.create(client=client, currency=currency)
