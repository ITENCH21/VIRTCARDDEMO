"""Operations router — history and status polling."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from models.models import Client, Operation, amount_db_to_human, fmt_amount
from models.enums import OperationKind
from api.webapp.deps import get_current_client
from api.webapp.schemas import (
    OperationResponse,
    OperationStatusResponse,
    OperationListResponse,
)

router = APIRouter(prefix="/api/v1/operations", tags=["operations"])

KIND_LABELS = {
    OperationKind.CARD_OPEN: "Card Issue",
    OperationKind.CARD_UPDATE: "Card Update",
    OperationKind.CARD_TOPUP: "Card Topup",
    OperationKind.CARD_BLOCK: "Card Block",
    OperationKind.CARD_RESTORE: "Card Restore",
    OperationKind.CARD_CLOSE: "Card Close",
    OperationKind.CARD_BANNED: "Card Banned",
    OperationKind.DEPOSIT: "Deposit",
    OperationKind.WITHDRAW: "Withdrawal",
    OperationKind.SERVICE: "Service",
    OperationKind.SYSTEM: "System",
    OperationKind.ADJUSTMENT: "Adjustment",
}


def _operation_to_response(op: Operation) -> OperationResponse:
    currency = op.currency
    if currency and op.amount_db:
        amount = fmt_amount(amount_db_to_human(op.amount_db, currency))
        symbol = currency.symbol or currency.code
    else:
        amount = "0"
        symbol = ""

    kind_str = str(op.kind.value) if hasattr(op.kind, "value") else str(op.kind)
    status_str = str(op.status.value) if hasattr(op.status, "value") else str(op.status)

    return OperationResponse(
        id=str(op.pk),
        kind=kind_str,
        kind_label=KIND_LABELS.get(op.kind, kind_str),
        status=status_str,
        amount=amount,
        currency_symbol=symbol,
        created_at=op.created_at,
    )


@router.get("", response_model=OperationListResponse)
async def list_operations(
    offset: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    kind: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    client: Client = Depends(get_current_client),
):
    """List client operations with pagination and optional filters."""
    qs = Operation.filter(client=client).prefetch_related("currency")
    if kind:
        qs = qs.filter(kind=kind)
    if status:
        qs = qs.filter(status=status)
    total = await qs.count()
    operations = await qs.order_by("-created_at").offset(offset).limit(limit)

    return OperationListResponse(
        items=[_operation_to_response(op) for op in operations],
        total=total,
    )


@router.get("/{operation_id}/status", response_model=OperationStatusResponse)
async def get_operation_status(
    operation_id: str,
    client: Client = Depends(get_current_client),
):
    """Lightweight status check for polling."""
    try:
        op = await Operation.get(pk=operation_id, client=client)
    except Exception:
        raise HTTPException(status_code=404, detail="Operation not found")

    status_str = str(op.status.value) if hasattr(op.status, "value") else str(op.status)
    return OperationStatusResponse(
        id=str(op.pk),
        status=status_str,
    )
