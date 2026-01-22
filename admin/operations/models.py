from decimal import Decimal, ROUND_HALF_UP
from json import JSONEncoder
import uuid
from django.db import models
from django.utils import timezone
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from common.models import OperationKind


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


class Operation(models.Model):
    class Method(models.TextChoices):
        CRYPTO = "CPT", "Crypto"
        MANUAL = "MNL", "Manual"
        EXCHANGE = "EXC", "Exchange"
        VIRTUAL_CARD = "VC", "VirtualCard"

    class Status(models.TextChoices):
        PENDING = "P", "PENDING"
        OPERATING = "O", "OPERATING"
        COMPLETE = "C", "COMPLETE"
        FAILED = "F", "FAILED"
        UNKNOWN = "U", "UNKNOWN"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    done_at = models.DateTimeField(auto_now=True, db_index=True)
    note = models.TextField(
        default="",
        blank=True,
        help_text="Вы можете добавить заметку, она не будет видна клиентам",
    )
    client = models.ForeignKey(
        "clients.Client", related_name="operations", on_delete=models.PROTECT
    )
    account = models.ForeignKey(
        "clients.Account", on_delete=models.PROTECT, related_name="operations"
    )
    kind = models.CharField(max_length=2, choices=OperationKind.choices, db_index=True)
    status = models.CharField(
        max_length=1,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    is_final = models.BooleanField(default=False, blank=True)  # type: ignore[arg-type]
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="suboperations",
    )
    method = models.CharField(
        max_length=3, choices=Method.choices, default="", db_index=True
    )

    pending_at = models.DateTimeField(null=True, blank=True, default=timezone.now)
    operating_at = models.DateTimeField(null=True, blank=True)
    external_id = models.CharField(max_length=64, db_index=True, null=True, blank=True)
    account_data = models.CharField(
        max_length=64,
        db_index=True,
        null=True,
        blank=True,
        help_text="PAN, Phone, SWIFT, etc.",
    )

    currency = models.ForeignKey(
        "currencies.Currency", on_delete=models.PROTECT, null=True, blank=True
    )
    amount_db = models.BigIntegerField(null=True, blank=True)
    fee_db = models.BigIntegerField(null=True, blank=True)
    amount_done_db = models.BigIntegerField(null=True, blank=True)
    amount_rest_db = models.BigIntegerField(null=True, blank=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True)

    data = models.JSONField(encoder=JSONEncoder)

    tarif_id = models.PositiveIntegerField(null=True)
    tarif = GenericForeignKey("content_type", "tarif_id")

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
