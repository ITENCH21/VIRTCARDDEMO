from base_daemon import BaseHandler
from models.models import (
    Operation,
    Account,
    amount_db_to_human,
)
from models.enums import OperationKind
from models.djangoise import db_transaction
from tortoise import timezone
from tortoise.exceptions import DoesNotExist
from decimal import Decimal
import logging
import os

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

WITH_CACHE = os.getenv("FISCAL_DISABLE_CACHE") not in ["True", "1"]
SECRET_TELEGRAM_GROUP_ID = os.getenv("SECRET_TELEGRAM_GROUP_ID")


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

    async def _get_company_account(self, currency_id) -> Account:
        """Получить компанейский аккаунт для валюты"""
        # Используем строковое представление ID для кеширования
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
        """Снять холд с аккаунта"""
        if not payload.get("holded_amount"):
            return
        if account is None:
            await instance.fetch_related("account")
            account = instance.account
        if account is None:
            self.logger.warning("Account is None for operation %s", instance.pk)
            return
        # В Tortoise ORM нужно обновить напрямую
        holded_amount = payload["holded_amount"]
        current_holded = account.amount_holded_db or 0
        await Account.filter(pk=account.pk).update(
            amount_holded_db=max(0, current_holded - holded_amount)
        )

    @db_transaction()
    async def _atomic_operation_process(
        self, instance: Operation, operation: dict, is_withdraw: bool = False
    ):
        """Атомарная обработка операции"""
        uid = operation["operation_guid"]
        payload = operation["payload"]

        # Проверка на подоперации
        await instance.fetch_related("suboperations")
        suboperations = await Operation.filter(parent_id=instance.pk).all()
        if suboperations and not (
            payload.get("gate", {}).get("code", "").startswith(("c2c", "transfer"))
            and instance.kind in [OperationKind.DEPOSIT, OperationKind.WITHDRAW]
        ):
            # Обработка родительской операции с подоперациями
            manual_status = payload.get("manual_status")

            # Подсчет суммы завершенных подопераций
            sub_amount_db = 0
            for sub_op in suboperations:
                if sub_op.status == Operation.Status.COMPLETE:
                    sub_amount_db += sub_op.amount_db or 0

            self.logger.info(
                "Finalize parent op. (amount=%s, sub_amount_db=%s)",
                instance.amount_db,
                sub_amount_db,
            )

            if sub_amount_db >= (instance.amount_db or 0) or manual_status == "SUCCESS":
                payload["paid_db"] = sub_amount_db
                current_data = instance.data or {}
                current_data.update(payload)
                await Operation.filter(pk=instance.pk).update(
                    status=Operation.Status.COMPLETE,
                    updated_at=timezone.now(),
                    done_at=timezone.now(),
                    data=current_data,
                )
                await self._unhold_amount(instance, payload)
                return None

        amount_db = payload.get("amount", 0)
        gate_amount_db = int(payload.get("gate", {}).get("amount", 0))

        # Загрузка связанных объектов
        await instance.fetch_related("account", "account__parent", "currency")

        # Обработка дочерних аккаунтов для USDT-TRC20
        # account используется для определения целевого аккаунта, но в упрощенной версии
        # мы работаем напрямую с instance.account

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

        if not instance.amount_db:
            await Operation.filter(pk=instance.pk).update(amount_db=amount_db)

        await instance.fetch_related("currency")
        current_data = instance.data or {}
        current_data.update(payload)

        amount = amount_db_to_human(amount_db, instance.currency)
        fee_amount = Decimal(0)
        tarifline = None

        # Получение тарифной линии - упрощенная версия
        # В полной версии здесь должна быть логика получения тарифной линии
        # через методы клиента/аккаунта
        self.logger.info(
            "Processing operation %s, amount_db=%s, is_withdraw=%s",
            instance.pk,
            amount_db,
            is_withdraw,
        )

        fiscal_data = {
            "amount": float(amount),
            "fee_percent": float(tarifline.fee_percent) if tarifline else 0.0,
            "fee_fixed": float(tarifline.fee_fixed) if tarifline else 0.0,
            "fee_amount": float(fee_amount),
        }
        # Обновляем данные операции
        if isinstance(current_data, dict):
            current_data["fiscal"] = fiscal_data
        else:
            current_data = {"fiscal": fiscal_data}

        await Operation.filter(pk=instance.pk).update(
            status=Operation.Status.COMPLETE,
            updated_at=timezone.now(),
            done_at=timezone.now(),
            data=current_data,
        )

        await self._unhold_amount(instance, payload)
        self.logger.info(
            "_atomic_operation_process: Operation #%s set status to COMPLETE (amount_db=%s)",
            uid,
            amount_db,
        )

    async def _operation_process(
        self, instance: Operation, operation: dict, is_withdraw: bool = False
    ) -> None:
        """Обработка операции"""
        await self._atomic_operation_process(
            instance, operation, is_withdraw=is_withdraw
        )

    async def operation_deposit_process(
        self, instance: Operation, operation: dict
    ) -> None:
        """Обработка депозита"""
        await self._operation_process(instance, operation, is_withdraw=False)

    async def operation_withdraw_process(
        self, instance: Operation, operation: dict
    ) -> None:
        """Обработка вывода"""
        await self._operation_process(instance, operation, is_withdraw=True)

    @db_transaction()
    async def operation_adjustment_process(self, instance: Operation, _operation: dict):
        """Обработка корректировки"""
        await instance.fetch_related("account", "account__currency")
        client_account = instance.account
        currency = client_account.currency
        company_account = await self._get_company_account(currency.id)
        amount_db = instance.amount_db or 0

        if amount_db < 0:
            # Списание с клиента
            new_client_amount = max(0, (client_account.amount_db or 0) + amount_db)
            new_company_amount = (company_account.amount_db or 0) - amount_db
            amount_db = -amount_db
        else:
            # Зачисление клиенту
            new_client_amount = (client_account.amount_db or 0) + amount_db
            new_company_amount = (company_account.amount_db or 0) - amount_db

        await Account.filter(pk=client_account.pk).update(amount_db=new_client_amount)
        await Account.filter(pk=company_account.pk).update(amount_db=new_company_amount)

        await Operation.filter(pk=instance.pk).update(
            status=Operation.Status.COMPLETE,
            updated_at=timezone.now(),
            done_at=timezone.now(),
        )

        self.logger.info(
            "operation_adjustment_process: Operation #%s set status to COMPLETE (amount_db=%s)",
            instance.pk,
            instance.amount_db,
        )

    async def item_process(self, data: dict):
        """Обработка сообщения из NATS"""
        uid = data.get("operation_guid")
        if not uid:
            self.logger.warning("Operation guid not found in data: %r", data)
            return

        gate = data.get("payload", {}).get("gate")
        if not gate:
            self.logger.warning("Gate not found for operation #%s !", uid)
            return

        self.logger.info("item_process: Transaction operation %r", data)

        try:
            instance = await Operation.get(pk=uid)
        except DoesNotExist:
            self.logger.error("Operation #%s not found", uid)
            return

        # Маппинг типов операций на методы
        # instance.kind может быть строкой или Enum, приводим к строке для сравнения
        kind_value = (
            instance.kind.value
            if hasattr(instance.kind, "value")
            else str(instance.kind)
        )

        kind_to_method = {
            OperationKind.DEPOSIT.value: "operation_deposit_process",
            OperationKind.WITHDRAW.value: "operation_withdraw_process",
            OperationKind.ADJUSTMENT.value: "operation_adjustment_process",
        }

        method_name = kind_to_method.get(kind_value)

        if not method_name or not hasattr(self, method_name):
            self.logger.warning(
                "No handler for operation kind %r [%r]",
                instance.kind,
                uid,
            )
            return

        try:
            method = getattr(self, method_name)
            await method(instance, data)
        except Exception:
            self.logger.exception(
                "Problem with operation [%r] (item_process: %r)", uid, method_name
            )

    async def inner_run(self):
        """Основной цикл обработки сообщений"""
        logger.info("Inner run")
        assert self.nats_consumer is not None
        await self.nats_consumer.consume_forever(
            batch=10,
            timeout=0.5,
            retry_backoff=0.5,
        )
