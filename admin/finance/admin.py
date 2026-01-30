from django.contrib import admin

from .models import Transaction, AccountMove


class AccountMoveInline(admin.TabularInline):
    model = AccountMove
    extra = 0
    max_num = 0
    can_delete = False
    show_change_link = True
    fields = [
        "id",
        "account",
        "currency",
        "amount_db",
        "status",
        "direction",
        "created_at",
    ]
    readonly_fields = fields

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("account", "currency")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "kind",
        "status",
        "account_from",
        "account_to",
        "currency_from",
        "currency_to",
        "amount_db",
        "operation",
        "created_at",
    )
    search_fields = (
        "id",
        "account_from__name",
        "account_to__name",
        "operation__id",
    )
    list_filter = ("kind", "status", "created_at")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
    raw_id_fields = (
        "parent",
        "account_from",
        "account_to",
        "currency_from",
        "currency_to",
        "operation",
    )
    inlines = [AccountMoveInline]

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "kind",
                    "status",
                    "parent",
                    "operation",
                ),
            },
        ),
        (
            "Счета",
            {
                "fields": (
                    "account_from",
                    "account_to",
                ),
            },
        ),
        (
            "Суммы и валюты",
            {
                "fields": (
                    "currency_from",
                    "currency_to",
                    "amount_db",
                    "data",
                ),
            },
        ),
        (
            "Временные метки",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(AccountMove)
class AccountMoveAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "account",
        "currency",
        "amount_db",
        "status",
        "direction",
        "transaction",
        "created_at",
    )
    search_fields = (
        "id",
        "account__name",
        "transaction__id",
    )
    list_filter = ("status", "direction", "created_at")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
    raw_id_fields = ("account", "currency", "transaction")

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "account",
                    "currency",
                    "amount_db",
                    "status",
                    "direction",
                    "transaction",
                ),
            },
        ),
        (
            "Временные метки",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )
