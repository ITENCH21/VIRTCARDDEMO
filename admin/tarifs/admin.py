from django.contrib import admin, messages
from django.db.models.query import QuerySet
from django.db.models import Q, Count
from django.http.request import HttpRequest
from django.utils.safestring import mark_safe
from django.utils import timezone

from .models import (
    Tarif,
    DepositTarif,
    WithdrawTarif,
    CardOpenTarif,
    CardTopUpTarif,
    ExchangeTarif,
    DepositTarifLine,
    WithdrawTarifLine,
    CardOpenTarifLine,
    CardTopUpTarifLine,
    ExchangeTarifLine,
)


TARIFLINE_FIELDS = [
    "is_active",
    "currency",
    "method",
    "fee_percent",
    "fee_fixed",
    "fee_minimal",
    "min_amount",
    "max_amount",
]


class TarifAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "parent",
        "status",
        "is_default",
        "description",
        "active_lines_count",
        "clients_count",
        "groups_count",
        "created_at",
        "updated_at",
    ]
    fields = (
        "parent",
        "status",
        "is_default",
        "name",
        "description",
        "clients_list",
    )
    readonly_fields = ["created_at", "clients_list"]
    actions = ["make_default", "clone_tarif"]

    def get_queryset(self, request: HttpRequest) -> QuerySet:
        return (
            super()
            .get_queryset(request)
            .prefetch_related("client_set", "clientgroup_set")
            .annotate(
                active_lines_count=Count("lines", filter=Q(lines__is_active=True)),
            )
        )

    def make_default(self, request, queryset):
        tarif = queryset.first()
        self.model.objects.exclude(pk=tarif.pk).update(is_default=False)
        self.model.objects.filter(pk=tarif.pk).update(is_default=True)
        self.log_change(request, tarif, "Make_default action")
        messages.success(request, "Updated success")
        return None

    def clone_tarif(self, request, queryset):
        for tarif in queryset:
            lines = list(tarif.lines.all())
            tarif.pk = None
            tarif.name = f"Clone {tarif.name}"
            tarif.status = Tarif.Status.DRAFT
            tarif.created_at = timezone.now()
            tarif.is_default = False
            tarif.save()
            self.log_addition(request, tarif, "Add by clone_tarif action")
            for tl in lines:
                tl.pk = None
                tl.tarif = tarif
                tl.save()
        return True


class DepositTarifLineInline(admin.TabularInline):
    extra = 0
    model = DepositTarifLine
    readonly_fields = []
    fields = TARIFLINE_FIELDS


@admin.register(DepositTarif)
class DepositTarifAdmin(TarifAdmin):
    inlines = [DepositTarifLineInline]


class WithdrawTarifLineInline(DepositTarifLineInline):
    fields = TARIFLINE_FIELDS
    model = WithdrawTarifLine


@admin.register(WithdrawTarif)
class WithdrawTarifAdmin(TarifAdmin):
    inlines = [WithdrawTarifLineInline]


class CardOpenTarifLineInline(WithdrawTarifLineInline):
    fields = TARIFLINE_FIELDS
    model = CardOpenTarifLine


class CardTopUpTarifLineInline(WithdrawTarifLineInline):
    fields = TARIFLINE_FIELDS
    model = CardTopUpTarifLine


@admin.register(CardOpenTarif)
class CardOpenTarifAdmin(TarifAdmin):
    inlines = [CardOpenTarifLineInline]


@admin.register(CardTopUpTarif)
class CardTopUpTarifAdmin(TarifAdmin):
    inlines = [CardTopUpTarifLineInline]


class ExchangeTarifLineInline(admin.TabularInline):
    extra = 0
    model = ExchangeTarifLine
    readonly_fields = [
        "rate",
        "rate_with_additional_rate",
        "human_rate",
        "human_rate_with_additional_human_rate",
    ]
    fields = [
        "is_active",
        "currency_from",
        "currency_to",
        "fee_percent",
        "fee_fixed",
        "additional_rate_percent",
        "additional_human_rate_percent",
        *readonly_fields,
    ]

    def human_rate(self, obj):
        if obj.rate != obj.human_rate:
            return mark_safe(f'<span style="color:orange">{obj.human_rate}</span>')
        return obj.human_rate

    human_rate.admin_order_field = "human_rate"


@admin.register(ExchangeTarif)
class ExchangeTarifAdmin(TarifAdmin):
    inlines = [ExchangeTarifLineInline]
