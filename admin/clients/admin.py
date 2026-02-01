from django.contrib import admin
from django.utils.html import format_html

from .models import Account, Client, ClientGroup


class AccountInline(admin.TabularInline):
    model = Account
    extra = 0
    can_delete = False
    show_change_link = True
    fields = [
        "currency",
        "kind",
        "status",
        "created_at",
        "amount_db",
        "amount_holded_db",
        "external_amount_db",
        "name",
        "external_id",
        "address",
    ]
    readonly_fields = fields

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("currency")
            .order_by("kind", "created_at")
        )


class OperationInline(admin.TabularInline):
    model = None  # будет установлена ниже после импорта
    extra = 0
    max_num = 0
    can_delete = False
    show_change_link = True
    fk_name = "client"
    fields = [
        "id",
        "kind",
        "status",
        "method",
        "account",
        "currency",
        "amount_db",
        "fee_db",
        "external_id",
        "created_at",
        "done_at",
    ]
    readonly_fields = fields

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("account", "currency", "client")
            .order_by("-created_at")
        )


# Отложенный импорт для избежания циклических зависимостей
from operations.models import Operation  # noqa

OperationInline.model = Operation


@admin.register(ClientGroup)
class ClientGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "referral_code", "created_at", "updated_at")
    search_fields = ("name", "referral_code")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "user",
        "email",
        "phone",
        "status",
        "group",
        "telegram_username",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "name",
        "email",
        "phone",
        "user__username",
        "telegram_id",
        "telegram_username",
    )
    list_filter = ("status", "group", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
    inlines = (AccountInline, OperationInline)

    fieldsets = (
        (None, {"fields": ("user", "name", "email", "status", "group")}),
        (
            "Контакты",
            {
                "fields": (
                    "phone",
                    "phone_confirmed",
                    "description",
                ),
            },
        ),
        (
            "Telegram",
            {
                "fields": (
                    "telegram_id",
                    "telegram_username",
                    "telegram_photo_url",
                    "telegram_auth_date",
                    "telegram_language_code",
                ),
                "classes": ("collapse",),
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

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user")


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client",
        "kind",
        "status",
        "currency",
        "amount_db",
        "amount_holded_db",
        "external_amount_db",
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
    readonly_fields = ("created_at", "updated_at", "external_updated_at")
    ordering = ("-created_at",)
    raw_id_fields = ("client", "parent", "currency")

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "name",
                    "client",
                    "parent",
                    "kind",
                    "status",
                    "currency",
                ),
            },
        ),
        (
            "Баланс",
            {
                "fields": (
                    "amount_db",
                    "amount_holded_db",
                    "external_amount_db",
                    "premoderation_percent",
                ),
            },
        ),
        (
            "Внешние данные",
            {
                "fields": (
                    "external_id",
                    "address",
                    "data",
                    "credentials",
                ),
            },
        ),
        (
            "Временные метки",
            {
                "fields": ("created_at", "updated_at", "external_updated_at"),
                "classes": ("collapse",),
            },
        ),
    )
