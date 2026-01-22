from django.contrib import admin

from .models import Account, Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "email", "phone", "created_at", "updated_at")
    search_fields = ("name", "email", "phone", "user__username")
    list_filter = ("created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "client",
        "kind",
        "status",
        "currency",
        "amount_db",
        "external_id",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "name",
        "client__name",
        "client__email",
        "external_id",
        "address",
    )
    list_filter = ("kind", "status", "currency", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
    raw_id_fields = ("client", "parent", "currency")
