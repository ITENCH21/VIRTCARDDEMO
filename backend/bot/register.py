from typing import Any
import random
import string
import logging
import uuid

from models.models import Account, Client, ClientGroup, Currency, User, DoesNotExist
from common.nats_utils import AsyncNatsProducer

logger = logging.getLogger("register")

CRYPTO_CURRENCY_CODE = "USDT-TRC20"


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


async def publish_wallet_request(account_id: str, currency_code: str) -> bool:
    """Публикует fire-and-forget запрос на создание crypto wallet.

    Gate (yeezypay_crypto_process) сам сохранит результат в Account.
    Дублирование запросов предотвращается на стороне gate.

    Returns:
        True если сообщение опубликовано, False при ошибке.
    """
    producer = AsyncNatsProducer(
        subjects=["yeezypay_crypto"],
        stream_name="gates_stream",
    )
    try:
        message = {
            "action": "crypto_wallet_create",
            "params": {"currency_code": currency_code},
            "account_id": str(account_id),
            "request_id": str(uuid.uuid4()),
        }
        await producer.publish("yeezypay_crypto", message)
        logger.info(
            "Published crypto_wallet_create for account %s (currency=%s)",
            account_id,
            currency_code,
        )
        return True
    except Exception:
        logger.exception(
            "Failed to publish crypto_wallet_create for account %s", account_id
        )
        return False
    finally:
        await producer.close()


async def create_default_accounts(client: Client) -> None:
    currencies = await Currency.filter(is_active=True)
    for currency in currencies:
        exists = await Account.filter(client=client, currency=currency).exists()
        if not exists:
            account = await Account.create(client=client, currency=currency)

            # Для USDT-TRC20 отправляем fire-and-forget запрос на создание wallet.
            # Gate сам сохранит адрес кошелька в Account.
            if currency.code == CRYPTO_CURRENCY_CODE:
                ok = await publish_wallet_request(str(account.pk), currency.code)
                if ok:
                    logger.info(
                        "Wallet request sent for USDT-TRC20 account %s",
                        account.pk,
                    )
                else:
                    logger.warning(
                        "USDT-TRC20 account %s created without wallet request "
                        "(NATS unavailable, can be retried from admin)",
                        account.pk,
                    )
