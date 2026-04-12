import importlib
import json
import os
import secrets
import uuid
import logging
from decimal import Decimal

import redis as _redis
from django.contrib import admin, messages
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .models import Account, Client, ClientGroup

logger = logging.getLogger(__name__)


def _generate_login_as_link(client_id: str) -> str:
    """Generate a one-time magic link token for Login As feature.
    Stores token in Redis DB=1 (same as backend JWT store)."""
    token = secrets.token_urlsafe(32)
    r = _redis.Redis(
        host=os.environ.get("REDIS_HOST", "redis"),
        port=int(os.environ.get("REDIS_PORT", "6379")),
        password=os.environ.get("REDIS_PASSWORD", "") or None,
        db=1,
        decode_responses=True,
    )
    r.setex(f"magic_link:{token}", 900, str(client_id))  # 15 min TTL
    r.close()
    return token

CRYPTO_CURRENCY_CODE = "USDT-TRC20"

STATUS_COLORS = {
    "D": "#6c757d",  # Draft — grey
    "S": "#17a2b8",  # System — blue
    "A": "#28a745",  # Active — green
    "P": "#dc3545",  # Purge — red
    "B": "#fd7e14",  # Banned — orange
    "R": "#20c997",  # Restored — teal
    "L": "#dc3545",  # Blocked — red
    "C": "#6c757d",  # Closed — grey
}


# ── Helpers ─────────────────────────────────────────────────


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
    """Публикует fire-and-forget запрос в yeezypay_crypto."""
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


def link_to_object(obj, name=None):
    """Создаёт HTML-ссылку на объект в админке."""
    if not obj:
        return "—"
    _meta = obj._meta
    url = reverse(
        f"admin:{_meta.app_label}_{_meta.model_name}_change",
        args=[obj.pk],
    )
    if name is None:
        name = str(obj)
    return format_html('<a href="{}">{}</a>', url, name)


def _format_amount(amount_db, currency):
    """Форматирует amount_db в человекочитаемый вид."""
    if amount_db is None or currency is None:
        return "—"
    denominator = currency.denominator if currency else 2
    val = Decimal(amount_db) / 10**denominator
    symbol = currency.symbol or currency.code
    return f"{val} {symbol}"


# ── Inlines ─────────────────────────────────────────────────


class AccountInline(admin.TabularInline):
    model = Account
    extra = 0
    can_delete = False
    show_change_link = True
    fields = [
        "currency",
        "kind",
        "status_",
        "balance_",
        "holded_",
        "external_balance_",
        "name",
        "external_id",
        "address",
        "created_at",
    ]
    readonly_fields = fields

    @admin.display(description="Status")
    def status_(self, obj):
        color = STATUS_COLORS.get(obj.status, "#333")
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description="Balance")
    def balance_(self, obj):
        return _format_amount(obj.amount_db, obj.currency)

    @admin.display(description="Holded")
    def holded_(self, obj):
        if not obj.amount_holded_db:
            return "—"
        return _format_amount(obj.amount_holded_db, obj.currency)

    @admin.display(description="External")
    def external_balance_(self, obj):
        if not obj.external_amount_db:
            return "—"
        return _format_amount(obj.external_amount_db, obj.currency)

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("currency")
            .order_by("kind", "created_at")
        )


class OperationInline(admin.TabularInline):
    model = None  # Set below after import
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


# Deferred import to avoid circular dependency
from operations.models import Operation  # noqa: E402

OperationInline.model = Operation


# ── ClientGroup Admin ───────────────────────────────────────


@admin.register(ClientGroup)
class ClientGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "referral_code", "client_count", "created_at", "updated_at")
    search_fields = ("name", "referral_code")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)

    @admin.display(description="Clients")
    def client_count(self, obj):
        return obj.clients.count()


# ── Client Admin ────────────────────────────────────────────


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "user",
        "email_",
        "phone",
        "status_",
        "group_link",
        "telegram_",
        "accounts_count",
        "created_at",
        "login_as_btn",
    )
    search_fields = (
        "name",
        "email",
        "phone",
        "user__username",
        "telegram_id",
        "telegram_username",
    )
    list_filter = ("status", "group", "created_at")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
    list_select_related = ("user", "group")
    list_per_page = 50
    inlines = (AccountInline, OperationInline)

    # ── Display methods ────────────────────────────────────

    @admin.display(description="Email", ordering="email")
    def email_(self, obj):
        if not obj.email:
            return "—"
        return format_html('<a href="mailto:{}">{}</a>', obj.email, obj.email)

    @admin.display(description="Status", ordering="status")
    def status_(self, obj):
        color = STATUS_COLORS.get(obj.status, "#333")
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description="Group", ordering="group__name")
    def group_link(self, obj):
        return link_to_object(obj.group)

    @admin.display(description="Telegram")
    def telegram_(self, obj):
        if obj.telegram_username:
            return format_html(
                '<a href="https://t.me/{}" target="_blank">@{}</a>',
                obj.telegram_username,
                obj.telegram_username,
            )
        if obj.telegram_id:
            return str(obj.telegram_id)
        return "—"

    @admin.display(description="Accounts")
    def accounts_count(self, obj):
        count = obj.accounts.count()
        if not count:
            return "0"
        url = reverse("admin:clients_account_changelist")
        return format_html(
            '<a href="{}?client__id__exact={}">{}</a>', url, obj.pk, count
        )

    @admin.display(description="Login As")
    def login_as_btn(self, obj):
        try:
            token = _generate_login_as_link(str(obj.pk))
            url = f"/lk/auth?token={token}"
            return format_html(
                '<a href="{}" target="_blank" style="'
                'background:linear-gradient(135deg,#3B82F6,#1D4ED8);'
                'color:white;padding:4px 12px;border-radius:6px;'
                'font-size:11px;font-weight:700;text-decoration:none;'
                'white-space:nowrap;'
                '">Login</a>',
                url,
            )
        except Exception:
            logger.exception("Failed to generate login-as link for client %s", obj.pk)
            return "—"

    # ── Queryset ───────────────────────────────────────────

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("user", "group")
            .prefetch_related("accounts")
        )

    # ── Fieldsets ──────────────────────────────────────────

    fieldsets = (
        (
            None,
            {"fields": ("user", "name", "email", "status", "group")},
        ),
        (
            "Контакты",
            {
                "fields": ("phone", "phone_confirmed", "description"),
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


# ── Account Admin ───────────────────────────────────────────


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        "id_short",
        "client_link",
        "kind",
        "status_",
        "currency",
        "balance_",
        "holded_",
        "external_balance_",
        "address_short",
        "external_id_short",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "id",
        "name",
        "client__name",
        "client__email",
        "external_id",
        "address",
    )
    list_filter = ("kind", "status", "currency", "created_at")
    readonly_fields = (
        "created_at",
        "updated_at",
        "external_updated_at",
        "pretty_data",
    )
    ordering = ("-created_at",)
    raw_id_fields = ("client", "parent", "currency")
    list_select_related = ("client", "currency")
    list_per_page = 50
    actions = [
        "request_usdt_wallet",
        "update_wallet_balance",
        "close_wallet",
        "check_main_balance",
    ]

    # ── Display methods ────────────────────────────────────

    @admin.display(description="ID", ordering="id")
    def id_short(self, obj):
        id_str = str(obj.pk)
        short = id_str[-8:]
        return mark_safe(
            f'<span title="{id_str}" style="cursor:pointer"'
            f" onclick=\"navigator.clipboard.writeText('{id_str}')\">"
            f"{short}</span>"
        )

    @admin.display(description="Client", ordering="client__name")
    def client_link(self, obj):
        return link_to_object(obj.client)

    @admin.display(description="Status", ordering="status")
    def status_(self, obj):
        color = STATUS_COLORS.get(obj.status, "#333")
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description="Balance", ordering="amount_db")
    def balance_(self, obj):
        return _format_amount(obj.amount_db, obj.currency)

    @admin.display(description="Holded", ordering="amount_holded_db")
    def holded_(self, obj):
        if not obj.amount_holded_db:
            return "—"
        val = _format_amount(obj.amount_holded_db, obj.currency)
        return format_html('<span style="color:#fd7e14">{}</span>', val)

    @admin.display(description="External", ordering="external_amount_db")
    def external_balance_(self, obj):
        if not obj.external_amount_db:
            return "—"
        return _format_amount(obj.external_amount_db, obj.currency)

    @admin.display(description="Address")
    def address_short(self, obj):
        if not obj.address:
            return "—"
        addr = obj.address
        short = f"{addr[:6]}...{addr[-4:]}" if len(addr) > 12 else addr
        return mark_safe(
            f'<span title="{addr}" style="cursor:pointer"'
            f" onclick=\"navigator.clipboard.writeText('{addr}')\">"
            f"{short}</span>"
        )

    @admin.display(description="External ID")
    def external_id_short(self, obj):
        if not obj.external_id:
            return "—"
        eid = str(obj.external_id)
        short = eid[-8:] if len(eid) > 8 else eid
        return mark_safe(
            f'<span title="{eid}" style="cursor:pointer"'
            f" onclick=\"navigator.clipboard.writeText('{eid}')\">"
            f"{short}</span>"
        )

    @admin.display(description="Data")
    def pretty_data(self, obj):
        data = obj.data
        if not data:
            return "—"
        try:
            formatted = json.dumps(data, indent=2, ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            formatted = str(data)
        return mark_safe(
            f"<pre style='max-height:400px;overflow:auto'>{formatted}</pre>"
        )

    # ── Queryset ───────────────────────────────────────────

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("client", "currency")

    # ── Helpers ──────────────────────────────────────────────

    def _filter_crypto_accounts(self, request, queryset, need_address=False):
        """Фильтрует queryset: только USDT-TRC20 аккаунты."""
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
        """Отправляет NATS action для списка аккаунтов."""
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

    @admin.action(description="Запросить USDT-TRC20 кошелёк")
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

    @admin.action(description="Обновить баланс крипто-кошелька")
    def update_wallet_balance(self, request, queryset):
        """Запрашивает crypto_wallet_info. Gate обновит external_amount_db и адрес."""
        filtered, skip_count = self._filter_crypto_accounts(
            request, queryset, need_address=True
        )

        def _params(account):
            p = {}
            if account.external_id:
                p["wallet_id"] = account.external_id
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

    @admin.action(description="Закрыть крипто-кошелёк")
    def close_wallet(self, request, queryset):
        """Закрывает кошелёк через crypto_wallet_close."""
        filtered, skip_count = self._filter_crypto_accounts(
            request, queryset, need_address=True
        )

        def _params(account):
            p = {}
            if account.external_id:
                p["wallet_id"] = account.external_id
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

    @admin.action(description="Баланс главного крипто-кошелька")
    def check_main_balance(self, request, queryset):
        """Запрашивает crypto_balance_main — баланс мастер-кошелька YeezyPay."""
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

    # ── Fieldsets ──────────────────────────────────────────

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
                    "pretty_data",
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
