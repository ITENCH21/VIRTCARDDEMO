from typing import TYPE_CHECKING
import logging as _logging
import uuid
from decimal import Decimal, ROUND_HALF_UP

from tortoise.exceptions import DoesNotExist
from tortoise import timezone
from tortoise.expressions import F
from .djangoise import (
    Model,
    UUIDField,
    DateTimeField,
    TextField,
    CharField,
    ForeignKey,
    RESTRICT as PROTECT,
    JSONField,
    BooleanField,
    BigIntegerField,
    IntField,
    EmailField,
    URLField,
    OneToOneField,
    TextChoices,
    IntegerField,
    DecimalField,
    PositiveIntegerField,
    SET_NULL,
    CASCADE,
    db_transaction,
)
from .enums import OperationKind, LogTag


class BaseModel(Model):
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class User(Model):
    id = IntField(pk=True)
    password = CharField(max_length=128, null=True, blank=True)
    last_login = DateTimeField(null=True)
    is_superuser = BooleanField(default=False)
    username = CharField(max_length=150, unique=True)
    first_name = CharField(max_length=150, blank=True)
    last_name = CharField(max_length=150, blank=True, null=True)
    email = EmailField(max_length=254, blank=True, null=True)
    is_staff = BooleanField(default=False)
    is_active = BooleanField(default=True)
    date_joined = DateTimeField(auto_now_add=True)

    class Meta:
        table = "auth_user"

    def __str__(self) -> str:
        return str(self.username)


class ClientGroup(BaseModel):
    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = CharField(max_length=255, unique=True)
    description = TextField(default="", blank=True)
    referral_code = CharField(max_length=64, unique=True, null=True, blank=True)

    def __str__(self) -> str:
        return str(self.name)

    class Meta:
        table = "clients_clientgroup"


class Client(BaseModel):
    class Status(TextChoices):
        DRAFT = "D", "Draft"
        SYSTEM = "S", "System"
        ACTIVE = "A", "Active"
        PURGED = "P", "Purged"

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = OneToOneField(User, on_delete=PROTECT)
    name = CharField(max_length=255)
    email = EmailField(max_length=254, null=True, blank=True)
    status = CharField(
        max_length=1,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    description = TextField(default="", blank=True)
    phone = CharField(max_length=32, null=True, blank=True)
    phone_confirmed = BooleanField(default=False)  # type: ignore[arg-type]
    telegram_id = BigIntegerField(null=True, blank=True, unique=True)
    telegram_username = CharField(max_length=32, null=True, blank=True, unique=True)
    telegram_photo_url = URLField(null=True, blank=True)
    telegram_auth_date = DateTimeField(null=True, blank=True)
    # language_code: 'zh-hans',
    telegram_language_code = CharField(max_length=10, null=True, blank=True)

    # Email/Password auth
    password_hash = CharField(max_length=128, null=True, blank=True)
    password_salt = CharField(max_length=64, null=True, blank=True)
    # PIN auth
    pin_hash = CharField(max_length=128, null=True, blank=True)
    # WebAuthn
    webauthn_credential_id = CharField(max_length=512, null=True, blank=True)
    webauthn_public_key = TextField(null=True, blank=True)

    group = ForeignKey(
        ClientGroup,
        related_name="clients",
        on_delete=PROTECT,
        null=True,
        blank=True,
    )

    def __str__(self) -> str:
        return str(self.name)

    class Meta:
        table = "clients_client"


class Account(BaseModel):
    class Kind(TextChoices):
        DEFAULT = "D", "Default"
        VIRTUAL_CARD = "V", "VirtualCard"

    class Status(TextChoices):
        DRAFT = "D", "Draft"
        ACTIVE = "A", "Active"
        PURGE = "P", "Purge"
        BANNED = "B", "Banned"
        RESTORED = "R", "Restored"
        BLOCKED = "L", "Blocked"
        CLOSED = "C", "Closed"

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = CharField(max_length=128, null=True, blank=True, db_index=True)
    client = ForeignKey(Client, related_name="accounts", on_delete=PROTECT)
    parent = ForeignKey("models.Account", on_delete=PROTECT, null=True, blank=True)
    kind = CharField(
        max_length=1, choices=Kind.choices, db_index=True, default=Kind.DEFAULT
    )
    currency = ForeignKey("models.Currency", on_delete=PROTECT, null=True)
    amount_db = BigIntegerField(default=0)  # type: ignore[arg-type]
    amount_holded_db = BigIntegerField(default=0)  # type: ignore[arg-type]
    external_amount_db = BigIntegerField(default=0, blank=True)  # type: ignore[arg-type]

    external_updated_at = DateTimeField(auto_now=True)

    status = CharField(
        max_length=1,
        choices=Status.choices,
        db_index=True,
        default=Status.ACTIVE,
    )
    address = CharField(max_length=64, null=True, blank=True)
    data = JSONField(default=dict, blank=True)
    credentials = JSONField(default=dict, blank=True)
    external_id = CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
    )

    premoderation_percent = IntField(default=0)  # type: ignore[arg-type]

    def __str__(self) -> str:
        label = self.name or str(self.id)[:8]
        currency_code = getattr(self.currency, "code", "?") if self.currency_id else "?"
        client_name = getattr(self.client, "name", "?") if self.client_id else "?"
        return f"{label} ({client_name} / {currency_code})"

    class Meta:
        table = "clients_account"
        unique_together = (("address", "currency"),)

    async def hold_amount_db(self, amount_db: int, operation=None):
        """Атомарно холдит средства на аккаунте.

        Для CARD_TOPUP холд берётся с parent аккаунта.
        """
        account_id = self.pk
        if operation and operation.kind == OperationKind.CARD_TOPUP and self.parent_id:
            account_id = self.parent_id

        await Account.filter(pk=account_id).select_for_update().update(
            amount_holded_db=F("amount_holded_db") + amount_db
        )

        if operation:
            await operation_log(
                operation.pk,
                LogTag.HOLD_AMOUNT,
                f"Hold {amount_db} on account {str(account_id)[:8]}",
            )

    async def unhold_amount_db(self, amount_db: int, operation=None):
        """Атомарно снимает холд с аккаунта.

        Для CARD_TOPUP холд лежит на parent аккаунте.
        """
        account_id = self.pk
        if operation and operation.kind == OperationKind.CARD_TOPUP and self.parent_id:
            account_id = self.parent_id

        await Account.filter(pk=account_id).select_for_update().update(
            amount_holded_db=F("amount_holded_db") - amount_db
        )

        if operation:
            await operation_log(
                operation.pk,
                LogTag.UNHOLD_AMOUNT,
                f"Unhold {amount_db} from account {str(account_id)[:8]}",
            )


class Setting(BaseModel):
    key = CharField(max_length=64, db_index=True)
    value = TextField()
    description = TextField(default="", blank=True)
    is_private = BooleanField(default=True)

    enabled = BooleanField(default=False)

    class Meta:
        table = "common_setting"

    def __str__(self) -> str:
        return str(self.key)

    @staticmethod
    async def _get(key, default=None):
        try:
            return (await Setting.get(key=key, enabled=True)).value
        except DoesNotExist:
            return default

    @classmethod
    async def list_int(cls, key: str, default: list | None = None) -> list[int]:
        if default is None:
            default = []
        val: str | None
        try:
            record = await cls.get(key=key, enabled=True)
        except DoesNotExist:
            val = None
        else:
            val = record.value  # type: ignore
        if val is None or val == "":
            return default
        return list(map(int, val.split(",")))


class Currency(Model):
    class Kind(TextChoices):
        FIAT = "F", "Fiat"
        CRYPT = "C", "Crypto"

    kind = CharField(
        max_length=1,
        choices=Kind.choices,
    )
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    code = CharField(max_length=10, db_index=True)
    base = CharField(max_length=6, db_index=True)
    name = CharField(max_length=64)
    symbol = CharField(max_length=10, null=True, blank=True)
    suffix = CharField(max_length=10, default="", blank=True)
    is_active = BooleanField(default=True)  # type: ignore[arg-type]
    denominator = IntegerField(default=2)  # type: ignore[arg-type]
    human_denominator = IntegerField(default=2)  # type: ignore[arg-type]

    def __str__(self):
        return str(self.code)

    class Meta:
        table = "currencies_currency"


class CurrencyRate(Model):
    currency_from = ForeignKey(Currency, related_name="rates_from", on_delete=PROTECT)
    currency_to = ForeignKey(Currency, related_name="rates_to", on_delete=PROTECT)
    rate = DecimalField(max_digits=18, decimal_places=10, default=Decimal("0.0"))
    human_rate = DecimalField(max_digits=18, decimal_places=10, default=Decimal("0.0"))
    is_manual = BooleanField(default=False)  # type: ignore[arg-type]
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.currency_from}/{self.currency_to}: {self.rate}"

    class Meta:
        unique_together = ("currency_from", "currency_to")
        table = "currencies_currencyrate"


def amount_db_to_human(amount: int, currency) -> Decimal:
    assert isinstance(amount, int), "Amount must be integer but %s" % type(amount)
    return Decimal(amount) / 10**currency.denominator


def fmt_amount(amount: Decimal) -> str:
    """Format Decimal stripping trailing zeros: 20.000000 -> '20', 10.50 -> '10.5'."""
    s = f"{amount:f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def amount_human_to_db(amount, currency):
    assert isinstance(amount, Decimal), "Amount must be Decimal but %s" % type(amount)
    return int(
        Decimal(amount * 10**currency.denominator).to_integral_value(
            rounding=ROUND_HALF_UP
        )
    )


class Gate(BaseModel):
    class Kind(TextChoices):
        INTERNAL = "I", "Internal"
        DEPOSIT = "D", "Deposit"
        WITHDRAW = "W", "Withdraw"
        EXCHANGE = "E", "Exchange"
        CARD_PROVIDER = "C", "CardProvider"
        TRANSFER = "T", "Transfer"

    class Status(TextChoices):
        DRAFT = "D", "Draft"
        ACTIVE = "A", "Active"
        PURGED = "P", "Purged"

    id = IntField(pk=True)
    code = CharField(max_length=32)
    name = CharField(max_length=64)
    kind = CharField(max_length=1, choices=Kind.choices, db_index=True)
    status = CharField(max_length=1, choices=Status.choices, db_index=True)
    data = JSONField(default=dict, blank=True)
    credentials = JSONField(default=dict, blank=True)

    class Meta:
        table = "operations_gate"

    def __str__(self):
        return f"{self.name} ({self.code})"


class Operation(Model):
    class Method(TextChoices):
        CRYPTO = "CPT", "Crypto"
        MANUAL = "MNL", "Manual"
        EXCHANGE = "EXC", "Exchange"
        VIRTUAL_CARD = "VC", "VirtualCard"

    class Status(TextChoices):
        PENDING = "P", "PENDING"
        OPERATING = "O", "OPERATING"
        COMPLETE = "C", "COMPLETE"
        FAILED = "F", "FAILED"
        UNKNOWN = "U", "UNKNOWN"

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = DateTimeField(auto_now_add=True, db_index=True)
    updated_at = DateTimeField(auto_now=True)
    done_at = DateTimeField(auto_now=True, db_index=True)
    note = TextField(
        default="",
        blank=True,
        help_text="Вы можете добавить заметку, она не будет видна клиентам",
    )
    client = ForeignKey("models.Client", related_name="operations", on_delete=PROTECT)
    account = ForeignKey("models.Account", on_delete=PROTECT, related_name="operations")
    kind = CharField(max_length=2, choices=OperationKind.choices, db_index=True)
    status = CharField(
        max_length=1,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    is_final = BooleanField(default=False, blank=True)  # type: ignore[arg-type]
    parent = ForeignKey(
        "models.Operation",
        on_delete=PROTECT,
        null=True,
        blank=True,
        related_name="suboperations",
    )
    method = CharField(max_length=3, choices=Method.choices, default="", db_index=True)

    pending_at = DateTimeField(null=True, blank=True, default=timezone.now)
    operating_at = DateTimeField(null=True, blank=True)
    external_id = CharField(max_length=64, db_index=True, null=True, blank=True)
    account_data = CharField(
        max_length=64,
        db_index=True,
        null=True,
        blank=True,
        help_text="PAN, Phone, SWIFT, etc.",
    )

    currency = ForeignKey(Currency, on_delete=PROTECT, null=True, blank=True)
    amount_db = BigIntegerField(null=True, blank=True)
    fee_db = BigIntegerField(null=True, blank=True)
    amount_done_db = BigIntegerField(null=True, blank=True)
    amount_rest_db = BigIntegerField(null=True, blank=True)

    data = JSONField()

    tarif_id = PositiveIntegerField(null=True)
    gate = ForeignKey("models.Gate", null=True, blank=True, on_delete=SET_NULL)

    def __str__(self):
        return f"<Operation [{self.account} {self.kind} @ {self.created_at}]>"

    class Meta:
        table = "operations_operation"

    @property
    def fee(self):
        """Фактическая комиссия"""
        if self.fee_db:
            return amount_db_to_human(int(self.fee_db), self.currency)  # type: ignore[arg-type]
        return Decimal(0.0)

    @property
    def amount(self):
        if self.amount_db:
            return amount_db_to_human(self.amount_db, self.currency)  # type: ignore[arg-type]
        return Decimal(0.0)


class OperationLog(Model):
    MESSAGE_LENGTH = 256

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = DateTimeField(default=timezone.now, db_index=True)
    operation = ForeignKey(Operation, on_delete=CASCADE, related_name="logs")
    tag = CharField(max_length=24, choices=LogTag.choices)
    message = CharField(max_length=MESSAGE_LENGTH, null=True, blank=True)

    class Meta:
        table = "operations_operationlog"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.tag}] {self.message or ''}"


_oplog_logger = _logging.getLogger("operation_log")


async def operation_log(uid, tag: str | LogTag, message: str | None = None):
    """Создаёт запись лога операции."""
    if isinstance(tag, str):
        tag = tag.upper()
    if message is not None:
        message = str(message)[: OperationLog.MESSAGE_LENGTH]
    _oplog_logger.info("%s [%s] (%s)", message, uid, tag)
    await OperationLog.create(operation_id=uid, tag=tag, message=message)


class TransactionKind(TextChoices):
    DEPOSIT = "D", "Deposit"
    WITHDRAW = "W", "Withdraw"
    MOVE = "M", "Move"
    FEE = "F", "Fee"
    ADJUSTMENT = "A", "Adjustment"
    TAX = "T", "Tax"
    OVERDRAFT_FEE = "O", "OverdraftFee"


class Transaction(BaseModel):
    class Status(TextChoices):
        DRAFT = "D", "Draft"
        APPROVED = "A", "Approved"
        REJECTED = "R", "Rejected"

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = ForeignKey(
        "models.Transaction",
        on_delete=SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )
    status = CharField(
        max_length=1,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    kind = CharField(max_length=1, choices=TransactionKind.choices, db_index=True)
    account_from = ForeignKey(
        Account, on_delete=PROTECT, related_name="transactions_from"
    )
    account_to = ForeignKey(Account, on_delete=PROTECT, related_name="transactions_to")
    currency_from = ForeignKey(
        "models.Currency", on_delete=PROTECT, related_name="transactions_currency_from"
    )
    currency_to = ForeignKey(
        "models.Currency", on_delete=PROTECT, related_name="transactions_currency_to"
    )
    operation = ForeignKey(Operation, on_delete=PROTECT, related_name="transaction_set")
    amount_db = BigIntegerField(default=0)  # type: ignore[arg-type]
    data = JSONField(default=dict, blank=True)

    class Meta:
        table = "finance_transaction"

    def __str__(self):
        return f"<Transaction [{self.kind} {self.amount_db} {self.status}]>"


class AccountMove(BaseModel):
    class Status(TextChoices):
        DRAFT = "D", "Draft"
        APPROVED = "A", "Approved"

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = ForeignKey(Account, on_delete=PROTECT, related_name="moves")
    currency = ForeignKey("models.Currency", on_delete=PROTECT)
    amount_db = BigIntegerField(default=0)  # type: ignore[arg-type]
    transaction = ForeignKey(
        Transaction, on_delete=PROTECT, related_name="account_moves"
    )
    status = CharField(
        max_length=1,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    direction = IntField(default=0)  # 0 = from, 1 = to

    class Meta:
        table = "finance_accountmove"

    def __str__(self):
        return f"<AccountMove [{self.account_id} {self.amount_db}]>"


class Tarif(BaseModel):

    class Status(TextChoices):
        DRAFT = "D", "Draft"
        ACTIVE = "A", "Active"
        PURGE = "P", "Purge"

    # parent = ForeignKey("models.Tarif", null=True, blank=True, on_delete=SET_NULL)
    status = CharField(
        max_length=1,
        choices=Status.choices,
        db_index=True,
        default=Status.ACTIVE,
    )
    is_default = BooleanField(default=False, blank=True)  # type: ignore[arg-type]
    name = CharField(max_length=64)
    description = TextField(null=True, blank=True)

    class Meta:
        abstract = True

    @db_transaction()
    async def save(self, *args, **kwargs):
        if self.is_default:
            # uncheck others
            await self._meta._model.exclude(pk=self.pk).update(is_default=False)
        return await super().save(*args, **kwargs)

    def __str__(self):
        return str(self.name)


class DepositTarif(Tarif):
    class Meta:
        table = "tarifs_deposittarif"


class WithdrawTarif(Tarif):
    class Meta:
        table = "tarifs_withdrawtarif"


class CardOpenTarif(Tarif):
    class Meta:
        table = "tarifs_cardopentarif"


class CardTopUpTarif(Tarif):
    class Meta:
        table = "tarifs_cardtopuptarif"


class ExchangeTarif(Tarif):
    class Meta:
        table = "tarifs_exchangetarif"


class TarifLine(Model):
    is_active = BooleanField(default=True)  # type: ignore[arg-type]
    fee_percent = DecimalField(
        max_digits=6, decimal_places=3, default=1.0, description="Fee, %"
    )
    fee_fixed = DecimalField(
        max_digits=9, decimal_places=6, default=0.0, description="Fee, fixed"
    )
    fee_minimal = DecimalField(
        max_digits=6, decimal_places=3, default=0.0, description="Fee, minimal"
    )
    min_amount = DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True, description="Min amount"
    )
    max_amount = DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True, description="Max amount"
    )

    class Meta:
        ordering = ("pk",)
        abstract = True

    def __str__(self):
        return self.str_impl(self)

    @classmethod
    def str_impl(cls, obj):
        return (
            "#{s[tarif_id]}/{s[id]}: {s[fee_percent]}%/{s[fee_fixed]}fix/{s[fee_minimal]}min"
        ).format(s=(obj if isinstance(obj, dict) else obj.__dict__))

    @property
    async def summary(self):
        return (
            "Client: {s.fee_percent}%, {s.fee_fixed} fix, {s.fee_minimal} min"
        ).format(s=self)

    def calc_fee(self, amount: Decimal):
        assert isinstance(amount, Decimal), "Amount must be Decimal but %s (%r)" % (
            type(amount),
            amount,
        )
        fee = (Decimal(amount) / 100) * Decimal(value=self.fee_percent)  # type: ignore[arg-type]
        if fee < self.fee_minimal:
            fee = self.fee_minimal
        return fee + self.fee_fixed  # type: ignore[arg-type]


class DepositTarifLine(TarifLine):
    tarif = ForeignKey(DepositTarif, on_delete=CASCADE, related_name="lines")
    currency = ForeignKey(Currency, on_delete=PROTECT, null=True, blank=True)
    method = CharField(
        max_length=3,
        choices=Operation.Method.choices,
        db_index=True,
        default="",
        blank=True,
    )

    class Meta:
        table = "tarifs_deposittarifline"


class WithdrawTarifLine(TarifLine):
    tarif = ForeignKey(WithdrawTarif, on_delete=CASCADE, related_name="lines")
    currency = ForeignKey(Currency, on_delete=PROTECT, null=True, blank=True)
    method = CharField(
        max_length=3,
        choices=Operation.Method.choices,
        db_index=True,
        default="",
        blank=True,
    )

    class Meta:
        table = "tarifs_withdrawtarifline"


class CardOpenTarifLine(TarifLine):
    tarif = ForeignKey(CardOpenTarif, on_delete=CASCADE, related_name="lines")
    currency = ForeignKey(Currency, on_delete=PROTECT, null=True, blank=True)
    method = CharField(
        max_length=3,
        choices=Operation.Method.choices,
        db_index=True,
        default="",
        blank=True,
    )

    class Meta:
        table = "tarifs_cardopentarifline"


class CardTopUpTarifLine(TarifLine):
    tarif = ForeignKey(CardTopUpTarif, on_delete=CASCADE, related_name="lines")
    currency = ForeignKey(Currency, on_delete=PROTECT, null=True, blank=True)
    method = CharField(
        max_length=3,
        choices=Operation.Method.choices,
        db_index=True,
        default="",
        blank=True,
    )

    class Meta:
        table = "tarifs_cardtopuptarifline"


class ExchangeTarifLine(TarifLine):
    tarif = ForeignKey(ExchangeTarif, on_delete=CASCADE, related_name="lines")
    currency_from = ForeignKey(
        Currency,
        on_delete=PROTECT,
        null=True,
        blank=True,
        related_name="tarifs_from",
    )
    currency_to = ForeignKey(
        Currency,
        on_delete=PROTECT,
        null=True,
        blank=True,
        related_name="tarifs_to",
    )
    additional_rate_percent = DecimalField(
        max_digits=6, decimal_places=3, default=1.0, description="Additional rate, %"
    )
    additional_human_rate_percent = DecimalField(
        max_digits=6,
        decimal_places=3,
        default=1.0,
        description="Additional human rate, %",
    )

    class Meta:
        table = "tarifs_exchangetarifline"

    async def cached_currency_rate(self):
        if not hasattr(self, "_currency_rate"):
            await self.fetch_related("market")
            self._currency_rate = await CurrencyRate.get(
                currency_from=self.currency_from,
                currency_to=self.currency_to,
            )
        return self._currency_rate

    def with_additional_rate(self, rate: Decimal):
        rate = Decimal(rate)
        sign = 1 if rate > 1 else -1
        return rate + ((rate / 100) * abs(self.additional_rate_percent) * sign)

    def with_additional_human_rate(self, rate: Decimal):
        add_rate = self.with_additional_rate(rate)
        return 1 / add_rate if rate < 1 else add_rate

    @property
    async def rate(self):
        return (await self.cached_currency_rate()).rate

    @property
    async def human_rate(self):
        return (await self.cached_currency_rate()).human_rate

    @property
    async def rate_with_additional_rate(self):
        return self.with_additional_rate((await self.cached_currency_rate()).rate)

    @property
    async def human_rate_with_additional_human_rate(self):
        return self.with_additional_human_rate((await self.cached_currency_rate()).rate)
