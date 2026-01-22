import typing
from typing import ClassVar
import orjson
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import (
    Model,
    Manager,
    CharField,
    DateTimeField,
    BooleanField,
    TextField,
    TextChoices,
)

T = typing.TypeVar("T")


class BaseModel(Model):
    objects: ClassVar[Manager] = Manager()
    created_at = DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        abstract = True


class Setting(BaseModel):
    key = CharField(max_length=64, db_index=True)
    value = TextField(null=True, blank=True)
    description = TextField(default="", blank=True)
    is_private = BooleanField(default=True)  # type: ignore[arg-type]
    enabled = BooleanField(default=True)  # type: ignore[arg-type]

    def save(self, *args, **kwargs):
        self.key = self.key.upper()  # type: ignore[attr-defined]
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.key

    @staticmethod
    def get(key):
        return Setting.objects.get(key=key).value

    @classmethod
    def get_or_default(cls, key, default=None):
        try:
            return cls.get(key)
        except ObjectDoesNotExist:
            return default

    @classmethod
    def loads(cls, key, default=None):
        try:
            return orjson.loads(cls.get(key=key))  # pylint: disable=no-member
        except ObjectDoesNotExist:
            return default

    @classmethod
    def int(cls, key: str, default: int | None = None) -> int:
        try:
            val = cls.get(key=key)
        except ObjectDoesNotExist:
            val = None
        if val is None:
            if default is None:
                raise KeyError(key)
            return default
        return int(val)

    @classmethod
    def bool(
        cls,
        key: str,
        default: bool | None = None,
        truthy_values: tuple[str, ...] = (
            "t",
            "1",
            "enable",
            "enabled",
            "true",
            "yes",
            "y",
        ),
    ) -> bool:
        try:
            val = cls.get(key=key)
        except ObjectDoesNotExist:
            val = None
        if val is None:
            if default is None:
                raise KeyError(key)
            return default
        return val.lower().strip() in truthy_values


class OperationKind(TextChoices):
    # Управление карточным счётом. Выделяем, так как процессинг и тарифы
    #  отличаются от регулярного счёта
    CARD_OPEN = "CO", "CARD OPEN"
    CARD_UPDATE = "CU", "CARD UPDATE"
    CARD_TOPUP = "CT", "CARD TOPUP"
    CARD_BLOCK = "CB", "CARD BLOCK"
    CARD_RESTORE = "CR", "CARD RESTORE"
    CARD_CLOSE = "CC", "CARD CLOSE"
    CARD_BANNED = "CD", "CARD BANNED"

    # Операции по счёту. Движения средств. Типа DML
    DEPOSIT = "DE", "DEPOSIT"
    WITHDRAW = "WI", "WITHDRAW"
    SERVICE = "SE", "SERVICE"
    SYSTEM = "SY", "SYSTEM"
    ADJUSTMENT = "AJ", "ADJUSTMENT"
