from django.db import models
from decimal import Decimal


class Currency(models.Model):
    class Kind(models.TextChoices):
        FIAT = "F", "Fiat"
        CRYPT = "C", "Crypto"

    kind = models.CharField(
        max_length=1,
        choices=Kind.choices,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    code = models.CharField(max_length=10, db_index=True)
    base = models.CharField(max_length=6, db_index=True)
    name = models.CharField(max_length=64)
    symbol = models.CharField(max_length=10, null=True, blank=True)
    suffix = models.CharField(max_length=10, default="", blank=True)
    is_active = models.BooleanField(default=True)
    denominator = models.IntegerField(default=2)
    human_denominator = models.IntegerField(default=2)

    def __str__(self):
        return self.code


class CurrencyRate(models.Model):
    currency_from = models.ForeignKey(
        Currency, related_name="rates_from", on_delete=models.PROTECT
    )
    currency_to = models.ForeignKey(
        Currency, related_name="rates_to", on_delete=models.PROTECT
    )
    rate = models.DecimalField(max_digits=18, decimal_places=10, default=Decimal("0.0"))
    human_rate = models.DecimalField(
        max_digits=18, decimal_places=10, default=Decimal("0.0")
    )
    is_manual = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("currency_from", "currency_to")

    def __str__(self):
        return f"{self.currency_from}/{self.currency_to}: {self.rate}"
