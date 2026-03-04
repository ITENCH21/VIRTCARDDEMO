import importlib
import json
import os
import uuid
import logging

import redis as _redis
import requests as _requests

from django.contrib import admin, messages
from django.db.models import F
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from clients.models import Account
from .models import Gate, Operation, OperationLog, LogTag, amount_db_to_human

logger = logging.getLogger(__name__)

ID_SLICE_INDEX = -8

# ── Цвета статусов ────────────────────────────────────────

STATUS_COLORS = {
    "P": "#ffc107",  # yellow — PENDING
    "O": "#17a2b8",  # blue — OPERATING
    "C": "#28a745",  # green — COMPLETE
    "F": "#dc3545",  # red — FAILED
    "U": "#6c757d",  # grey — UNKNOWN
}

KIND_COLORS = {
    "DE": "#28a745",
    "WI": "#dc3545",
    "CO": "#17a2b8",
    "CT": "#6610f2",
    "CB": "#fd7e14",
    "CR": "#20c997",
    "CC": "#6c757d",
}


# ── Helpers ─────────────────────────────────────────────────


def _load_nats_utils():
    """Загружает nats_utils из /workspace/common/."""
    spec = importlib.util.spec_from_file_location(
        "workspace_nats_utils",
        "/workspace/common/nats_utils.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _publish_fetch_status(operation: Operation) -> bool:
    """Публикует fire-and-forget запрос fetch_operation_status в yeezypay_crypto."""
    nats_utils = _load_nats_utils()
    NatsProducer = nats_utils.NatsProducer

    producer = NatsProducer(
        subjects=["yeezypay_crypto"],
        stream_name="gates_stream",
    )
    try:
        message = {
            "action": "fetch_operation_status",
            "params": {
                "operation_id": str(operation.pk),
                "kind": operation.kind,
                "external_id": operation.external_id or "",
            },
            "request_id": str(uuid.uuid4()),
        }
        producer.publish("yeezypay_crypto", message)
        logger.info("Published fetch_operation_status for operation %s", operation.pk)
        return True
    except Exception:
        logger.exception(
            "Failed to publish fetch_operation_status for operation %s", operation.pk
        )
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


def _copy_id(obj_id):
    """ID с кнопкой копирования и укороченным отображением."""
    id_str = str(obj_id)
    id_part = id_str[ID_SLICE_INDEX:]
    return mark_safe(
        f'<div style="white-space:nowrap">'
        f'<a href="{id_str}">{id_part}</a>'
        f"&nbsp;<a onclick=\"navigator.clipboard.writeText('{id_str}');\""
        f' style="cursor:pointer" title="Copy full ID">&#128203;</a>'
        f"</div>"
    )


def _publish_client_notification(client_id: str, event: str, data: dict) -> bool:
    """Publish notification to Redis pub/sub for WebSocket delivery."""
    try:
        r = _redis.Redis(
            host=os.environ.get("REDIS_HOST", "redis"),
            port=int(os.environ.get("REDIS_PORT", "6379")),
            password=os.environ.get("REDIS_PASSWORD", ""),
        )
        payload = json.dumps({"client_id": client_id, "event": event, **data})
        r.publish("client_notifications", payload)
        r.close()
        return True
    except Exception:
        logger.exception("Failed to publish WS notification for client %s", client_id)
        return False


def _notify_withdraw(operation: Operation, success: bool) -> bool:
    """Отправляет Telegram-уведомление клиенту о результате вывода."""
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return False

    client = operation.client
    if not client or not client.telegram_id:
        return False

    currency_symbol = ""
    if operation.currency:
        currency_symbol = operation.currency.symbol or operation.currency.code

    amount_str = (
        str(amount_db_to_human(operation.amount_db, operation.currency))
        if operation.amount_db and operation.currency
        else "—"
    )
    address = (operation.data or {}).get("address", operation.account_data or "—")

    if success:
        text = (
            f"<b>Вывод выполнен</b>\n\n"
            f"Сумма: <b>{amount_str} {currency_symbol}</b>\n"
            f"Адрес: <code>{address}</code>"
        )
    else:
        text = (
            f"<b>Вывод отклонён</b>\n\n"
            f"Сумма: {amount_str} {currency_symbol}\n"
            f"Средства возвращены на баланс."
        )

    try:
        resp = _requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": client.telegram_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
        return resp.status_code == 200
    except Exception:
        logger.exception(
            "Failed to send withdraw notification to %s", client.telegram_id
        )
        return False


# ── Gate Admin ──────────────────────────────────────────────


def _sync_vc_callback_url(gate_obj) -> tuple[bool, str]:
    """Отправляет callback_url в YeezyPay VC API (PATCH /vc-api/v1/service/callback_url).

    Возвращает (success, message).
    """
    credentials = gate_obj.credentials or {}
    data = gate_obj.data or {}

    callback_url = data.get("vc_callback_url", "").strip()
    if not callback_url:
        return False, "vc_callback_url не задан в data"

    api_url = credentials.get("yeezypay_api_url", "").rstrip("/")
    external_id = credentials.get("yeezypay_external_id", "")
    secret = credentials.get("yeezypay_secret", "")
    token_timeout = int(credentials.get("yeezypay_token_timeout") or 3600)

    if not all([api_url, external_id, secret]):
        return False, "Не заполнены credentials (api_url / external_id / secret)"

    try:
        # 1. Authenticate
        auth_resp = _requests.post(
            f"{api_url}/vc-api/v1/auth",
            json={
                "external_id": external_id,
                "secret": secret,
                "timeout": token_timeout,
            },
            timeout=15,
        )
        auth_resp.raise_for_status()
        auth_data = auth_resp.json()
        if not auth_data.get("success"):
            return False, f"Auth failed: {auth_data}"
        token = auth_data["token"]

        # 2. Set callback_url
        resp = _requests.patch(
            f"{api_url}/vc-api/v1/service/callback_url",
            json={"callback_url": callback_url},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        result = resp.json()
        return (
            True,
            f"callback_url установлен: {result.get('callback_url', callback_url)}",
        )

    except _requests.RequestException as e:
        return False, f"HTTP ошибка: {e}"
    except Exception as e:
        return False, f"Ошибка: {e}"


@admin.register(Gate)
class GateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "code",
        "name",
        "kind_",
        "status_",
        "callback_url_status",
        "created_at",
        "updated_at",
    )
    search_fields = ("code", "name")
    list_filter = ("kind", "status")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)

    @admin.display(description="Kind", ordering="kind")
    def kind_(self, obj):
        return format_html(
            '<span style="font-weight:600">{}</span>', obj.get_kind_display()
        )

    @admin.display(description="Status", ordering="status")
    def status_(self, obj):
        color = "#28a745" if obj.status == Gate.Status.ACTIVE else "#6c757d"
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description="Callback URL")
    def callback_url_status(self, obj):
        if obj.code != "yeezypay":
            return "—"
        data = obj.data or {}
        url = data.get("vc_callback_url", "")
        if url:
            return format_html(
                '<span style="color:#28a745" title="{}">&#10003; задан</span>', url
            )
        return format_html('<span style="color:#dc3545">&#10007; не задан</span>')

    fieldsets = (
        (None, {"fields": ("code", "name", "kind", "status")}),
        ("Данные", {"fields": ("data", "credentials")}),
        (
            "Временные метки",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def save_model(self, request, obj, form, change):
        """При сохранении YeezyPay gate — синхронизирует callback_url с VC API."""
        super().save_model(request, obj, form, change)

        # Синхронизируем callback_url только для yeezypay gate
        if obj.code == "yeezypay":
            data = obj.data or {}
            callback_url = data.get("vc_callback_url", "").strip()
            if callback_url:
                ok, msg = _sync_vc_callback_url(obj)
                if ok:
                    messages.success(request, f"VC API: {msg}")
                else:
                    messages.warning(
                        request, f"VC API callback_url не установлен: {msg}"
                    )


# ── Operation Admin ─────────────────────────────────────────


class TransactionInline(admin.TabularInline):
    model = None  # Set below after import

    extra = 0
    max_num = 0
    can_delete = False
    show_change_link = True
    fields = [
        "created_at",
        "kind",
        "amount_human",
        "currency_from",
        "account_from",
        "account_to",
        "status",
        "tarif_info",
    ]
    readonly_fields = fields

    @admin.display(description="Amount")
    def amount_human(self, obj):
        if obj.amount_db and obj.currency_from:
            return str(amount_db_to_human(obj.amount_db, obj.currency_from))
        return "—"

    @admin.display(description="Tarif Line")
    def tarif_info(self, obj):
        op = obj.operation
        if not op:
            return "—"

        # 1) Пробуем из operation.data["fiscal"] (всегда заполняется fiscal-микросервисом)
        fiscal = (op.data or {}).get("fiscal") if isinstance(op.data, dict) else None
        if fiscal and isinstance(fiscal, dict):
            parts = []
            fee_pct = fiscal.get("fee_percent")
            fee_fix = fiscal.get("fee_fixed")
            fee_amt = fiscal.get("fee_amount")
            if fee_pct is not None:
                parts.append(f"{fee_pct}%")
            if fee_fix:
                parts.append(f"+ {fee_fix} fix")
            if fee_amt is not None:
                parts.append(f"= {fee_amt}")
            return " ".join(parts) if parts else "—"

        # 2) Fallback: GenericForeignKey (Django-синхронный worker)
        if op.content_type_id and op.tarif_id:
            try:
                model_class = op.content_type.model_class()
                tarif_line = model_class.objects.get(pk=op.tarif_id)
                parts = [f"{tarif_line.fee_percent}%"]
                if tarif_line.fee_fixed:
                    parts.append(f"+ {tarif_line.fee_fixed}")
                if tarif_line.fee_minimal:
                    parts.append(f"(min {tarif_line.fee_minimal})")
                return " ".join(parts)
            except Exception:
                pass

        return "—"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "account_from",
                "account_to",
                "currency_from",
                "operation__content_type",
            )
        )


class OperationLogInline(admin.TabularInline):
    model = OperationLog
    extra = 0
    max_num = 0
    can_delete = False
    fields = ["created_at", "tag", "message"]
    readonly_fields = fields

    def get_queryset(self, request):
        return super().get_queryset(request).order_by("-created_at")


# Deferred import to avoid circular dependency
from finance.models import Transaction  # noqa: E402

TransactionInline.model = Transaction


@admin.register(Operation)
class OperationAdmin(admin.ModelAdmin):
    list_display = (
        "id_part",
        "kind_",
        "status_",
        "client_link",
        "account_link",
        "amount_",
        "fee_",
        "method",
        "gate_link",
        "external_id_part",
        "is_final",
        "created_at",
        "done_at",
    )
    search_fields = (
        "id",
        "external_id",
        "account_data",
        "client__name",
        "client__email",
        "account__name",
    )
    list_filter = (
        "status",
        "kind",
        "method",
        "currency",
        "gate",
        "is_final",
        "created_at",
    )
    ordering = ("-created_at",)
    list_select_related = ("client", "account", "currency", "gate")
    list_per_page = 50
    show_full_result_count = False
    actions = ["fetch_status", "complete_withdraw", "fail_withdraw"]
    inlines = [TransactionInline, OperationLogInline]

    # All fields are readonly — операция это свершившийся факт
    def get_readonly_fields(self, request, obj=None):
        if obj:
            return [f.name for f in obj._meta.fields] + [
                "pretty_data",
                "client_link_detail",
                "account_link_detail",
                "gate_link_detail",
                "amount_",
                "fee_",
            ]
        return []

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    # ── Display methods (list) ─────────────────────────────

    @admin.display(description="ID")
    def id_part(self, obj):
        return _copy_id(obj.pk)

    @admin.display(description="Kind", ordering="kind")
    def kind_(self, obj):
        color = KIND_COLORS.get(obj.kind, "#333")
        label = obj.get_kind_display()
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>', color, label
        )

    @admin.display(description="Status", ordering="status")
    def status_(self, obj):
        color = STATUS_COLORS.get(obj.status, "#333")
        label = obj.get_status_display()
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>', color, label
        )

    @admin.display(description="Client", ordering="client__name")
    def client_link(self, obj):
        return link_to_object(obj.client)

    @admin.display(description="Account", ordering="account__name")
    def account_link(self, obj):
        account = obj.account
        currency = obj.currency
        name = f"{str(account.pk)[:8]}_{currency}" if currency else str(account.pk)[:8]
        return link_to_object(account, name)

    @admin.display(description="Amount", ordering="amount_db")
    def amount_(self, obj):
        if obj.amount_db and obj.currency:
            return str(amount_db_to_human(obj.amount_db, obj.currency))
        return "—"

    @admin.display(description="Fee", ordering="fee_db")
    def fee_(self, obj):
        if obj.fee_db and obj.currency:
            val = amount_db_to_human(int(obj.fee_db), obj.currency)
            return str(val)
        return "—"

    @admin.display(description="Gate", ordering="gate__name")
    def gate_link(self, obj):
        return link_to_object(obj.gate, obj.gate.name if obj.gate else None)

    @admin.display(description="External ID")
    def external_id_part(self, obj):
        if not obj.external_id:
            return "—"
        id_part = str(obj.external_id)[ID_SLICE_INDEX:]
        return mark_safe(
            f'<div style="white-space:nowrap">'
            f"<span>{id_part}</span>"
            f"&nbsp;<a onclick=\"navigator.clipboard.writeText('{obj.external_id}');\""
            f' style="cursor:pointer" title="Copy full ID">&#128203;</a>'
            f"</div>"
        )

    # ── Display methods (detail) ───────────────────────────

    @admin.display(description="Client")
    def client_link_detail(self, obj):
        return link_to_object(obj.client)

    @admin.display(description="Account")
    def account_link_detail(self, obj):
        return link_to_object(obj.account)

    @admin.display(description="Gate")
    def gate_link_detail(self, obj):
        return link_to_object(obj.gate)

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

    # ── Actions ────────────────────────────────────────────

    @admin.action(description="Fetch Status (запросить статус у гейта)")
    def fetch_status(self, request, queryset):
        """Запрашивает актуальный статус операций через YeezyPay API.

        Только для операций в статусе PENDING или OPERATING.
        Работает для всех типов операций:
        - Крипто (DEPOSIT и др.) — запрашивает crypto_operation_detail
        - Карточные (CARD_OPEN и др.) — запрашивает данные карты / синхронизирует
        Результат сохраняется в data['last_status_check'].
        """
        allowed_statuses = {
            Operation.Status.PENDING,
            Operation.Status.OPERATING,
        }
        eligible = [op for op in queryset if op.status in allowed_statuses]
        skipped = queryset.count() - len(eligible)

        sent_count = 0
        fail_count = 0

        for operation in eligible:
            if _publish_fetch_status(operation):
                sent_count += 1
            else:
                fail_count += 1

        if sent_count:
            messages.success(
                request,
                f"Запросы отправлены: {sent_count}. "
                f"Результат будет в data операции (поле last_status_check).",
            )
        if skipped:
            messages.warning(
                request,
                f"Пропущено операций: {skipped} "
                f"(только PENDING/OPERATING доступны для запроса)",
            )
        if fail_count:
            messages.error(
                request,
                f"Не удалось отправить запросы: {fail_count} (NATS недоступен)",
            )

    @admin.action(description="Complete Withdraw (подтвердить вывод)")
    def complete_withdraw(self, request, queryset):
        """Оператор подтверждает вывод: снимает холд и списывает средства."""
        allowed_statuses = {Operation.Status.PENDING, Operation.Status.OPERATING}
        eligible = [
            op for op in queryset if op.kind == "WI" and op.status in allowed_statuses
        ]
        skipped = queryset.count() - len(eligible)

        completed = 0
        for op in eligible:
            holded_amount = (op.data or {}).get("holded_amount", 0)

            op.status = Operation.Status.COMPLETE
            op.is_final = True
            op.done_at = timezone.now()
            op.save(update_fields=["status", "is_final", "done_at", "updated_at"])

            # Снять холд и списать средства
            Account.objects.filter(pk=op.account_id).update(
                amount_holded_db=F("amount_holded_db") - holded_amount,
                amount_db=F("amount_db") - holded_amount,
            )

            OperationLog.objects.create(
                operation=op,
                tag=LogTag.DONE,
                message="Manual complete by admin",
            )
            _notify_withdraw(op, success=True)
            _publish_client_notification(
                str(op.client_id),
                "withdraw_complete",
                {"operation_id": str(op.pk), "status": "C"},
            )
            completed += 1

        if completed:
            messages.success(request, f"Завершено операций: {completed}")
        if skipped:
            messages.warning(
                request,
                f"Пропущено: {skipped} (только WITHDRAW в PENDING/OPERATING)",
            )

    @admin.action(description="Fail Withdraw (отклонить вывод)")
    def fail_withdraw(self, request, queryset):
        """Оператор отклоняет вывод: снимает холд, баланс не трогаем."""
        allowed_statuses = {Operation.Status.PENDING, Operation.Status.OPERATING}
        eligible = [
            op for op in queryset if op.kind == "WI" and op.status in allowed_statuses
        ]
        skipped = queryset.count() - len(eligible)

        failed = 0
        for op in eligible:
            holded_amount = (op.data or {}).get("holded_amount", 0)

            op.status = Operation.Status.FAILED
            op.is_final = True
            op.done_at = timezone.now()
            op.save(update_fields=["status", "is_final", "done_at", "updated_at"])

            # Вернуть холд (баланс не трогаем)
            Account.objects.filter(pk=op.account_id).update(
                amount_holded_db=F("amount_holded_db") - holded_amount,
            )

            OperationLog.objects.create(
                operation=op,
                tag=LogTag.ERROR,
                message="Manual reject by admin",
            )
            _notify_withdraw(op, success=False)
            _publish_client_notification(
                str(op.client_id),
                "withdraw_failed",
                {"operation_id": str(op.pk), "status": "F"},
            )
            failed += 1

        if failed:
            messages.success(request, f"Отклонено операций: {failed}")
        if skipped:
            messages.warning(
                request,
                f"Пропущено: {skipped} (только WITHDRAW в PENDING/OPERATING)",
            )

    # ── Queryset ───────────────────────────────────────────

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("client", "account", "currency", "gate")
        )

    # ── Fieldsets ──────────────────────────────────────────

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
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
                    "pretty_data",
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


@admin.register(OperationLog)
class OperationLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "operation_link", "tag", "message")
    search_fields = ("operation__id", "message")
    list_filter = ("tag", "created_at")
    readonly_fields = ("created_at", "operation", "tag", "message")
    ordering = ("-created_at",)
    list_per_page = 100
    raw_id_fields = ("operation",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="Operation")
    def operation_link(self, obj):
        return link_to_object(obj.operation, str(obj.operation_id)[-8:])

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("operation")
