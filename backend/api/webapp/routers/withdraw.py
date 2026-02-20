"""Withdraw router — estimate and create USDT withdrawal."""

from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException

from models.models import Client, fmt_amount
from api.webapp.deps import get_current_client
from api.webapp.schemas import (
    WithdrawEstimateRequest,
    WithdrawEstimateResponse,
    WithdrawRequest,
    OperationCreatedResponse,
)
from services.withdraw_service import (
    estimate_withdraw,
    create_withdraw,
    WithdrawServiceError,
    InsufficientFundsError,
    NoTarifError,
    AccountNotFoundError,
    InvalidAddressError,
    SelfAddressError,
)

router = APIRouter(prefix="/api/v1/withdraw", tags=["withdraw"])


def _enum_to_str(val) -> str:
    return str(val.value) if hasattr(val, "value") else str(val)


def _handle_error(e: WithdrawServiceError):
    if isinstance(e, InsufficientFundsError):
        raise HTTPException(status_code=400, detail=str(e))
    if isinstance(e, NoTarifError):
        raise HTTPException(status_code=400, detail=str(e))
    if isinstance(e, AccountNotFoundError):
        raise HTTPException(status_code=400, detail=str(e))
    if isinstance(e, InvalidAddressError):
        raise HTTPException(status_code=400, detail=str(e))
    if isinstance(e, SelfAddressError):
        raise HTTPException(status_code=400, detail=str(e))
    raise HTTPException(status_code=500, detail="Withdraw service error")


@router.post("/estimate", response_model=WithdrawEstimateResponse)
async def estimate(
    body: WithdrawEstimateRequest,
    client: Client = Depends(get_current_client),
):
    """Estimate withdrawal cost (amount + fee)."""
    try:
        amount = Decimal(body.amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="Invalid amount")

    try:
        est = await estimate_withdraw(client, amount)
    except WithdrawServiceError as e:
        _handle_error(e)

    symbol = est["currency"].symbol or est["currency"].code
    tarif = est["tarif_info"]
    return WithdrawEstimateResponse(
        amount=fmt_amount(est["amount"]),
        fee=fmt_amount(est["fee"]),
        total=fmt_amount(est["total"]),
        currency_symbol=symbol,
        fee_percent=fmt_amount(tarif["fee_percent"]),
        fee_fixed=fmt_amount(tarif["fee_fixed"]),
        fee_minimal=fmt_amount(tarif["fee_minimal"]),
    )


@router.post("", response_model=OperationCreatedResponse)
async def create(
    body: WithdrawRequest,
    client: Client = Depends(get_current_client),
):
    """Create a USDT withdrawal operation."""
    try:
        amount = Decimal(body.amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="Invalid amount")

    try:
        operation = await create_withdraw(client, amount, address=body.address)
    except WithdrawServiceError as e:
        _handle_error(e)

    return OperationCreatedResponse(
        operation_id=str(operation.pk),
        status=_enum_to_str(operation.status),
    )
