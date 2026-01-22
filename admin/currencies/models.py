from django.db.models import (
    Model,
    CharField,
    DateTimeField,
    BooleanField,
    IntegerField,
    ForeignKey,
    DecimalField,
    TextChoices,
    PROTECT,
)
from decimal import Decimal


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


class CurrencyRate(Model):
    currency_from = ForeignKey(Currency, related_name="rates_from", on_delete=PROTECT)
    currency_to = ForeignKey(Currency, related_name="rates_to", on_delete=PROTECT)
    rate = DecimalField(max_digits=18, decimal_places=10, default=Decimal("0.0"))
    human_rate = DecimalField(max_digits=18, decimal_places=10, default=Decimal("0.0"))
    is_manual = BooleanField(default=False)  # type: ignore[arg-type]
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("currency_from", "currency_to")

    def __str__(self):
        return f"{self.currency_from}/{self.currency_to}: {self.rate}"
