"""
NotificationDaemon — периодический демон для отправки уведомлений
о завершённых операциях клиентам через Telegram.

Поллит Operation(status=COMPLETE) без флага notified и отправляет
Telegram-сообщения через Bot API.
"""

import logging
from typing import Optional

from base_daemon import PeriodicBaseHandler
from models.models import Operation
from models.enums import OperationKind
from services.notification_service import notify_operation

logger = logging.getLogger(__name__)

# Типы операций, по которым отправляем уведомления
NOTIFIABLE_KINDS = {
    OperationKind.DEPOSIT,
    OperationKind.CARD_OPEN,
    OperationKind.CARD_TOPUP,
    OperationKind.CARD_CLOSE,
    OperationKind.CARD_BLOCK,
    OperationKind.CARD_RESTORE,
}


class NotificationDaemon(PeriodicBaseHandler):
    """Периодически ищет завершённые операции и отправляет уведомления в Telegram."""

    name = "NotificationDaemon"
    with_nats = False  # Не нужен NATS — работаем напрямую с БД и HTTP

    def __init__(self, period: int = 15):
        super().__init__(period=period)

    async def on_start(self):
        self.logger.info("NotificationDaemon started with period=%ss", self.period)

    async def one_iter(self):
        """Одна итерация: находим неотправленные уведомления и отправляем."""
        try:
            await self._process_pending_notifications()
        except Exception:
            self.logger.exception("Error in notification iteration")

    async def _process_pending_notifications(self):
        """Ищет завершённые операции без уведомления и отправляет их."""
        # Ищем COMPLETE и FAILED операции, которые:
        # 1. Относятся к типам, по которым нужны уведомления
        # 2. Ещё не были отправлены (data не содержит notified=True)
        #
        # Так как JSONField не поддерживает фильтрацию по вложенным ключам
        # в Tortoise ORM, получаем все и фильтруем в Python.
        operations = (
            await Operation.filter(
                status__in=[Operation.Status.COMPLETE, Operation.Status.FAILED],
                kind__in=[k.value for k in NOTIFIABLE_KINDS],
            )
            .prefetch_related("client", "account", "currency")
            .order_by("done_at")
            .limit(50)
        )

        if not operations:
            return

        notified_count = 0
        for operation in operations:
            # Проверяем флаг notified в data
            op_data = operation.data or {}
            if not isinstance(op_data, dict):
                continue
            if op_data.get("notified"):
                continue

            # Проверяем что клиент имеет telegram_id
            if not operation.client or not operation.client.telegram_id:
                # Помечаем как notified чтобы не обрабатывать повторно
                await self._mark_notified(operation)
                continue

            # Отправляем уведомление
            success = await notify_operation(operation)

            if success:
                notified_count += 1
                self.logger.info(
                    "Notification sent: operation=%s, kind=%s, client=%s",
                    operation.pk,
                    operation.kind,
                    operation.client.telegram_id,
                )

            # Помечаем как notified в любом случае (чтобы не спамить при ошибках)
            await self._mark_notified(operation)

        if notified_count:
            self.logger.info("Sent %d notifications in this iteration", notified_count)

    async def _mark_notified(self, operation: Operation) -> None:
        """Помечает операцию как notified в data."""
        op_data = operation.data or {}
        if not isinstance(op_data, dict):
            op_data = {}
        op_data["notified"] = True

        await Operation.filter(pk=operation.pk).update(data=op_data)
