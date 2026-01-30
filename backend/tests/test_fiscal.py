"""
Интеграционные тесты FiscalMicroservice.

Тесты работают с изолированной тестовой БД (test_django_db), которая
автоматически создаётся и удаляется при запуске (см. conftest.py).

Запуск:
    cd backend
    PYTHONPATH=.:/path/to/virt_card_processing \
    POSTGRES_HOST=localhost POSTGRES_PORT=7432 POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres NATS_SERVERS=localhost:4222 \
    python -m pytest tests/test_fiscal.py -v -s

Перед запуском убедитесь, что:
    1. PostgreSQL и NATS запущены (docker compose up db nats)
"""

import asyncio
import os
import sys
import uuid
import logging

import pytest
import pytest_asyncio

# ── Настраиваем env для локального запуска ──────────────────
# POSTGRES_DB устанавливается conftest.py → test_django_db
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "7432")
os.environ.setdefault("POSTGRES_USER", "postgres")
os.environ.setdefault("POSTGRES_PASSWORD", "postgres")
os.environ.setdefault("NATS_SERVERS", "localhost:4222")
os.environ.setdefault("FISCAL_DISABLE_CACHE", "True")

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger("test_fiscal")

# ── path hack (backend/ как корень + parent для common/) ────
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
for p in (BACKEND_DIR, PROJECT_ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

from tortoise import Tortoise, connections
from tortoise.exceptions import DoesNotExist

from models import TORTOISE_ORM
from models.models import (
    User,
    Client,
    Account,
    Currency,
    Operation,
    Transaction,
    AccountMove,
    TransactionKind,
    DepositTarif,
    DepositTarifLine,
    WithdrawTarif,
    WithdrawTarifLine,
    CardOpenTarif,
    CardOpenTarifLine,
    CardTopUpTarif,
    CardTopUpTarifLine,
)
from models.enums import OperationKind
from microservices.fiscal import FiscalMicroservice
from common.nats_utils import AsyncNatsProducer


# ═════════════════════════════════════════════════════════════
# Все тесты в одном session-loop, чтобы tortoise connections
# не конфликтовали между event loops.
# ═════════════════════════════════════════════════════════════

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── DB init / teardown (session scope) ──────────────────────


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def db():
    """Инициализация Tortoise ORM.
    Тестовая БД и таблицы создаются в conftest.py (pytest_configure)."""
    await Tortoise.init(config=TORTOISE_ORM)
    yield
    await connections.close_all()


# ── Справочные данные (session scope) ──────────────────────


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def currency(db):
    cur, _ = await Currency.get_or_create(
        code="USD_TEST",
        defaults=dict(
            kind="F",
            base="USD",
            name="US Dollar Test",
            symbol="$",
            denominator=2,
            human_denominator=2,
        ),
    )
    return cur


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def company_user(db):
    user, _ = await User.get_or_create(
        username="COMPANY",
        defaults=dict(
            is_staff=True,
            is_active=True,
            is_superuser=False,
            first_name="Company",
            last_name="Account",
            password="!",
            email="company@test.local",
        ),
    )
    return user


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def company_client(company_user):
    client, _ = await Client.get_or_create(
        user=company_user,
        defaults=dict(status="A", name="Company", email="company@test.local"),
    )
    return client


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def company_account(company_client, currency):
    acc, _ = await Account.get_or_create(
        client=company_client,
        currency=currency,
        kind=Account.Kind.DEFAULT,
        defaults=dict(amount_db=0, name="Company Account"),
    )
    return acc


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def client_user(db):
    user, _ = await User.get_or_create(
        username="TEST_CLIENT",
        defaults=dict(
            is_staff=False,
            is_active=True,
            first_name="Test",
            last_name="Client",
            password="!",
            email="client@test.local",
        ),
    )
    return user


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def client_obj(client_user):
    client, _ = await Client.get_or_create(
        user=client_user,
        defaults=dict(status="A", name="Test Client", email="testclient@test.local"),
    )
    return client


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def gate_user(db):
    user, _ = await User.get_or_create(
        username="TESTGATE",
        defaults=dict(
            is_staff=False,
            is_active=True,
            first_name="Test",
            last_name="Gate",
            password="!",
            email="gate@test.local",
        ),
    )
    return user


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def gate_client(gate_user):
    client, _ = await Client.get_or_create(
        user=gate_user,
        defaults=dict(status="A", name="Test Gate", email="testgate@test.local"),
    )
    return client


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def gate_account(gate_client, currency):
    acc, _ = await Account.get_or_create(
        client=gate_client,
        currency=currency,
        kind=Account.Kind.DEFAULT,
        defaults=dict(amount_db=1_000_000, name="Gate Account"),
    )
    return acc


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def deposit_tarif(currency):
    tarif, _ = await DepositTarif.get_or_create(
        name="Test Deposit Tarif",
        defaults=dict(status="A", is_default=True),
    )
    line, _ = await DepositTarifLine.get_or_create(
        tarif=tarif,
        currency=currency,
        method=Operation.Method.VIRTUAL_CARD,
        defaults=dict(is_active=True, fee_percent=2.0, fee_fixed=0.0, fee_minimal=0.0),
    )
    return tarif, line


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def withdraw_tarif(currency):
    tarif, _ = await WithdrawTarif.get_or_create(
        name="Test Withdraw Tarif",
        defaults=dict(status="A", is_default=True),
    )
    line, _ = await WithdrawTarifLine.get_or_create(
        tarif=tarif,
        currency=currency,
        method=Operation.Method.VIRTUAL_CARD,
        defaults=dict(is_active=True, fee_percent=1.5, fee_fixed=0.0, fee_minimal=0.0),
    )
    return tarif, line


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def card_open_tarif(currency):
    tarif, _ = await CardOpenTarif.get_or_create(
        name="Test Card Open Tarif",
        defaults=dict(status="A", is_default=True),
    )
    line, _ = await CardOpenTarifLine.get_or_create(
        tarif=tarif,
        currency=currency,
        method=Operation.Method.VIRTUAL_CARD,
        defaults=dict(is_active=True, fee_percent=1.0, fee_fixed=1.0, fee_minimal=0.0),
    )
    return tarif, line


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def card_topup_tarif(currency):
    tarif, _ = await CardTopUpTarif.get_or_create(
        name="Test Card TopUp Tarif",
        defaults=dict(status="A", is_default=True),
    )
    line, _ = await CardTopUpTarifLine.get_or_create(
        tarif=tarif,
        currency=currency,
        method=Operation.Method.VIRTUAL_CARD,
        defaults=dict(is_active=True, fee_percent=0.5, fee_fixed=0.0, fee_minimal=0.0),
    )
    return tarif, line


# ── Per-test fixtures ───────────────────────────────────────


@pytest_asyncio.fixture(loop_scope="session")
async def client_account(client_obj, currency):
    """Основной аккаунт клиента с балансом $100.00 (10000 db).
    Не удаляем здесь — cleanup_transactions позаботится."""
    acc = await Account.create(
        client=client_obj,
        currency=currency,
        kind=Account.Kind.DEFAULT,
        amount_db=10_000,
        name=f"Client Main {uuid.uuid4().hex[:6]}",
    )
    yield acc


@pytest_asyncio.fixture(loop_scope="session")
async def fiscal():
    svc = FiscalMicroservice()
    svc.nats_producer = None
    return svc


@pytest_asyncio.fixture(loop_scope="session")
async def fiscal_with_nats():
    svc = FiscalMicroservice()
    svc.nats_producer = AsyncNatsProducer(
        subjects=["item", "callback_process"],
        stream_name="fiscal_stream",
    )
    yield svc
    if svc.nats_producer:
        await svc.nats_producer.close()


# ── Cleanup transactions after each test ────────────────────


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def cleanup_transactions(db):
    yield
    try:
        # Строгий порядок удаления из-за FK:
        # 1. account_moves -> транзакции -> операции -> аккаунты(card)
        await AccountMove.all().delete()
        await Transaction.filter(parent_id__isnull=False).delete()
        await Transaction.all().delete()
        await Operation.filter(parent_id__isnull=False).delete()
        await Operation.all().delete()
        # Удаляем card-аккаунты (parent FK на client_account)
        await Account.filter(kind=Account.Kind.VIRTUAL_CARD).delete()
    except Exception as e:
        logger.warning("cleanup_transactions error: %s", e)


# ── Helpers ─────────────────────────────────────────────────


async def _create_operation(
    client_obj,
    account,
    currency,
    kind: str,
    amount_db: int,
    status: str = "O",
    method: str = "VC",
    data: dict | None = None,
) -> Operation:
    return await Operation.create(
        client=client_obj,
        account=account,
        currency=currency,
        kind=kind,
        status=status,
        method=method,
        amount_db=amount_db,
        data=data or {},
    )


def _make_nats_message(
    op: Operation,
    gate_code: str = "TESTGATE",
    extra_payload: dict | None = None,
) -> dict:
    payload = {
        "amount": op.amount_db,
        "gate": {"code": gate_code, "amount": op.amount_db},
    }
    if extra_payload:
        payload.update(extra_payload)
    return {"operation_guid": str(op.pk), "payload": payload}


# ═════════════════════════════════════════════════════════════
#                         TESTS
# ═════════════════════════════════════════════════════════════


class TestItemProcess:
    """Тесты точки входа item_process."""

    async def test_missing_guid(self, fiscal):
        await fiscal.item_process({})

    async def test_missing_gate(self, fiscal, client_obj, client_account, currency):
        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.DEPOSIT,
            1000,
        )
        await fiscal.item_process({"operation_guid": str(op.pk), "payload": {}})
        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.OPERATING

    async def test_wrong_status_skipped(
        self, fiscal, client_obj, client_account, currency
    ):
        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.DEPOSIT,
            1000,
            status="P",
        )
        msg = _make_nats_message(op)
        await fiscal.item_process(msg)
        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.PENDING

    async def test_unknown_kind(self, fiscal, client_obj, client_account, currency):
        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.SERVICE,
            1000,
        )
        msg = _make_nats_message(op)
        await fiscal.item_process(msg)
        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.OPERATING


class TestDepositProcess:
    """Тесты DEPOSIT."""

    async def test_deposit_completes(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        gate_account,
        company_account,
        deposit_tarif,
    ):
        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.DEPOSIT,
            5000,
        )
        msg = _make_nats_message(op)
        await fiscal.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE
        assert op.data.get("fiscal") is not None
        assert op.data["fiscal"]["amount"] == 50.0

    async def test_deposit_creates_transaction(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        gate_account,
        company_account,
        deposit_tarif,
    ):
        initial_client = (await Account.get(pk=client_account.pk)).amount_db
        initial_gate = (await Account.get(pk=gate_account.pk)).amount_db

        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.DEPOSIT,
            5000,
        )
        msg = _make_nats_message(op)
        await fiscal.item_process(msg)

        txns = await Transaction.filter(
            operation=op,
            kind=TransactionKind.DEPOSIT,
        ).all()
        assert len(txns) == 1
        assert txns[0].status == Transaction.Status.APPROVED
        assert txns[0].amount_db == 5000

        moves = await AccountMove.filter(transaction=txns[0]).all()
        assert len(moves) == 2

        updated_client = await Account.get(pk=client_account.pk)
        updated_gate = await Account.get(pk=gate_account.pk)
        # Клиент получает deposit, но платит fee (2%)
        fee_txns = await Transaction.filter(
            operation=op,
            kind=TransactionKind.FEE,
        ).all()
        total_fee = sum(t.amount_db for t in fee_txns)
        assert updated_client.amount_db == initial_client + 5000 - total_fee
        assert updated_gate.amount_db == initial_gate - 5000

    async def test_deposit_fee(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        gate_account,
        company_account,
        deposit_tarif,
    ):
        initial_company = (await Account.get(pk=company_account.pk)).amount_db

        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.DEPOSIT,
            10_000,  # $100
        )
        msg = _make_nats_message(op)
        await fiscal.item_process(msg)

        fee_txns = await Transaction.filter(
            operation=op,
            kind=TransactionKind.FEE,
        ).all()
        assert len(fee_txns) == 1
        # 2% от $100 = $2.00 = 200 db
        assert fee_txns[0].amount_db == 200

        updated_company = await Account.get(pk=company_account.pk)
        assert updated_company.amount_db >= initial_company + 200


class TestWithdrawProcess:
    """Тесты WITHDRAW."""

    async def test_withdraw_completes(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        gate_account,
        company_account,
        withdraw_tarif,
    ):
        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.WITHDRAW,
            3000,
        )
        msg = _make_nats_message(op)
        await fiscal.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE

    async def test_withdraw_balance_changes(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        gate_account,
        company_account,
        withdraw_tarif,
    ):
        initial_client = (await Account.get(pk=client_account.pk)).amount_db
        initial_gate = (await Account.get(pk=gate_account.pk)).amount_db

        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.WITHDRAW,
            3000,
        )
        msg = _make_nats_message(op)
        await fiscal.item_process(msg)

        updated_client = await Account.get(pk=client_account.pk)
        updated_gate = await Account.get(pk=gate_account.pk)
        # Клиент платит withdraw + fee (1.5%)
        fee_txns = await Transaction.filter(
            operation=op,
            kind=TransactionKind.FEE,
        ).all()
        total_fee = sum(t.amount_db for t in fee_txns)
        assert updated_client.amount_db == initial_client - 3000 - total_fee
        assert updated_gate.amount_db == initial_gate + 3000


class TestAdjustmentProcess:
    """Тесты ADJUSTMENT."""

    async def test_positive_adjustment(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        company_account,
    ):
        initial_client = (await Account.get(pk=client_account.pk)).amount_db
        initial_company = (await Account.get(pk=company_account.pk)).amount_db

        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.ADJUSTMENT,
            2000,
        )
        msg = _make_nats_message(op)
        await fiscal.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE

        updated_client = await Account.get(pk=client_account.pk)
        updated_company = await Account.get(pk=company_account.pk)
        assert updated_client.amount_db == initial_client + 2000
        assert updated_company.amount_db == initial_company - 2000

    async def test_negative_adjustment(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        company_account,
    ):
        initial_client = (await Account.get(pk=client_account.pk)).amount_db
        initial_company = (await Account.get(pk=company_account.pk)).amount_db

        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.ADJUSTMENT,
            -1500,
        )
        msg = _make_nats_message(op)
        await fiscal.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE

        updated_client = await Account.get(pk=client_account.pk)
        updated_company = await Account.get(pk=company_account.pk)
        assert updated_client.amount_db == initial_client - 1500
        assert updated_company.amount_db == initial_company + 1500


class TestCardOpenProcess:
    """Тесты CARD_OPEN."""

    async def test_card_open_creates_account(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        company_account,
        card_open_tarif,
    ):
        card_id = f"test_card_{uuid.uuid4().hex[:8]}"
        open_amount = 5000
        initial_parent = (await Account.get(pk=client_account.pk)).amount_db

        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.CARD_OPEN,
            open_amount,
        )
        msg = {
            "operation_guid": str(op.pk),
            "payload": {
                "amount": open_amount,
                "gate": {
                    "code": "card_provider",
                    "amount": open_amount,
                    "result": {
                        "card_id": card_id,
                        "sensitive": {"pan": "4111111111111111", "cvv": "123"},
                    },
                },
                "card_name": "Test Card",
            },
        }
        await fiscal.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE

        card_account = await Account.get(external_id=card_id)
        assert card_account.kind == Account.Kind.VIRTUAL_CARD
        assert card_account.parent_id == client_account.pk
        assert card_account.credentials.get("pan") == "4111111111111111"

        txns = await Transaction.filter(
            operation=op,
            kind=TransactionKind.MOVE,
        ).all()
        assert len(txns) == 1
        assert txns[0].amount_db == open_amount

        updated_parent = await Account.get(pk=client_account.pk)
        # Parent теряет: open_amount (move) + fee (1% + $1.00 fixed)
        # fee = 1% * 5000db/100 = 50 + fixed 100 = 150 db
        fee_txns = await Transaction.filter(
            operation=op,
            kind=TransactionKind.FEE,
        ).all()
        total_fee = sum(t.amount_db for t in fee_txns)
        assert updated_parent.amount_db == initial_parent - open_amount - total_fee

        updated_card = await Account.get(pk=card_account.pk)
        assert updated_card.amount_db == open_amount

        # cleanup handled by cleanup_transactions fixture

    async def test_card_open_fee(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        company_account,
        card_open_tarif,
    ):
        card_id = f"test_card_fee_{uuid.uuid4().hex[:8]}"
        open_amount = 10_000  # $100
        initial_company = (await Account.get(pk=company_account.pk)).amount_db

        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.CARD_OPEN,
            open_amount,
        )
        msg = {
            "operation_guid": str(op.pk),
            "payload": {
                "amount": open_amount,
                "gate": {
                    "code": "card_provider",
                    "amount": open_amount,
                    "result": {"card_id": card_id, "sensitive": {}},
                },
            },
        }
        await fiscal.item_process(msg)

        fee_txns = await Transaction.filter(
            operation=op,
            kind=TransactionKind.FEE,
        ).all()
        assert len(fee_txns) == 1
        # 1% от $100 = $1.00 + $1.00 fixed = $2.00 = 200 db
        assert fee_txns[0].amount_db == 200

        updated_company = await Account.get(pk=company_account.pk)
        assert updated_company.amount_db >= initial_company + 200

        # cleanup handled by cleanup_transactions fixture


class TestCardTopUpProcess:
    """Тесты CARD_TOPUP."""

    async def test_card_topup(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        company_account,
        card_topup_tarif,
    ):
        card_account = await Account.create(
            client=client_obj,
            currency=currency,
            kind=Account.Kind.VIRTUAL_CARD,
            parent=client_account,
            amount_db=0,
            name=f"Card topup {uuid.uuid4().hex[:6]}",
        )
        topup_amount = 3000
        initial_parent = (await Account.get(pk=client_account.pk)).amount_db

        op = await _create_operation(
            client_obj,
            card_account,
            currency,
            OperationKind.CARD_TOPUP,
            topup_amount,
        )
        msg = {
            "operation_guid": str(op.pk),
            "payload": {
                "amount": topup_amount,
                "gate": {"code": "card_provider", "amount": topup_amount},
            },
        }
        await fiscal.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE

        txns = await Transaction.filter(
            operation=op,
            kind=TransactionKind.MOVE,
        ).all()
        assert len(txns) == 1
        assert txns[0].amount_db == topup_amount

        updated_parent = await Account.get(pk=client_account.pk)
        updated_card = await Account.get(pk=card_account.pk)
        # Parent теряет: topup_amount (move) + fee (0.5%)
        fee_txns = await Transaction.filter(
            operation=op,
            kind=TransactionKind.FEE,
        ).all()
        total_fee = sum(t.amount_db for t in fee_txns)
        assert updated_parent.amount_db == initial_parent - topup_amount - total_fee
        assert updated_card.amount_db == topup_amount

        # cleanup handled by cleanup_transactions fixture


class TestCardCloseProcess:
    """Тесты CARD_CLOSE."""

    async def test_card_close_returns_balance(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
        company_account,
    ):
        card_balance = 2500
        card_account = await Account.create(
            client=client_obj,
            currency=currency,
            kind=Account.Kind.VIRTUAL_CARD,
            parent=client_account,
            amount_db=card_balance,
            name=f"Card close {uuid.uuid4().hex[:6]}",
        )
        initial_parent = (await Account.get(pk=client_account.pk)).amount_db

        op = await _create_operation(
            client_obj,
            card_account,
            currency,
            OperationKind.CARD_CLOSE,
            0,
        )
        msg = {
            "operation_guid": str(op.pk),
            "payload": {
                "gate": {"code": "card_provider", "balance_db": card_balance},
            },
        }
        await fiscal.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE

        updated_card = await Account.get(pk=card_account.pk)
        assert updated_card.status == Account.Status.CLOSED

        updated_parent = await Account.get(pk=client_account.pk)
        assert updated_parent.amount_db == initial_parent + card_balance

        # cleanup handled by cleanup_transactions fixture


class TestCardBlockRestoreProcess:
    """Тесты CARD_BLOCK и CARD_RESTORE."""

    async def test_card_block(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
    ):
        card_account = await Account.create(
            client=client_obj,
            currency=currency,
            kind=Account.Kind.VIRTUAL_CARD,
            parent=client_account,
            amount_db=1000,
            name=f"Card block {uuid.uuid4().hex[:6]}",
        )
        op = await _create_operation(
            client_obj,
            card_account,
            currency,
            OperationKind.CARD_BLOCK,
            0,
        )
        msg = {
            "operation_guid": str(op.pk),
            "payload": {"gate": {"code": "card_provider"}},
        }
        await fiscal.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE

        updated_card = await Account.get(pk=card_account.pk)
        assert updated_card.status == Account.Status.BLOCKED

        # cleanup handled by cleanup_transactions fixture

    async def test_card_restore(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
    ):
        card_account = await Account.create(
            client=client_obj,
            currency=currency,
            kind=Account.Kind.VIRTUAL_CARD,
            parent=client_account,
            amount_db=1000,
            status=Account.Status.BLOCKED,
            name=f"Card restore {uuid.uuid4().hex[:6]}",
        )
        op = await _create_operation(
            client_obj,
            card_account,
            currency,
            OperationKind.CARD_RESTORE,
            0,
        )
        msg = {
            "operation_guid": str(op.pk),
            "payload": {"gate": {"code": "card_provider"}},
        }
        await fiscal.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE

        updated_card = await Account.get(pk=card_account.pk)
        assert updated_card.status == Account.Status.RESTORED

        # cleanup handled by cleanup_transactions fixture

    async def test_block_idempotent(
        self,
        fiscal,
        client_obj,
        client_account,
        currency,
    ):
        """Повторная блокировка уже заблокированного — no-op."""
        card_account = await Account.create(
            client=client_obj,
            currency=currency,
            kind=Account.Kind.VIRTUAL_CARD,
            parent=client_account,
            amount_db=1000,
            status=Account.Status.BLOCKED,
            name=f"Already blocked {uuid.uuid4().hex[:6]}",
        )
        op = await _create_operation(
            client_obj,
            card_account,
            currency,
            OperationKind.CARD_BLOCK,
            0,
        )
        msg = {
            "operation_guid": str(op.pk),
            "payload": {"gate": {"code": "card_provider"}},
        }
        await fiscal.item_process(msg)

        # Обработчик вышел рано — операция осталась OPERATING
        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.OPERATING

        # cleanup handled by cleanup_transactions fixture


class TestE2ENats:
    """End-to-end: отправка через NATS → обработка fiscal."""

    @pytest.mark.skipif(
        os.getenv("SKIP_NATS_TESTS", "0") == "1",
        reason="NATS not available",
    )
    async def test_publish_and_consume_deposit(
        self,
        fiscal_with_nats,
        client_obj,
        client_account,
        currency,
        gate_account,
        company_account,
        deposit_tarif,
    ):
        op = await _create_operation(
            client_obj,
            client_account,
            currency,
            OperationKind.DEPOSIT,
            7777,
        )
        msg = _make_nats_message(op)

        await fiscal_with_nats.nats_producer.publish("item", msg)
        # Вместо consume_forever — вызываем напрямую
        await fiscal_with_nats.item_process(msg)

        op = await Operation.get(pk=op.pk)
        assert op.status == Operation.Status.COMPLETE
