from base_daemon import BaseHandler
from models.models import (
    Operation,
    Account,
    Transaction,
    AccountMove,
    TransactionKind,
    DepositTarifLine,
    WithdrawTarifLine,
    CardOpenTarifLine,
    CardTopUpTarifLine,
    amount_db_to_human,
    amount_human_to_db,
)
from models.enums import OperationKind
from models.djangoise import db_transaction
from tortoise import timezone
from tortoise.exceptions import DoesNotExist
from tortoise.expressions import F
from decimal import Decimal
import logging
import os

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

WITH_CACHE = os.getenv("FISCAL_DISABLE_CACHE") not in ["True", "1"]


class FiscalMicroservice(BaseHandler):
    name = "FiscalMicroservice"
    with_nats = True
    nats_stream_name = "fiscal_stream"
    subjects = ["item"]
    _company_accounts = {}

    async def on_start(self):
        pass

    async def on_stop(self):
        await super().on_stop()

    # ── helpers ──────────────────────────────────────────────

    async def _get_company_account(self, currency_id: int) -> Account:
        cache_key = str(currency_id)
        if cache_key not in self._company_accounts or not WITH_CACHE:
            company_account = await Account.get(
                currency_id=currency_id,
                client__user__username="COMPANY",
            )
            if WITH_CACHE:
                self._company_accounts[cache_key] = company_account
            return company_account
        return self._company_accounts[cache_key]

    async def _unhold_amount(
        self, instance: Operation, payload: dict, account: Account | None = None
    ):
        if not payload.get("holded_amount"):
            return
        if account is None:
            await instance.fetch_related("account")
            account = instance.account
        if account is None:
            self.logger.warning("Account is None for operation %s", instance.pk)
            return
        holded_amount = payload["holded_amount"]
        current_holded = account.amount_holded_db or 0
        await Account.filter(pk=account.pk).update(
            amount_holded_db=max(0, current_holded - holded_amount)
        )

    # ── transaction engine ──────────────────────────────────

    async def approve_transaction(
        self,
        transaction: Transaction,
        amount_for_fee: int | None = None,
        tarifline=None,
        with_fixed: bool = True,
    ) -> int:
        """Одобряет транзакцию: обновляет балансы, создаёт AccountMove, считает комиссию."""
        await Transaction.filter(pk=transaction.pk).update(
            status=Transaction.Status.APPROVED
        )
        await Account.filter(pk=transaction.account_from_id).update(
            amount_db=F("amount_db") - transaction.amount_db
        )
        await Account.filter(pk=transaction.account_to_id).update(
            amount_db=F("amount_db") + transaction.amount_db
        )

        am_from = AccountMove(
            account_id=transaction.account_from_id,
            currency_id=transaction.currency_from_id,
            amount_db=-transaction.amount_db,
            transaction=transaction,
            status=AccountMove.Status.APPROVED,
            direction=0,
        )
        await am_from.save()
        am_to = AccountMove(
            account_id=transaction.account_to_id,
            currency_id=transaction.currency_to_id,
            amount_db=transaction.amount_db,
            transaction=transaction,
            status=AccountMove.Status.APPROVED,
            direction=1,
        )
        await am_to.save()

        if transaction.kind != TransactionKind.FEE and amount_for_fee != 0:
            return await self.make_fee(
                transaction,
                amount_for_fee=amount_for_fee,
                tarifline=tarifline,
                with_fixed=with_fixed,
            )
        return 0

    async def make_fee(
        self,
        transaction: Transaction,
        amount_for_fee: int | None = None,
        tarifline=None,
        with_fixed: bool = True,
    ) -> int:
        """Рассчитывает и проводит комиссию по транзакции."""
        if amount_for_fee is None:
            amount_for_fee = transaction.amount_db
        fee_db = 0
        fee_rules: dict = {}

        if transaction.kind == TransactionKind.DEPOSIT:
            client_account_id = transaction.account_to_id
        elif transaction.kind == TransactionKind.WITHDRAW:
            client_account_id = transaction.account_from_id
        elif transaction.kind == TransactionKind.MOVE:
            await transaction.fetch_related("operation", "operation__account")
            client_account_id = transaction.operation.account_id
        else:
            client_account_id = transaction.account_from_id

        # Для CARD_TOPUP комиссия с родительского аккаунта (account_from)
        await transaction.fetch_related("operation")
        if transaction.operation.kind == OperationKind.CARD_TOPUP:
            client_account_id = transaction.account_from_id

        client_account = await Account.get(pk=client_account_id)

        if tarifline:
            fee_rules = {
                "comment": (
                    f"TarifLine fee #{tarifline.tarif_id}/{tarifline.pk}: "
                    f"{tarifline.fee_percent}%, {tarifline.fee_fixed} fix, "
                    f"{tarifline.fee_minimal} min."
                ),
                "tarifline_id": tarifline.pk,
                "fee_percent": float(tarifline.fee_percent),
                "fee_fixed": float(tarifline.fee_fixed),
                "fee_minimal": float(tarifline.fee_minimal),
            }

        if fee_rules:
            await transaction.fetch_related("currency_from")
            currency = transaction.currency_from

            fee_fixed_db = amount_human_to_db(
                Decimal(str(fee_rules["fee_fixed"])), currency
            )
            fee_db = amount_human_to_db(
                amount_db_to_human(amount_for_fee, currency)
                * Decimal(str(fee_rules["fee_percent"]))
                / 100,
                currency,
            )
            fee_minimal_db = amount_human_to_db(
                Decimal(str(fee_rules["fee_minimal"])), currency
            )
            if abs(fee_db) < abs(fee_minimal_db):
                fee_db = fee_minimal_db
            if with_fixed:
                fee_db = fee_fixed_db + fee_db

        self.logger.info(
            "make_fee: Fee for transaction #%s - exec:%r. fee_db: %r",
            transaction.pk,
            fee_rules,
            fee_db,
        )

        if not fee_db:
            return 0

        company_account = await self._get_company_account(transaction.currency_from_id)

        fee_transaction = Transaction(
            parent=transaction,
            status=Transaction.Status.APPROVED,
            kind=TransactionKind.FEE,
            account_from=client_account,
            account_to=company_account,
            currency_from_id=transaction.currency_from_id,
            currency_to_id=transaction.currency_from_id,
            operation_id=transaction.operation_id,
            amount_db=fee_db,
            data=fee_rules,
        )
        await fee_transaction.save()
        self.logger.info(
            "make_fee: Transaction created: #%s %s",
            fee_transaction.pk,
            fee_transaction,
        )
        await self.approve_transaction(fee_transaction)
        return fee_db

    # ── tarif helpers ───────────────────────────────────────

    async def _get_deposit_tarifline(self, instance: Operation):
        await instance.fetch_related("account", "account__client", "currency")
        try:
            return await DepositTarifLine.filter(
                tarif__status="A",
                is_active=True,
                currency_id=instance.currency_id,
                method=instance.method,
            ).first()
        except Exception:
            self.logger.exception(
                "Failed to get deposit tarifline for op %s", instance.pk
            )
            return None

    async def _get_withdraw_tarifline(self, instance: Operation):
        await instance.fetch_related("account", "account__client", "currency")
        try:
            return await WithdrawTarifLine.filter(
                tarif__status="A",
                is_active=True,
                currency_id=instance.currency_id,
                method=instance.method,
            ).first()
        except Exception:
            self.logger.exception(
                "Failed to get withdraw tarifline for op %s", instance.pk
            )
            return None

    async def _get_card_open_tarifline(self, instance: Operation):
        try:
            return await CardOpenTarifLine.filter(
                tarif__status="A",
                is_active=True,
                currency_id=instance.currency_id,
                method=instance.method,
            ).first()
        except Exception:
            self.logger.exception(
                "Failed to get card open tarifline for op %s", instance.pk
            )
            return None

    async def _get_card_topup_tarifline(self, instance: Operation):
        try:
            return await CardTopUpTarifLine.filter(
                tarif__status="A",
                is_active=True,
                currency_id=instance.currency_id,
                method=instance.method,
            ).first()
        except Exception:
            self.logger.exception(
                "Failed to get card topup tarifline for op %s", instance.pk
            )
            return None

    # ── inner move (parent <-> card) ────────────────────────

    async def _inner_move_process(
        self,
        instance: Operation,
        account_from: Account,
        account_to: Account,
        amount_db: int,
        tarifline=None,
    ) -> Transaction:
        """Перемещение средств между аккаунтами (parent <-> card account)."""
        await account_from.fetch_related("currency")
        currency = account_from.currency
        transaction = Transaction(
            account_from=account_from,
            account_to=account_to,
            status=Transaction.Status.DRAFT,
            kind=TransactionKind.MOVE,
            currency_from=currency,
            currency_to=currency,
            amount_db=amount_db,
            operation=instance,
        )
        await transaction.save()
        self.logger.info(
            "_inner_move_process: Transaction created: #%s %s",
            transaction.pk,
            transaction,
        )
        await self.approve_transaction(transaction, amount_db, tarifline=tarifline)
        return transaction

    # ── post-done (notifications) ───────────────────────────

    async def _post_done(self, instance: Operation) -> None:
        """Финализация после обработки: коллбэки и уведомления."""
        await instance.refresh_from_db()
        is_final = instance.status in (
            Operation.Status.COMPLETE,
            Operation.Status.FAILED,
        )
        # Если есть parent — отправляем событие в fiscal для обработки parent-а
        if instance.parent_id:
            await instance.fetch_related("parent")
            parent = instance.parent
            sub_ops = await Operation.filter(
                parent_id=parent.pk, status=Operation.Status.COMPLETE
            ).all()
            sub_amount_db = sum(op.amount_db or 0 for op in sub_ops)
            if sub_amount_db >= (parent.amount_db or 0):
                self.logger.info(
                    "Child op %s triggers parent %s fiscal processing",
                    instance.pk,
                    parent.pk,
                )
                if self.nats_producer:
                    await self.nats_producer.publish(
                        "item", parent.data if isinstance(parent.data, dict) else {}
                    )
            return

        # Отправляем callback если есть URL
        if is_final and self.nats_producer:
            op_data = instance.data or {}
            callback_url = (
                op_data.get("callback_url") if isinstance(op_data, dict) else None
            )
            if callback_url:
                await self.nats_producer.publish(
                    "callback_process",
                    {
                        "type": "operation",
                        "operation_guid": str(instance.pk),
                        "callback_url": callback_url,
                    },
                )

    # ── atomic operation process (deposit/withdraw) ─────────

    @db_transaction()
    async def _atomic_operation_process(
        self, instance: Operation, operation: dict, is_withdraw: bool = False
    ):
        uid = operation["operation_guid"]
        payload = operation["payload"]

        # Проверка на подоперации
        suboperations = await Operation.filter(parent_id=instance.pk).all()
        if suboperations and not (
            payload.get("gate", {}).get("code", "").startswith(("c2c", "transfer"))
            and instance.kind in [OperationKind.DEPOSIT, OperationKind.WITHDRAW]
        ):
            manual_status = payload.get("manual_status")
            sub_amount_db = sum(
                op.amount_db or 0
                for op in suboperations
                if op.status == Operation.Status.COMPLETE
            )
            self.logger.info(
                "Finalize parent op. (amount=%s, sub_amount_db=%s)",
                instance.amount_db,
                sub_amount_db,
            )
            if sub_amount_db >= (instance.amount_db or 0) or manual_status == "SUCCESS":
                payload["paid_db"] = sub_amount_db
                current_data = instance.data or {}
                if isinstance(current_data, dict):
                    current_data.update(payload)
                else:
                    current_data = payload
                await Operation.filter(pk=instance.pk).update(
                    status=Operation.Status.COMPLETE,
                    updated_at=timezone.now(),
                    done_at=timezone.now(),
                    data=current_data,
                )
                await self._unhold_amount(instance, payload)
            return

        amount_db = payload.get("amount", 0)
        gate_amount_db = int(payload.get("gate", {}).get("amount", 0))

        await instance.fetch_related("account", "account__parent", "currency")
        account = instance.account

        if (
            gate_amount_db
            and gate_amount_db != amount_db
            and not (
                payload.get("gate", {}).get("code", "").startswith("c2c")
                and instance.kind == OperationKind.DEPOSIT
            )
        ):
            self.logger.warning(
                "Gate amount != operation amount (%r != %r) [%r]",
                gate_amount_db,
                amount_db,
                uid,
            )
            amount_db = gate_amount_db

        payload["paid_db"] = amount_db
        amount_for_fee = amount_db

        if not instance.amount_db:
            await Operation.filter(pk=instance.pk).update(amount_db=amount_db)

        current_data = instance.data or {}
        if isinstance(current_data, dict):
            current_data.update(payload)
        else:
            current_data = payload

        amount = amount_db_to_human(amount_db, instance.currency)

        # Получаем тарифную линию
        if is_withdraw:
            tarifline = await self._get_withdraw_tarifline(instance)
        else:
            tarifline = await self._get_deposit_tarifline(instance)

        fee_amount = Decimal(0)
        if tarifline:
            fee_amount = tarifline.calc_fee(amount)

        if not tarifline:
            self.logger.warning("TarifLine not found for operation %s", instance.pk)

        fiscal_data = {
            "amount": float(amount),
            "fee_percent": float(tarifline.fee_percent) if tarifline else 0.0,
            "fee_fixed": float(tarifline.fee_fixed) if tarifline else 0.0,
            "fee_amount": float(fee_amount),
        }
        current_data["fiscal"] = fiscal_data

        tarif = None
        if tarifline:
            await tarifline.fetch_related("tarif")
            tarif = tarifline.tarif

        await Operation.filter(pk=instance.pk).update(
            status=Operation.Status.COMPLETE,
            updated_at=timezone.now(),
            done_at=timezone.now(),
            data=current_data,
            tarif_id=tarif.pk if tarif else None,
        )

        await self._unhold_amount(instance, payload)

        # Определяем gate account
        gate = payload.get("gate") or {}
        gate_code = gate.get("code", "")
        gate_account = None
        try:
            # Ищем клиента гейта через code операции
            from models.models import Client

            gate_client = await Client.filter(user__username=gate_code.upper()).first()
            if gate_client:
                gate_account = await Account.filter(
                    currency_id=instance.currency_id,
                    client=gate_client,
                    kind=Account.Kind.DEFAULT,
                ).first()
        except Exception:
            self.logger.warning("Gate account not found for code %s", gate_code)

        if not gate_account:
            self.logger.warning(
                "Gate account not found, skipping transaction creation for op %s",
                instance.pk,
            )
            return

        # Создаём транзакцию
        if is_withdraw:
            account_from = account
            account_to = gate_account
            kind = TransactionKind.WITHDRAW
        else:
            account_from = gate_account
            account_to = account
            kind = TransactionKind.DEPOSIT

        # Проверка на дубликат
        exists = await Transaction.filter(
            account_from=account_from,
            account_to=account_to,
            kind=kind,
            currency_from_id=instance.currency_id,
            currency_to_id=instance.currency_id,
            operation=instance,
        ).exists()
        if exists:
            self.logger.info("Transaction already exists for op %s", instance.pk)
            return

        transaction_data = {}
        if "comment" in payload:
            transaction_data["comment"] = payload["comment"]

        transaction = Transaction(
            status=Transaction.Status.DRAFT,
            amount_db=amount_db,
            data=transaction_data,
            account_from=account_from,
            account_to=account_to,
            kind=kind,
            currency_from_id=instance.currency_id,
            currency_to_id=instance.currency_id,
            operation=instance,
        )
        await transaction.save()
        self.logger.info(
            "_atomic_operation_process: Transaction created: #%s %s",
            transaction.pk,
            transaction,
        )

        if gate_code.upper().startswith("MANUAL_"):
            amount_for_fee = 0

        with_fixed = True
        op_data = instance.data or {}
        if isinstance(op_data, dict) and op_data.get("fixed_amount_fetch", False):
            with_fixed = False
        if instance.parent_id:
            await instance.fetch_related("parent")
            parent_data = instance.parent.data or {}
            if isinstance(parent_data, dict) and parent_data.get(
                "fixed_amount_fetch", False
            ):
                with_fixed = False

        fee_db = await self.approve_transaction(
            transaction,
            amount_for_fee,
            tarifline=tarifline,
            with_fixed=with_fixed,
        )

        if with_fixed and instance.kind == OperationKind.WITHDRAW:
            if instance.parent_id:
                parent_data = instance.parent.data or {}
                if isinstance(parent_data, dict):
                    parent_data["fixed_amount_fetch"] = True
                    await Operation.filter(pk=instance.parent_id).update(
                        data=parent_data
                    )
            else:
                if isinstance(op_data, dict):
                    op_data["fixed_amount_fetch"] = True
                    await Operation.filter(pk=instance.pk).update(data=op_data)

        self.logger.info(
            "_atomic_operation_process: Operation #%s approved (amount_db=%s, fee_db=%s)",
            uid,
            amount_db,
            fee_db,
        )

    async def _operation_process(
        self, instance: Operation, operation: dict, is_withdraw: bool = False
    ) -> None:
        await self._atomic_operation_process(
            instance, operation, is_withdraw=is_withdraw
        )
        await self._post_done(instance)

    # ── operation handlers ──────────────────────────────────

    async def operation_deposit_process(
        self, instance: Operation, operation: dict
    ) -> None:
        await self._operation_process(instance, operation, is_withdraw=False)

    async def operation_withdraw_process(
        self, instance: Operation, operation: dict
    ) -> None:
        await self._operation_process(instance, operation, is_withdraw=True)

    @db_transaction()
    async def operation_adjustment_process(self, instance: Operation, operation: dict):
        await instance.fetch_related("account", "account__currency")
        client_account = instance.account
        currency = client_account.currency
        company_account = await self._get_company_account(currency.pk)
        amount_db = instance.amount_db or 0

        if amount_db < 0:
            account_from = client_account
            account_to = company_account
            amount_db = -amount_db
        else:
            account_from = company_account
            account_to = client_account

        transaction = Transaction(
            status=Transaction.Status.APPROVED,
            kind=TransactionKind.ADJUSTMENT,
            account_from=account_from,
            account_to=account_to,
            currency_from=currency,
            currency_to=currency,
            operation=instance,
            amount_db=amount_db,
            data=instance.data or {},
        )
        await transaction.save()
        self.logger.info(
            "operation_adjustment_process: Transaction created: #%s %s",
            transaction.pk,
            transaction,
        )
        await self.approve_transaction(transaction)

        await Operation.filter(pk=instance.pk).update(
            status=Operation.Status.COMPLETE,
            updated_at=timezone.now(),
            done_at=timezone.now(),
        )
        self.logger.info(
            "operation_adjustment_process: Operation #%s COMPLETE (amount_db=%s)",
            instance.pk,
            instance.amount_db,
        )
        await self._post_done(instance)

    # ── card operations ─────────────────────────────────────

    @db_transaction()
    async def operation_card_open_process(self, instance: Operation, operation: dict):
        uid = instance.pk
        payload = operation["payload"]
        await instance.fetch_related("account", "account__client", "account__currency")
        parent_account = instance.account
        client = parent_account.client
        currency = parent_account.currency

        card_id = payload["gate"]["result"]["card_id"]

        # Ищем аккаунт карты (создаётся в opmanager)
        account_without_creds = False
        try:
            new_account = await Account.get(external_id=card_id)
            if new_account.status in [Account.Status.BLOCKED, Account.Status.CLOSED]:
                raise DoesNotExist("Account blocked or closed")
            account_without_creds = True
        except DoesNotExist:
            acc_creds = payload["gate"]["result"].get("sensitive", {})
            acc_data = {
                "gate_card_id": card_id,
                "open_operation_id": str(uid),
                "callback_url": payload.get("callback_url"),
                "otp_callback_url": payload.get("otp_callback_url"),
            }
            new_account = await Account.create(
                kind=Account.Kind.VIRTUAL_CARD,
                parent=parent_account,
                currency=currency,
                client=client,
                external_id=card_id,
                data=acc_data,
                credentials=acc_creds,
                name=payload.get("card_name"),
            )

        if account_without_creds:
            acc_creds = payload["gate"]["result"].get("sensitive", {})
            acc_data = {
                "gate_card_id": card_id,
                "open_operation_id": str(uid),
                "callback_url": payload.get("callback_url"),
                "otp_callback_url": payload.get("otp_callback_url"),
            }
            await Account.filter(pk=new_account.pk).update(
                credentials=acc_creds,
                data=acc_data,
                status=Account.Status.ACTIVE,
            )

        # ID карты в результат
        if "sensitive" in payload.get("gate", {}).get("result", {}):
            payload["gate"]["result"]["sensitive"]["card_account"] = str(new_account.pk)

        self.logger.info("Card_open: created account %s", new_account.pk)

        # Unhold с parent аккаунта
        await self._unhold_amount(instance, payload)

        # Получаем тарифную линию
        tarifline = await self._get_card_open_tarifline(instance)

        tarif = None
        if tarifline:
            await tarifline.fetch_related("tarif")
            tarif = tarifline.tarif

        await Operation.filter(pk=uid).update(
            status=Operation.Status.COMPLETE,
            updated_at=timezone.now(),
            done_at=timezone.now(),
            data=payload,
            tarif_id=tarif.pk if tarif else None,
        )
        self.logger.info("operation_card_open_process: Operation #%s COMPLETE", uid)

        # Move: parent -> card account
        await self._inner_move_process(
            instance,
            parent_account,
            new_account,
            payload.get("amount", 0),
            tarifline=tarifline,
        )

        await self._post_done(instance)

    @db_transaction()
    async def operation_card_topup_process(self, instance: Operation, operation: dict):
        uid = instance.pk
        payload = operation["payload"]
        await instance.fetch_related("account", "account__parent", "currency")

        tarifline = await self._get_card_topup_tarifline(instance)

        tarif = None
        if tarifline:
            await tarifline.fetch_related("tarif")
            tarif = tarifline.tarif

        await Operation.filter(pk=uid).update(
            status=Operation.Status.COMPLETE,
            updated_at=timezone.now(),
            done_at=timezone.now(),
            data=payload,
            tarif_id=tarif.pk if tarif else None,
        )

        # Unhold с parent аккаунта
        await self._unhold_amount(instance, payload, instance.account.parent)

        # Move: parent -> card account
        await self._inner_move_process(
            instance,
            instance.account.parent,
            instance.account,
            payload.get("amount", 0),
            tarifline=tarifline,
        )

        self.logger.info("operation_card_topup_process: Operation #%s COMPLETE", uid)
        await self._post_done(instance)

    @db_transaction()
    async def operation_card_close_process(self, instance: Operation, operation: dict):
        uid = instance.pk
        payload = operation["payload"]
        await instance.fetch_related("account", "account__parent")

        card_acc = instance.account
        if card_acc.status == Account.Status.CLOSED:
            self.logger.info(
                "operation_card_close_process: Op #%s — account already CLOSED", uid
            )
            return

        # Баланс для возврата
        gate_balance = payload.get("gate", {}).get("balance_db")
        if not gate_balance:
            gate_balance = card_acc.amount_db or 0

        # Если было промо — вычитаем
        acc_data = card_acc.data or {}
        if isinstance(acc_data, dict):
            used_promo = acc_data.get("used_promo")
            if used_promo:
                promo_amount = used_promo.get("amount_db", 0)
                gate_balance = max(0, gate_balance - promo_amount)

        # Move: card -> parent
        await self._inner_move_process(
            instance,
            instance.account,
            instance.account.parent,
            gate_balance,
        )

        await Operation.filter(pk=uid).update(
            status=Operation.Status.COMPLETE,
            updated_at=timezone.now(),
            done_at=timezone.now(),
            data=payload,
            amount_db=gate_balance,
        )
        await Account.filter(pk=instance.account_id).update(
            status=Account.Status.CLOSED
        )

        self.logger.info("operation_card_close_process: Operation #%s COMPLETE", uid)
        await self._post_done(instance)

    @db_transaction()
    async def operation_card_block_process(self, instance: Operation, operation: dict):
        uid = instance.pk
        await instance.fetch_related("account")

        if instance.account.status == Account.Status.BLOCKED:
            self.logger.info(
                "operation_card_block_process: Op #%s — account already BLOCKED", uid
            )
            return

        payload = operation["payload"]
        await Operation.filter(pk=uid).update(
            status=Operation.Status.COMPLETE,
            updated_at=timezone.now(),
            done_at=timezone.now(),
            data=payload,
        )
        await Account.filter(pk=instance.account_id).update(
            status=Account.Status.BLOCKED
        )

        self.logger.info("operation_card_block_process: Operation #%s COMPLETE", uid)

    @db_transaction()
    async def operation_card_restore_process(
        self, instance: Operation, operation: dict
    ):
        uid = instance.pk
        await instance.fetch_related("account")

        if instance.account.status == Account.Status.RESTORED:
            self.logger.info(
                "operation_card_restore_process: Op #%s — account already RESTORED", uid
            )
            return

        payload = operation["payload"]
        await Operation.filter(pk=uid).update(
            status=Operation.Status.COMPLETE,
            updated_at=timezone.now(),
            done_at=timezone.now(),
            data=payload,
        )
        await Account.filter(pk=instance.account_id).update(
            status=Account.Status.RESTORED
        )

        self.logger.info("operation_card_restore_process: Operation #%s COMPLETE", uid)

    # ── entry point ─────────────────────────────────────────

    async def item_process(self, data: dict):
        uid = data.get("operation_guid")
        if not uid:
            self.logger.warning("Operation guid not found in data: %r", data)
            return

        gate = data.get("payload", {}).get("gate")
        if not gate:
            self.logger.warning("Gate not found for operation #%s !", uid)
            return

        self.logger.info("item_process: operation %r", uid)

        try:
            instance = await Operation.get(pk=uid)
        except DoesNotExist:
            self.logger.error("Operation #%s not found", uid)
            return

        # Проверка статуса — только OPERATING допускается
        if instance.status != Operation.Status.OPERATING:
            self.logger.warning(
                "Fiscal: Operation status is not OPERATING <%s> [%s]",
                instance.status,
                uid,
            )
            return

        # Динамический dispatch как в оригинале
        # TextChoices хранит (value, label), получаем label через name enum-а
        kind_enum = OperationKind(instance.kind)
        kind_display = kind_enum.name.lower()
        method_name = f"operation_{kind_display}_process"

        if not hasattr(self, method_name):
            self.logger.warning(
                "No handler for operation kind %r -> %s [%s]",
                instance.kind,
                method_name,
                uid,
            )
            return

        try:
            method = getattr(self, method_name)
            await method(instance, data)
        except Exception:
            self.logger.exception(
                "Problem with operation [%s] (item_process: %s)", uid, method_name
            )

    async def inner_run(self):
        logger.info("FiscalMicroservice inner run")
        assert self.nats_consumer is not None
        await self.nats_consumer.consume_forever(
            batch=10,
            timeout=0.5,
            retry_backoff=0.5,
        )
