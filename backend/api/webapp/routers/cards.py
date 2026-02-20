"""Cards router — list, detail, sensitive, estimate, issue, topup, block, restore, close."""

from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.responses import JSONResponse

from models.models import Client, amount_db_to_human, fmt_amount
from api.webapp.deps import get_current_client
from api.webapp.schemas import (
    CardResponse,
    CardSensitiveResponse,
    EstimateRequest,
    EstimateResponse,
    IssueCardRequest,
    TopupCardRequest,
    OperationCreatedResponse,
)
from services.card_service import (
    get_client_cards,
    get_card_by_id,
    get_card_last4,
    estimate_card_open,
    issue_card,
    estimate_card_topup,
    topup_card,
    block_card,
    restore_card,
    close_card,
    CardServiceError,
    InsufficientFundsError,
    CardNotFoundError,
    InvalidCardStatusError,
    NoTarifError,
    AccountNotFoundError,
)

router = APIRouter(prefix="/api/v1/cards", tags=["cards"])


def _enum_to_str(val) -> str:
    return str(val.value) if hasattr(val, "value") else str(val)


def _card_to_response(card) -> CardResponse:
    currency = card.currency
    balance = amount_db_to_human(card.amount_db or 0, currency)
    status_str = (
        str(card.status.value) if hasattr(card.status, "value") else str(card.status)
    )
    return CardResponse(
        id=str(card.pk),
        name=card.name or "Card",
        last4=get_card_last4(card),
        status=status_str,
        balance=fmt_amount(balance),
        currency_code=str(currency.code),
        currency_symbol=str(currency.symbol or currency.code),
    )


def _handle_card_error(e: CardServiceError):
    if isinstance(e, CardNotFoundError):
        raise HTTPException(status_code=404, detail=str(e))
    if isinstance(e, InsufficientFundsError):
        raise HTTPException(status_code=400, detail=str(e))
    if isinstance(e, InvalidCardStatusError):
        raise HTTPException(status_code=400, detail=str(e))
    if isinstance(e, NoTarifError):
        raise HTTPException(status_code=400, detail=str(e))
    if isinstance(e, AccountNotFoundError):
        raise HTTPException(status_code=400, detail=str(e))
    raise HTTPException(status_code=500, detail="Card service error")


@router.get("", response_model=list[CardResponse])
async def list_cards(client: Client = Depends(get_current_client)):
    """List all client's virtual cards."""
    cards = await get_client_cards(client)
    return [_card_to_response(c) for c in cards]


@router.get("/{card_id}", response_model=CardResponse)
async def get_card(card_id: str, client: Client = Depends(get_current_client)):
    """Get card details."""
    try:
        card = await get_card_by_id(client, card_id)
    except CardServiceError as e:
        _handle_card_error(e)
    return _card_to_response(card)


@router.get("/{card_id}/sensitive", response_model=CardSensitiveResponse)
async def get_card_sensitive(
    card_id: str, client: Client = Depends(get_current_client)
):
    """Get card PAN/CVV/expiry. Rate-limited, no-cache."""
    try:
        card = await get_card_by_id(client, card_id)
    except CardServiceError as e:
        _handle_card_error(e)

    creds = card.credentials or {}
    response = JSONResponse(
        content=CardSensitiveResponse(
            card_number=creds.get("card_number", ""),
            cvv=creds.get("cvv", ""),
            expiry_month=str(creds.get("expiry_month", "")),
            expiry_year=str(creds.get("expiry_year", "")),
        ).dict(),
        headers={"Cache-Control": "no-store"},
    )
    return response


@router.post("/estimate", response_model=EstimateResponse)
async def estimate_issue(
    body: EstimateRequest,
    client: Client = Depends(get_current_client),
):
    """Estimate card issuance cost (amount + fee)."""
    try:
        amount = Decimal(body.amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="Invalid amount")

    try:
        est = await estimate_card_open(client, amount)
    except CardServiceError as e:
        _handle_card_error(e)

    symbol = est["currency"].symbol or est["currency"].code
    return EstimateResponse(
        amount=fmt_amount(est["amount"]),
        fee=fmt_amount(est["fee"]),
        total=fmt_amount(est["total"]),
        currency_symbol=symbol,
    )


@router.post("/issue", response_model=OperationCreatedResponse)
async def issue_new_card(
    body: IssueCardRequest,
    client: Client = Depends(get_current_client),
):
    """Issue a new virtual card."""
    try:
        amount = Decimal(body.amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="Invalid amount")

    try:
        operation = await issue_card(client, amount, card_name=body.card_name)
    except CardServiceError as e:
        _handle_card_error(e)

    return OperationCreatedResponse(
        operation_id=str(operation.pk),
        status=_enum_to_str(operation.status),
    )


@router.post("/{card_id}/estimate-topup", response_model=EstimateResponse)
async def estimate_topup(
    card_id: str,
    body: EstimateRequest,
    client: Client = Depends(get_current_client),
):
    """Estimate card topup cost."""
    try:
        amount = Decimal(body.amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="Invalid amount")

    try:
        est = await estimate_card_topup(client, card_id, amount)
    except CardServiceError as e:
        _handle_card_error(e)

    symbol = est["currency"].symbol or est["currency"].code
    return EstimateResponse(
        amount=fmt_amount(est["amount"]),
        fee=fmt_amount(est["fee"]),
        total=fmt_amount(est["total"]),
        currency_symbol=symbol,
    )


@router.post("/{card_id}/topup", response_model=OperationCreatedResponse)
async def topup_existing_card(
    card_id: str,
    body: TopupCardRequest,
    client: Client = Depends(get_current_client),
):
    """Topup an existing virtual card."""
    try:
        amount = Decimal(body.amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="Invalid amount")

    try:
        operation = await topup_card(client, card_id, amount)
    except CardServiceError as e:
        _handle_card_error(e)

    return OperationCreatedResponse(
        operation_id=str(operation.pk),
        status=_enum_to_str(operation.status),
    )


@router.post("/{card_id}/block", response_model=OperationCreatedResponse)
async def block_existing_card(
    card_id: str,
    client: Client = Depends(get_current_client),
):
    """Block a virtual card."""
    try:
        operation = await block_card(client, card_id)
    except CardServiceError as e:
        _handle_card_error(e)

    return OperationCreatedResponse(
        operation_id=str(operation.pk),
        status=_enum_to_str(operation.status),
    )


@router.post("/{card_id}/restore", response_model=OperationCreatedResponse)
async def restore_existing_card(
    card_id: str,
    client: Client = Depends(get_current_client),
):
    """Restore a blocked virtual card."""
    try:
        operation = await restore_card(client, card_id)
    except CardServiceError as e:
        _handle_card_error(e)

    return OperationCreatedResponse(
        operation_id=str(operation.pk),
        status=_enum_to_str(operation.status),
    )


@router.post("/{card_id}/close", response_model=OperationCreatedResponse)
async def close_existing_card(
    card_id: str,
    client: Client = Depends(get_current_client),
):
    """Close a virtual card (refund remaining balance)."""
    try:
        operation = await close_card(client, card_id)
    except CardServiceError as e:
        _handle_card_error(e)

    return OperationCreatedResponse(
        operation_id=str(operation.pk),
        status=_enum_to_str(operation.status),
    )
