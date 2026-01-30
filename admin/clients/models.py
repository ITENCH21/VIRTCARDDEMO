import uuid
from django.db.models import (
    Model,
    DateTimeField,
    UUIDField,
    ForeignKey,
    JSONField,
    BigIntegerField,
    PositiveIntegerField,
    BooleanField,
    CharField,
    TextField,
    TextChoices,
    PROTECT,
    URLField,
    OneToOneField,
    EmailField,
    PositiveBigIntegerField,
)
from django.contrib.auth.models import User

from .managers import AccountQuerySet
from common.serializers import JSONEncoder


class BaseModel(Model):
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Client(BaseModel):
    class Status(TextChoices):
        DRAFT = "D", "Draft"
        SYSTEM = "S", "System"
        ACTIVE = "A", "Active"
        PURGED = "P", "Purged"

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = OneToOneField(User, on_delete=PROTECT)
    name = CharField(max_length=255)
    email = EmailField(unique=True)
    status = CharField(
        max_length=1,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    description = TextField(default="", blank=True)
    phone = CharField(max_length=32, null=True, blank=True, unique=True)
    phone_confirmed = BooleanField(default=False)  # type: ignore[arg-type]
    telegram_id = BigIntegerField(null=True, blank=True, unique=True)
    telegram_username = CharField(max_length=32, null=True, blank=True, unique=True)
    telegram_photo_url = URLField(null=True, blank=True)
    telegram_auth_date = DateTimeField(null=True, blank=True)
    # language_code: 'zh-hans',
    telegram_language_code = CharField(max_length=10, null=True, blank=True)

    def __str__(self) -> str:
        return str(self.name)


class Account(BaseModel):
    class Kind(TextChoices):
        DEFAULT = "D", "Default"
        VIRTUAL_CARD = "V", "VirtualCard"

    class Status(TextChoices):
        DRAFT = "D", "Draft"
        ACTIVE = "A", "Active"
        PURGE = "P", "Purge"
        BANNED = "B", "Banned"
        RESTORED = "R", "Restored"
        BLOCKED = "L", "Blocked"
        CLOSED = "C", "Closed"

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = CharField(max_length=128, null=True, blank=True, db_index=True)
    client = ForeignKey("clients.Client", related_name="accounts", on_delete=PROTECT)
    parent = ForeignKey("self", on_delete=PROTECT, null=True, blank=True)
    kind = CharField(
        max_length=1, choices=Kind.choices, db_index=True, default=Kind.DEFAULT
    )
    currency = ForeignKey("currencies.Currency", on_delete=PROTECT, null=True)
    amount_db = BigIntegerField(default=0)  # type: ignore[arg-type]
    amount_holded_db = PositiveBigIntegerField(default=0)  # type: ignore[arg-type]
    external_amount_db = BigIntegerField(default=0, blank=True)  # type: ignore[arg-type]

    external_updated_at = DateTimeField(auto_now=True)

    status = CharField(
        max_length=1,
        choices=Status.choices,
        db_index=True,
        default=Status.ACTIVE,
    )
    address = CharField(max_length=64, null=True, blank=True)
    data = JSONField(default=dict, blank=True, encoder=JSONEncoder)
    credentials = JSONField(default=dict, blank=True, encoder=JSONEncoder)
    external_id = CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text="from contractor",
    )

    premoderation_percent = PositiveIntegerField(default=0)  # type: ignore[arg-type]

    objects = AccountQuerySet.as_manager()  # type: ignore[arg-type]

    class Meta:
        unique_together = (("address", "currency"),)
