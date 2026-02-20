"""Balance router — client account balances."""

from fastapi import APIRouter, Depends

from models.models import Client, amount_db_to_human, fmt_amount
from api.webapp.deps import get_current_client
from api.webapp.schemas import BalanceResponse, AccountInfo
from services.balance_service import get_client_accounts, get_available_balance_db_sync

router = APIRouter(prefix="/api/v1", tags=["balance"])


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(client: Client = Depends(get_current_client)):
    """Get all client account balances."""
    accounts = await get_client_accounts(client)

    items = []
    for acc in accounts:
        currency = acc.currency
        balance = amount_db_to_human(acc.amount_db or 0, currency)
        available_db = get_available_balance_db_sync(acc)
        available = amount_db_to_human(available_db, currency)

        items.append(
            AccountInfo(
                id=str(acc.pk),
                currency_code=currency.code,
                currency_symbol=currency.symbol or currency.code,
                balance=fmt_amount(balance),
                available=fmt_amount(available),
                address=acc.address,
            )
        )

    return BalanceResponse(accounts=items)
