"""
YeezyPay Crypto Operations Daemon — периодический опрос YeezyPay API
за операциями крипто-кошельков.

Демон:
1. Запрашивает баланс основного кошелька через crypto_balance_main() (только лог)
2. Загружает все активные Account с address (дочерние кошельки)
3. Для каждого вызывает crypto_operations_list()
4. Обрабатывает новые операции (дедупликация по operation_id)
5. Создаёт Operation(DEPOSIT, CRYPTO) для каждого нового пополнения → fiscal_stream

Движение средств (зачисление на аккаунт, комиссии) — только через FiscalMicroservice.
Демон НЕ обновляет баланс напрямую.
"""

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from base_daemon import PeriodicBaseHandler
from common.nats_utils import AsyncNatsProducer
from models.models import Account, Gate, Operation, operation_log
from models.enums import OperationKind, LogTag
from tortoise import timezone

from gates.impls.yeezypay import YeezyPayGate

logger = logging.getLogger(__name__)

MAX_PROCESSED_IDS = 200

# Типы операций YeezyPay, которые считаем депозитами
DEPOSIT_OP_KINDS = {"deposit", "incoming", "topup", "receive", "credit"}


class CryptoOperationsDaemon(PeriodicBaseHandler):
    """Периодический опрос YeezyPay API за операциями крипто-кошельков.

    Для каждого нового пополнения создаёт Operation(DEPOSIT, CRYPTO)
    и публикует в fiscal_stream для расчёта комиссий.
    """

    name = "CryptoOperationsDaemon"
    with_nats = True
    nats_stream_name = "gates_stream"
    subjects = ["yeezypay_crypto_poll"]

    def __init__(self, period: int = 60):
        super().__init__(period=period)
        self.gate: Optional[YeezyPayGate] = None
        self.gate_model: Optional[Gate] = None

    async def on_start(self):
        """Загрузка Gate из БД и инициализация YeezyPayGate."""
        self.gate_model = await Gate.filter(
            code="yeezypay", status=Gate.Status.ACTIVE
        ).first()

        if not self.gate_model:
            self.logger.error(
                "No active YeezyPay gate found in DB. "
                "Daemon will retry on next iteration."
            )
            return

        credentials = self.gate_model.credentials or {}
        self.gate = YeezyPayGate(credentials=credentials)
        self.logger.info(
            "CryptoOperationsDaemon started with gate #%s, period=%ss",
            self.gate_model.pk,
            self.period,
        )

    async def one_iter(self):
        """Одна итерация: опрос балансов и операций."""
        # Если гейт не загружен — пробуем повторно
        if not self.gate:
            self.logger.warning("Gate not loaded, attempting reload...")
            await self.on_start()
            if not self.gate:
                self.logger.error("Still no gate available, skipping iteration")
                return

        try:
            # 1. Баланс основного кошелька
            await self._sync_main_wallet_balance()
        except Exception:
            self.logger.exception("Failed to sync main wallet balance")

        try:
            # 2. Опрос операций по дочерним кошелькам
            await self._sync_child_wallets()
        except Exception:
            self.logger.exception("Failed to sync child wallets")

    # ── Основной кошелёк ─────────────────────────────────

    async def _sync_main_wallet_balance(self):
        """Запрашивает баланс основного кошелька и логирует его."""
        result = await self.gate.crypto_balance_main()
        self.logger.info("Main wallet balance response: %r", result)

        # Результат: {"success": true, "data": {"balance": "123.45", ...}}
        data = result.get("data") or result
        balance_str = data.get("balance")

        if balance_str is not None:
            self.logger.info("Main wallet balance: %s", balance_str)
        else:
            self.logger.warning("No balance in main wallet response: %r", result)

    # ── Дочерние кошельки ────────────────────────────────

    async def _sync_child_wallets(self):
        """Загружает все Account с external_id и обновляет их операции."""
        # Ищем все аккаунты с external_id (wallet_id на стороне YeezyPay).
        # external_id стабилен, address может перегенерироваться.
        accounts = await Account.filter(
            external_id__isnull=False,
            status__in=[
                Account.Status.ACTIVE,
                Account.Status.RESTORED,
            ],
        ).prefetch_related("currency")

        if not accounts:
            self.logger.info("No active crypto accounts found, skipping")
            return

        self.logger.info("Found %d active crypto accounts to sync", len(accounts))

        for account in accounts:
            try:
                await self._sync_account(account)
            except Exception:
                self.logger.exception(
                    "Failed to sync account %s (address=%s)",
                    account.pk,
                    account.address,
                )

    async def _sync_account(self, account: Account):
        """Синхронизирует один аккаунт: опрашивает операции из YeezyPay API.

        Баланс НЕ обновляется напрямую — только через fiscal.
        Запросы делаем по wallet_id (external_id) — он стабилен,
        в отличие от address, который YeezyPay может перегенерировать.
        """
        wallet_id = account.external_id

        if not wallet_id:
            self.logger.warning(
                "Account %s has no external_id (wallet_id), skipping sync",
                account.pk,
            )
            return

        # 1. Проверяем актуальность wallet info (адрес может смениться)
        try:
            await self._sync_wallet_info(account, wallet_id)
            # Перечитываем account — адрес мог обновиться
            account = await Account.get(pk=account.pk).prefetch_related(
                "currency", "client"
            )
        except Exception:
            self.logger.exception(
                "Failed to sync wallet info for account %s", account.pk
            )

        # 2. Запрашиваем список операций — именно из них создаём депозиты
        try:
            ops_result = await self.gate.crypto_operations_list(
                wallet_id=wallet_id,
                page=1,
                page_size=50,
            )
            await self._process_operations(account, ops_result)
        except Exception:
            self.logger.exception("Failed to get operations for account %s", account.pk)

    async def _sync_wallet_info(self, account: Account, wallet_id: str):
        """Запрашивает crypto_wallet_info и обновляет адрес если он изменился."""
        result = await self.gate.crypto_wallet_info(wallet_id=wallet_id)

        wallet_data = result.get("data") or result
        new_address = wallet_data.get("wallet_address") or wallet_data.get("address")

        if not new_address:
            return

        old_address = account.address

        if new_address == old_address:
            return

        # Адрес изменился — обновляем
        self.logger.warning(
            "Address changed for account %s: %s → %s (wallet_id=%s)",
            account.pk,
            old_address,
            new_address,
            wallet_id,
        )

        await Account.filter(pk=account.pk).update(
            address=new_address,
            external_updated_at=timezone.now(),
        )

        # Уведомляем пользователя
        try:
            from services.notification_service import (
                format_address_changed_notification,
                send_telegram_message,
            )

            await account.fetch_related("client")
            client = account.client
            if client and client.telegram_id:
                text = format_address_changed_notification(
                    old_address or "", new_address
                )
                await send_telegram_message(client.telegram_id, text)
                self.logger.info(
                    "Address change notification sent for account %s", account.pk
                )
        except Exception:
            self.logger.exception(
                "Failed to send address change notification, account=%s",
                account.pk,
            )

    # ── Fiscal: создание Operation + публикация ────────

    def _parse_amount_db(self, amount_str: str, currency) -> int:
        """Конвертирует строковую сумму в amount_db (integer)."""
        amount_decimal = Decimal(str(amount_str))
        denominator = currency.denominator if currency else 2
        return int(
            (amount_decimal * 10**denominator).to_integral_value(rounding=ROUND_HALF_UP)
        )

    async def _create_deposit_and_publish(
        self,
        account: Account,
        amount_db: int,
        external_id: str,
        source_payload: dict,
    ) -> Optional[Operation]:
        """Создаёт Operation(DEPOSIT, CRYPTO) и публикует в fiscal_stream.

        Дедупликация по Operation.external_id — если операция с таким ID
        уже существует, возвращает None.
        """
        if not external_id:
            self.logger.warning(
                "Cannot create deposit without external_id for account %s",
                account.pk,
            )
            return None

        # Дедупликация: проверяем, нет ли уже Operation с таким external_id
        existing = await Operation.filter(
            external_id=external_id,
            kind=OperationKind.DEPOSIT,
        ).first()

        # Также ищем по tx_hash из source_payload (YeezyPay может использовать
        # свой operation_id, отличный от blockchain tx_hash)
        if not existing and source_payload.get("tx_hash"):
            tx_hash = str(source_payload["tx_hash"])
            if tx_hash != external_id:
                existing = await Operation.filter(
                    external_id=tx_hash,
                    kind=OperationKind.DEPOSIT,
                ).first()

        if existing and existing.status == Operation.Status.PENDING:
            # Промоутим PENDING операцию (от TronGrid) → OPERATING
            self.logger.info(
                "Promoting PENDING deposit: operation=%s, external_id=%s → OPERATING",
                existing.pk,
                external_id,
            )
            # Мержим data: сохраняем trongrid данные + добавляем crypto_poll данные
            existing_data = existing.data or {}
            if not isinstance(existing_data, dict):
                existing_data = {}
            existing_data["source"] = "crypto_poll"
            existing_data["trongrid_promoted"] = True
            existing_data["source_payload"] = source_payload

            await Operation.filter(pk=existing.pk).update(
                status=Operation.Status.OPERATING,
                operating_at=timezone.now(),
                amount_db=amount_db,
                gate=self.gate_model,
                data=existing_data,
            )
            await operation_log(
                existing.pk,
                LogTag.PROMOTED,
                f"PENDING→OPERATING via crypto_poll, amount_db={amount_db}",
            )
            await existing.refresh_from_db()
            await self._publish_to_fiscal(existing)
            return existing

        if existing:
            self.logger.info(
                "Deposit operation already exists: external_id=%s, operation=%s, status=%s",
                external_id,
                existing.pk,
                existing.status,
            )
            return None

        if amount_db <= 0:
            self.logger.warning(
                "Invalid deposit amount_db=%s for account %s, skipping",
                amount_db,
                account.pk,
            )
            return None

        # Загружаем связанные объекты
        await account.fetch_related("client", "currency")

        operation = await Operation.create(
            client=account.client,
            account=account,
            currency=account.currency,
            kind=OperationKind.DEPOSIT,
            method=Operation.Method.CRYPTO,
            status=Operation.Status.OPERATING,
            amount_db=amount_db,
            external_id=external_id,
            gate=self.gate_model,
            data={
                "amount": amount_db,
                "source": "crypto_poll",
                "source_payload": source_payload,
            },
        )
        await operation_log(
            operation.pk,
            LogTag.CREATE,
            f"DEPOSIT created via crypto_poll, amount_db={amount_db}",
        )

        self.logger.info(
            "Created DEPOSIT operation #%s: account=%s, amount_db=%s, external_id=%s",
            operation.pk,
            account.pk,
            amount_db,
            external_id,
        )

        # Публикуем в fiscal_stream
        await self._publish_to_fiscal(operation)

        return operation

    async def _publish_to_fiscal(self, operation: Operation) -> None:
        """Публикует Operation в fiscal_stream для обработки FiscalMicroservice."""
        await operation_log(
            operation.pk, LogTag.TO_FISCAL, "Published to fiscal_stream"
        )
        await operation.refresh_from_db()
        op_data = operation.data or {}
        payload = op_data if isinstance(op_data, dict) else {}
        payload["gate"] = {
            "code": "yeezypay",
            "result": {},
        }

        message = {
            "operation_guid": str(operation.pk),
            "payload": payload,
        }

        fiscal_producer = AsyncNatsProducer(
            subjects=["item"], stream_name="fiscal_stream"
        )
        try:
            await fiscal_producer.connect()
            await fiscal_producer.publish("item", message)
            self.logger.info(
                "Published DEPOSIT operation #%s to fiscal_stream",
                operation.pk,
            )
        finally:
            await fiscal_producer.close()

    # ── Обработка операций ─────────────────────────────

    def _is_deposit_operation(self, op: dict) -> bool:
        """Определяет, является ли операция от API депозитом (пополнением)."""
        op_kind = (op.get("kind") or op.get("type") or "").lower()
        return op_kind in DEPOSIT_OP_KINDS

    async def _process_operations(self, account: Account, ops_result: dict):
        """Обрабатывает список операций: создаёт Operation(DEPOSIT) для новых
        пополнений и публикует в fiscal_stream.
        """
        # Формат: {"success": true, "data": {"operations": [...], ...}}
        data = ops_result.get("data") or ops_result
        operations = data.get("operations") or data.get("items") or []

        if not operations:
            self.logger.debug("No operations for account %s", account.pk)
            return

        # Загружаем актуальные данные (могли обновиться в _update_balance_from_info)
        account = await Account.get(pk=account.pk).prefetch_related(
            "currency", "client"
        )
        account_data = dict(account.data) if account.data else {}
        processed = set(account_data.get("processed_operations", []))

        new_ops_count = 0
        new_ids = []

        for op in operations:
            op_id = str(op.get("id") or op.get("operation_id") or "")
            if not op_id or op_id in processed:
                continue

            # Новая операция!
            new_ops_count += 1
            new_ids.append(op_id)

            op_kind = op.get("kind") or op.get("type") or "unknown"
            op_amount = op.get("amount") or op.get("value") or "?"
            op_status = op.get("status") or "?"

            self.logger.info(
                "New operation for account %s: id=%s, kind=%s, amount=%s, status=%s",
                account.pk,
                op_id,
                op_kind,
                op_amount,
                op_status,
            )

            # Создаём Operation(DEPOSIT) для пополнений
            if self._is_deposit_operation(op):
                amount_str = str(op.get("amount") or op.get("value") or "0")
                try:
                    deposit_amount_db = self._parse_amount_db(
                        amount_str, account.currency
                    )
                    await self._create_deposit_and_publish(
                        account=account,
                        amount_db=deposit_amount_db,
                        external_id=op_id,
                        source_payload=op,
                    )
                except Exception:
                    self.logger.exception(
                        "Failed to create deposit operation: account=%s, op_id=%s",
                        account.pk,
                        op_id,
                    )

        if new_ids:
            # Обновляем список обработанных операций
            # Перечитываем account_data (могло обновиться в _create_deposit_and_publish)
            account = await Account.get(pk=account.pk)
            account_data = dict(account.data) if account.data else {}
            existing_processed = account_data.get("processed_operations", [])

            all_processed = existing_processed + [
                oid for oid in new_ids if oid not in existing_processed
            ]
            if len(all_processed) > MAX_PROCESSED_IDS:
                all_processed = all_processed[-MAX_PROCESSED_IDS:]

            account_data["processed_operations"] = all_processed
            account_data["last_poll"] = {
                "timestamp": str(timezone.now()),
                "new_operations_count": new_ops_count,
                "total_operations_in_response": len(operations),
            }

            await Account.filter(pk=account.pk).update(data=account_data)

            self.logger.info(
                "Processed %d new operations for account %s (%d deposits)",
                new_ops_count,
                account.pk,
                sum(
                    1
                    for op in operations
                    if str(op.get("id") or op.get("operation_id") or "") in new_ids
                    and self._is_deposit_operation(op)
                ),
            )
