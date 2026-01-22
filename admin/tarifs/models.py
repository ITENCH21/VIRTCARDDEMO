from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import (
    TextChoices,
    ForeignKey,
    CASCADE,
    PROTECT,
    SET_NULL,
    CharField,
    BooleanField,
    Model,
    DecimalField,
    TextField,
    Manager,
)
from django.db import transaction as db_transaction

from common.models import BaseModel
from operations.models import Operation


class Tarif(BaseModel):
    if TYPE_CHECKING:
        lines: "Manager"
        client_set: "Manager"
        clientgroup_set: "Manager"
        _meta: "Manager"

    class Status(TextChoices):
        DRAFT = "D", "Draft"
        ACTIVE = "A", "Active"
        PURGE = "P", "Purge"

    parent = ForeignKey("self", null=True, blank=True, on_delete=SET_NULL)
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

    @db_transaction.atomic
    def save(self, *args, **kwargs):
        if self.is_default:
            # uncheck others
            self._meta.model.objects.exclude(pk=self.pk).update(is_default=False)
        return super().save(*args, **kwargs)

    def __str__(self):
        return str(self.name)

    def active_lines_count(self):
        return self.lines.filter(is_active=True).count()  # noqa: E501

    def clients_count(self):
        return self.client_set.all().count()  # pylint: disable=no-member

    def groups_count(self):
        return self.clientgroup_set.all().count()  # pylint: disable=no-member

    def clients_list(self):
        return list(
            self.client_set.filter().values_list("user__username", flat=True)
        )  # pylint: disable=no-member


class DepositTarif(Tarif):
    pass


class WithdrawTarif(Tarif):
    pass


class CardOpenTarif(Tarif):
    pass


class CardTopUpTarif(Tarif):
    pass


class ExchangeTarif(Tarif):
    pass


class TarifLine(Model):
    is_active = BooleanField(default=True)  # type: ignore[arg-type]
    fee_percent = DecimalField("Fee, %", max_digits=6, decimal_places=3, default=1.0)
    fee_fixed = DecimalField("Fee, fixed", max_digits=9, decimal_places=6, default=0.0)
    fee_minimal = DecimalField(
        "Fee, minimal", max_digits=6, decimal_places=3, default=0.0
    )
    min_amount = DecimalField(
        "Min amount", max_digits=9, decimal_places=6, null=True, blank=True
    )
    max_amount = DecimalField(
        "Max amount", max_digits=12, decimal_places=6, null=True, blank=True
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
    def summary(self):
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
    currency = ForeignKey(
        "currencies.Currency", on_delete=PROTECT, null=True, blank=True
    )
    # method = models.ForeignKey(
    #     "operations.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True
    # )
    method = CharField(
        max_length=3,
        choices=Operation.Method.choices,
        db_index=True,
        default="",
        blank=True,
    )


class WithdrawTarifLine(TarifLine):
    tarif = ForeignKey(WithdrawTarif, on_delete=CASCADE, related_name="lines")
    currency = ForeignKey(
        "currencies.Currency", on_delete=PROTECT, null=True, blank=True
    )
    # method = models.ForeignKey(
    #     "operations.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True
    # )
    method = CharField(
        max_length=3,
        choices=Operation.Method.choices,
        db_index=True,
        default="",
        blank=True,
    )


class CardOpenTarifLine(TarifLine):
    tarif = ForeignKey(CardOpenTarif, on_delete=CASCADE, related_name="lines")
    currency = ForeignKey(
        "currencies.Currency", on_delete=PROTECT, null=True, blank=True
    )
    # method = models.ForeignKey(
    #     "operations.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True
    # )
    method = CharField(
        max_length=3,
        choices=Operation.Method.choices,
        db_index=True,
        default="",
        blank=True,
    )


class CardTopUpTarifLine(TarifLine):
    tarif = ForeignKey(CardTopUpTarif, on_delete=CASCADE, related_name="lines")
    currency = ForeignKey(
        "currencies.Currency", on_delete=PROTECT, null=True, blank=True
    )
    # method = models.ForeignKey(
    #     "operations.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True
    # )
    method = CharField(
        max_length=3,
        choices=Operation.Method.choices,
        db_index=True,
        default="",
        blank=True,
    )


class ExchangeTarifLine(TarifLine):
    tarif = ForeignKey(ExchangeTarif, on_delete=CASCADE, related_name="lines")
    currency_from = ForeignKey(
        "currencies.Currency",
        on_delete=PROTECT,
        null=True,
        blank=True,
        related_name="tarifs_from",
    )
    currency_to = ForeignKey(
        "currencies.Currency",
        on_delete=PROTECT,
        null=True,
        blank=True,
        related_name="tarifs_to",
    )
    additional_rate_percent = DecimalField(
        "Additional rate, %", max_digits=6, decimal_places=3, default=1.0
    )
    additional_human_rate_percent = DecimalField(
        "Additional human rate, %", max_digits=6, decimal_places=3, default=1.0
    )
