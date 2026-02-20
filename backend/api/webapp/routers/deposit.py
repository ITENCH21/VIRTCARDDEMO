"""Deposit router — crypto deposit address."""

from fastapi import APIRouter, Depends

from models.models import Client
from api.webapp.deps import get_current_client
from api.webapp.schemas import DepositResponse
from services.balance_service import get_crypto_account

router = APIRouter(prefix="/api/v1", tags=["deposit"])


@router.get("/deposit", response_model=DepositResponse)
async def get_deposit_info(client: Client = Depends(get_current_client)):
    """Get crypto deposit address for QR generation."""
    account = await get_crypto_account(client)

    if not account:
        return DepositResponse(
            address=None,
            currency_code="USDT-TRC20",
            qr_data=None,
        )

    address = account.address
    return DepositResponse(
        address=address,
        currency_code=account.currency.code,
        qr_data=address,
    )
