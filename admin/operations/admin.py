from django.contrib import admin

from .models import Operation


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
    list_filter = ("kind", "status", "method", "currency", "is_final", "created_at")
    readonly_fields = ("created_at", "updated_at", "done_at")
    ordering = ("-created_at",)
    raw_id_fields = ("client", "account", "parent", "currency", "content_type")
