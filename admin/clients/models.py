import uuid
from django.db import models
from django.contrib.auth.models import User

from .managers import AccountQuerySet
from common.serializers import JSONEncoder


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Client(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "D", "Draft"
        SYSTEM = "S", "System"
        ACTIVE = "A", "Active"
        PURGED = "P", "Purged"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.PROTECT)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)

    description = models.TextField(default="", blank=True)
    phone = models.CharField(max_length=32, null=True, blank=True, unique=True)
    phone_confirmed = models.BooleanField(default=False)  # type: ignore[arg-type]
    telegram_id = models.BigIntegerField(null=True, blank=True, unique=True)
    telegram_username = models.CharField(
        max_length=32, null=True, blank=True, unique=True
    )
    telegram_photo_url = models.URLField(null=True, blank=True)
    telegram_auth_date = models.DateTimeField(null=True, blank=True)
    # language_code: 'zh-hans',
    telegram_language_code = models.CharField(max_length=10, null=True, blank=True)

    def __str__(self) -> str:
        return str(self.name)


class Account(BaseModel):
    class Kind(models.TextChoices):
        DEFAULT = "D", "Default"
        VIRTUAL_CARD = "V", "VirtualCard"

    class Status(models.TextChoices):
        DRAFT = "D", "Draft"
        ACTIVE = "A", "Active"
        PURGE = "P", "Purge"
        BANNED = "B", "Banned"
        RESTORED = "R", "Restored"
        BLOCKED = "L", "Blocked"
        CLOSED = "C", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    client = models.ForeignKey(
        "clients.Client", related_name="accounts", on_delete=models.PROTECT
    )
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True)
    kind = models.CharField(
        max_length=1, choices=Kind.choices, db_index=True, default=Kind.DEFAULT
    )
    currency = models.ForeignKey(
        "currencies.Currency", on_delete=models.PROTECT, null=True
    )
    amount_db = models.BigIntegerField(default=0)  # type: ignore[arg-type]
    amount_holded_db = models.PositiveBigIntegerField(default=0)  # type: ignore[arg-type]
    external_amount_db = models.BigIntegerField(default=0, blank=True)  # type: ignore[arg-type]

    external_updated_at = models.DateTimeField(auto_now=True)

    status = models.CharField(
        max_length=1,
        choices=Status.choices,
        db_index=True,
        default=Status.ACTIVE,
    )
    address = models.CharField(max_length=64, null=True, blank=True)
    data = models.JSONField(default=dict, blank=True, encoder=JSONEncoder)
    credentials = models.JSONField(default=dict, blank=True, encoder=JSONEncoder)
    external_id = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text="from contractor",
    )

    premoderation_percent = models.PositiveIntegerField(default=0)  # type: ignore[arg-type]

    objects = AccountQuerySet.as_manager()  # type: ignore[arg-type]

    class Meta:
        unique_together = (("address", "currency"),)
