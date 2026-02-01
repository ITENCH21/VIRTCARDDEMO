from django.contrib import admin

from .models import Gate, Operation


@admin.register(Gate)
class GateAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "kind", "status", "created_at", "updated_at")
    search_fields = ("code", "name")
    list_filter = ("kind", "status")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)

    fieldsets = (
        (
            None,
            {
                "fields": ("code", "name", "kind", "status"),
            },
        ),
        (
            "Данные",
            {
                "fields": ("data", "credentials"),
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


@admin.register(Operation)
class OperationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client",
        "account",
        "kind",
        "status",
        "method",
        "currency",
        "amount_db",
        "fee_db",
        "is_final",
        "created_at",
        "done_at",
    )
    search_fields = (
        "id",
        "external_id",
        "account_data",
        "client__name",
        "account__name",
    )
    list_filter = (
        "kind",
        "status",
        "method",
        "currency",
        "gate",
        "is_final",
        "created_at",
    )
    readonly_fields = ("created_at", "updated_at", "done_at")
    ordering = ("-created_at",)
    raw_id_fields = ("client", "account", "parent", "currency", "content_type", "gate")

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "client",
                    "account",
                    "kind",
                    "status",
                    "method",
                    "is_final",
                ),
            },
        ),
        (
            "Суммы",
            {
                "fields": (
                    "currency",
                    "amount_db",
                    "fee_db",
                    "amount_done_db",
                    "amount_rest_db",
                ),
            },
        ),
        (
            "Внешние данные",
            {
                "fields": (
                    "external_id",
                    "account_data",
                    "data",
                    "parent",
                    "gate",
                    "content_type",
                    "tarif_id",
                ),
            },
        ),
        (
            "Заметки",
            {
                "fields": ("note",),
                "classes": ("collapse",),
            },
        ),
        (
            "Временные метки",
            {
                "fields": (
                    "pending_at",
                    "operating_at",
                    "created_at",
                    "updated_at",
                    "done_at",
                ),
                "classes": ("collapse",),
            },
        ),
    )
