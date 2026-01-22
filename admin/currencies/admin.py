from django.contrib import admin
from .models import Currency, CurrencyRate


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "symbol", "kind", "is_active")
    search_fields = ("code", "name", "symbol")
    list_filter = ("kind", "is_active")
    ordering = ("code",)


@admin.register(CurrencyRate)
class CurrencyRateAdmin(admin.ModelAdmin):
    list_display = (
        "currency_from",
        "currency_to",
        "rate",
        "human_rate",
        "is_manual",
        "updated_at",
    )
    search_fields = ("currency_from__code", "currency_to__code")
    list_filter = ("is_manual",)
    ordering = ("currency_from", "currency_to")
