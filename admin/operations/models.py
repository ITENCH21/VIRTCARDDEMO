from decimal import Decimal, ROUND_HALF_UP
from json import JSONEncoder
import uuid
from django.db.models import (
    Model,
    TextChoices,
    DateTimeField,
    UUIDField,
    ForeignKey,
    JSONField,
    BigIntegerField,
    PositiveIntegerField,
    BooleanField,
    CharField,
    IntegerField,
    SET_NULL,
    PROTECT,
    CASCADE,
    TextField,
)
from django.utils import timezone
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from common.models import OperationKind


class LogTag(TextChoices):
    CREATE = "CREATE", "Create"
    HOLD_AMOUNT = "HOLD_AMOUNT", "Hold amount"
    UNHOLD_AMOUNT = "UNHOLD_AMOUNT", "UnHold amount"
    TO_GATE = "TO_GATE", "To Gate"
    FROM_GATE = "FROM_GATE", "From Gate"
    TO_FISCAL = "TO_FISCAL", "To Fiscal"
    FETCH_STATUS = "FETCH_STATUS", "Fetch status"
    DONE = "DONE", "Done"
    ERROR = "ERROR", "Error"
    UNKNOWN = "UNKNOWN", "Unknown"
    ADDRESS_CHANGED = "ADDRESS_CHANGED", "Address changed"
    PROMOTED = "PROMOTED", "Promoted"


class BaseModel(Model):
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)

    class Meta:
        abstract = True


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

    code = CharField(max_length=32)
    name = CharField(max_length=64)
    kind = CharField(max_length=1, choices=Kind.choices, db_index=True)
    status = CharField(max_length=1, choices=Status.choices, db_index=True)
    data = JSONField(default=dict, blank=True, encoder=JSONEncoder)
    credentials = JSONField(null=True, blank=True, encoder=JSONEncoder)

    class Meta:
        db_table = "operations_gate"

    def __str__(self):
        return f"{self.name} ({self.code})"


def amount_db_to_human(amount: int, currency) -> Decimal:
    assert isinstance(amount, int), "Amount must be integer but %s" % type(amount)
    return Decimal(amount) / 10**currency.denominator


def amount_human_to_db(amount, currency):
    assert isinstance(amount, Decimal), "Amount must be Decimal but %s" % type(amount)
    return int(
        Decimal(amount * 10**currency.denominator).to_integral_value(
            rounding=ROUND_HALF_UP
        )
    )


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
    client = ForeignKey("clients.Client", related_name="operations", on_delete=PROTECT)
    account = ForeignKey(
        "clients.Account", on_delete=PROTECT, related_name="operations"
    )
    kind = CharField(max_length=2, choices=OperationKind.choices, db_index=True)
    status = CharField(
        max_length=1,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    is_final = BooleanField(default=False, blank=True)  # type: ignore[arg-type]
    parent = ForeignKey(
        "self",
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

    currency = ForeignKey(
        "currencies.Currency", on_delete=PROTECT, null=True, blank=True
    )
    amount_db = BigIntegerField(null=True, blank=True)
    fee_db = BigIntegerField(null=True, blank=True)
    amount_done_db = BigIntegerField(null=True, blank=True)
    amount_rest_db = BigIntegerField(null=True, blank=True)
    content_type = ForeignKey(ContentType, on_delete=SET_NULL, null=True)

    data = JSONField(encoder=JSONEncoder)

    tarif_id = PositiveIntegerField(null=True)
    tarif = GenericForeignKey("content_type", "tarif_id")
    gate = ForeignKey(Gate, null=True, blank=True, on_delete=SET_NULL)

    def __str__(self):
        return f"<Operation [{self.account} {self.kind} @ {self.created_at}]>"

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
    created_at = DateTimeField(db_index=True, default=timezone.now)
    operation = ForeignKey(Operation, on_delete=CASCADE, related_name="logs")
    tag = CharField(max_length=24, choices=LogTag.choices)
    message = CharField(max_length=MESSAGE_LENGTH, null=True, blank=True)

    class Meta:
        db_table = "operations_operationlog"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.tag}] {self.message or ''}"
