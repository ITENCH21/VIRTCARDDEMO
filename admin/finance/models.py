import uuid
from django.db.models import (
    TextChoices,
    DateTimeField,
    UUIDField,
    ForeignKey,
    JSONField,
    BigIntegerField,
    IntegerField,
    CharField,
    SET_NULL,
    PROTECT,
)

from common.models import BaseModel
from common.serializers import JSONEncoder


class TransactionKind(TextChoices):
    DEPOSIT = "D", "Deposit"
    WITHDRAW = "W", "Withdraw"
    MOVE = "M", "Move"
    FEE = "F", "Fee"
    ADJUSTMENT = "A", "Adjustment"
    TAX = "T", "Tax"
    OVERDRAFT_FEE = "O", "OverdraftFee"


class Transaction(BaseModel):
    class Status(TextChoices):
        DRAFT = "D", "Draft"
        APPROVED = "A", "Approved"
        REJECTED = "R", "Rejected"

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = ForeignKey(
        "self",
        on_delete=SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )
    status = CharField(
        max_length=1,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    kind = CharField(max_length=1, choices=TransactionKind.choices, db_index=True)
    account_from = ForeignKey(
        "clients.Account", on_delete=PROTECT, related_name="transactions_from"
    )
    account_to = ForeignKey(
        "clients.Account", on_delete=PROTECT, related_name="transactions_to"
    )
    currency_from = ForeignKey(
        "currencies.Currency",
        on_delete=PROTECT,
        related_name="transactions_currency_from",
    )
    currency_to = ForeignKey(
        "currencies.Currency",
        on_delete=PROTECT,
        related_name="transactions_currency_to",
    )
    operation = ForeignKey(
        "operations.Operation", on_delete=PROTECT, related_name="transaction_set"
    )
    amount_db = BigIntegerField(default=0)  # type: ignore[arg-type]
    data = JSONField(default=dict, blank=True, encoder=JSONEncoder)

    class Meta:
        db_table = "finance_transaction"
        managed = False

    def __str__(self):
        return f"<Transaction [{self.kind} {self.amount_db} {self.status}]>"


class AccountMove(BaseModel):
    class Status(TextChoices):
        DRAFT = "D", "Draft"
        APPROVED = "A", "Approved"

    id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = ForeignKey("clients.Account", on_delete=PROTECT, related_name="moves")
    currency = ForeignKey("currencies.Currency", on_delete=PROTECT)
    amount_db = BigIntegerField(default=0)  # type: ignore[arg-type]
    transaction = ForeignKey(
        Transaction, on_delete=PROTECT, related_name="account_moves"
    )
    status = CharField(
        max_length=1,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    direction = IntegerField(default=0)  # 0 = from, 1 = to

    class Meta:
        db_table = "finance_accountmove"
        managed = False

    def __str__(self):
        return f"<AccountMove [{self.account_id} {self.amount_db}]>"
