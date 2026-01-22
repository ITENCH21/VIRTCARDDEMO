from django.contrib import admin
from .models import Setting


@admin.register(Setting)
class SettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "is_private", "enabled", "created_at", "updated_at")
    list_filter = ("is_private", "enabled", "created_at", "updated_at")
    search_fields = ("key", "value", "description")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)

    fieldsets = (
        ("Основная информация", {"fields": ("key", "value", "description")}),
        ("Статус", {"fields": ("is_private", "enabled")}),
        (
            "Временные метки",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )
