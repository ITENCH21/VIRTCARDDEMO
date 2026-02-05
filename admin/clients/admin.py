import importlib
import uuid
import logging

from django.contrib import admin, messages
from django.utils.html import format_html

from .models import Account, Client, ClientGroup

logger = logging.getLogger(__name__)

CRYPTO_CURRENCY_CODE = "USDT-TRC20"


def _load_nats_utils():
    """Загружает nats_utils из /workspace/common/, минуя
    локальный Django-app 'common' который перекрывает имя пакета."""
    spec = importlib.util.spec_from_file_location(
        "workspace_nats_utils",
        "/workspace/common/nats_utils.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _publish_crypto_action(
    action: str, account_id: str, params: dict | None = None
) -> bool:
    """Публикует fire-and-forget запрос в yeezypay_crypto.

    Gate (yeezypay_crypto_process) выполнит action и сохранит результат в Account.

    Returns:
        True если сообщение опубликовано, False при ошибке.
    """
    nats_utils = _load_nats_utils()
    NatsProducer = nats_utils.NatsProducer

    producer = NatsProducer(
        subjects=["yeezypay_crypto"],
        stream_name="gates_stream",
    )
    try:
        message = {
            "action": action,
            "params": params or {},
            "account_id": str(account_id),
            "request_id": str(uuid.uuid4()),
        }
        producer.publish("yeezypay_crypto", message)
        logger.info("Published %s for account %s", action, account_id)
        return True
    except Exception:
        logger.exception("Failed to publish %s for account %s", action, account_id)
        return False
    finally:
        try:
            producer.close()
            producer.stop()
        except Exception:
            pass


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
    actions = [
        "request_usdt_wallet",
        "update_wallet_balance",
        "close_wallet",
        "check_main_balance",
    ]

    # ── Helpers ──────────────────────────────────────────────

    def _filter_crypto_accounts(self, request, queryset, need_address=False):
        """Фильтрует queryset: только USDT-TRC20 аккаунты.

        need_address=True — пропускает аккаунты без address/external_id.
        Returns: (filtered_accounts, skip_count)
        """
        accounts = queryset.select_related("currency")
        filtered = []
        skip_count = 0

        for account in accounts:
            if not account.currency or account.currency.code != CRYPTO_CURRENCY_CODE:
                skip_count += 1
                continue
            if need_address and not (account.address or account.external_id):
                messages.info(
                    request,
                    f"Аккаунт {account.pk}: нет привязанного кошелька, пропущен",
                )
                skip_count += 1
                continue
            filtered.append(account)

        return filtered, skip_count

    def _bulk_publish(self, request, accounts, action, params_fn=None):
        """Отправляет NATS action для списка аккаунтов.

        params_fn(account) → dict — опциональная функция для формирования params.
        """
        sent_count = 0
        fail_count = 0

        for account in accounts:
            params = params_fn(account) if params_fn else {}
            if _publish_crypto_action(action, str(account.pk), params):
                sent_count += 1
            else:
                fail_count += 1

        return sent_count, fail_count

    # ── Actions ──────────────────────────────────────────────

    @admin.action(description="🔑 Запросить USDT-TRC20 кошелёк")
    def request_usdt_wallet(self, request, queryset):
        """Создание USDT-TRC20 wallet. Gate сохранит адрес в Account."""
        accounts = queryset.select_related("currency")
        sent_count = 0
        skip_count = 0
        fail_count = 0

        for account in accounts:
            if not account.currency or account.currency.code != CRYPTO_CURRENCY_CODE:
                skip_count += 1
                continue
            if account.address:
                messages.info(
                    request,
                    f"Аккаунт {account.pk} уже имеет адрес: {account.address}",
                )
                skip_count += 1
                continue
            if _publish_crypto_action(
                "crypto_wallet_create",
                str(account.pk),
                {"currency_code": CRYPTO_CURRENCY_CODE},
            ):
                sent_count += 1
            else:
                fail_count += 1

        if sent_count:
            messages.success(
                request,
                f"Запросы на создание кошельков отправлены: {sent_count}. "
                f"Адреса будут назначены автоматически.",
            )
        if skip_count:
            messages.warning(
                request,
                f"Пропущено аккаунтов: {skip_count} "
                f"(не USDT-TRC20 или уже есть адрес)",
            )
        if fail_count:
            messages.error(
                request,
                f"Не удалось отправить запросы: {fail_count} (NATS недоступен)",
            )

    @admin.action(description="💰 Обновить баланс крипто-кошелька")
    def update_wallet_balance(self, request, queryset):
        """Запрашивает crypto_wallet_info. Gate обновит external_amount_db."""
        filtered, skip_count = self._filter_crypto_accounts(
            request, queryset, need_address=True
        )

        def _params(account):
            p = {}
            if account.external_id:
                p["wallet_id"] = account.external_id
            if account.address:
                p["address"] = account.address
            return p

        sent_count, fail_count = self._bulk_publish(
            request, filtered, "crypto_wallet_info", params_fn=_params
        )

        if sent_count:
            messages.success(
                request,
                f"Запросы на обновление баланса отправлены: {sent_count}. "
                f"Баланс обновится автоматически.",
            )
        if skip_count:
            messages.warning(request, f"Пропущено аккаунтов: {skip_count}")
        if fail_count:
            messages.error(
                request,
                f"Не удалось отправить запросы: {fail_count} (NATS недоступен)",
            )

    @admin.action(description="🔒 Закрыть крипто-кошелёк")
    def close_wallet(self, request, queryset):
        """Закрывает кошелёк через crypto_wallet_close. Gate обновит статус Account."""
        filtered, skip_count = self._filter_crypto_accounts(
            request, queryset, need_address=True
        )

        def _params(account):
            p = {}
            if account.external_id:
                p["wallet_id"] = account.external_id
            if account.address:
                p["address"] = account.address
            return p

        sent_count, fail_count = self._bulk_publish(
            request, filtered, "crypto_wallet_close", params_fn=_params
        )

        if sent_count:
            messages.success(
                request,
                f"Запросы на закрытие кошельков отправлены: {sent_count}. "
                f"Статус обновится автоматически.",
            )
        if skip_count:
            messages.warning(request, f"Пропущено аккаунтов: {skip_count}")
        if fail_count:
            messages.error(
                request,
                f"Не удалось отправить запросы: {fail_count} (NATS недоступен)",
            )

    @admin.action(description="📊 Баланс главного крипто-кошелька")
    def check_main_balance(self, request, queryset):
        """Запрашивает crypto_balance_main — баланс мастер-кошелька YeezyPay.

        Результат будет в логах gate. Привязка к конкретному Account не нужна,
        используем первый выбранный аккаунт как «триггер».
        """
        first = queryset.first()
        if not first:
            messages.warning(request, "Выберите хотя бы один аккаунт")
            return

        if _publish_crypto_action("crypto_balance_main", str(first.pk)):
            messages.success(
                request,
                "Запрос баланса главного кошелька отправлен. "
                "Результат будет в логах gate.",
            )
        else:
            messages.error(request, "Не удалось отправить запрос (NATS недоступен)")

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
