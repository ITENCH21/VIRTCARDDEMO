"""
Pydantic v1 schemas for WebApp API.

All amounts are strings (converted via amount_db_to_human).
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# ── Auth ─────────────────────────────────────────────────


class TelegramWebAppAuth(BaseModel):
    init_data: str

    class Config:
        schema_extra = {"example": {"init_data": "query_id=...&user=...&hash=..."}}


class TelegramLoginAuth(BaseModel):
    id: int
    first_name: str = ""
    last_name: str = ""
    username: str = ""
    photo_url: str = ""
    auth_date: int
    hash: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ClientInfo(BaseModel):
    id: str
    name: str
    telegram_username: Optional[str]

    class Config:
        orm_mode = True


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    client: ClientInfo


# ── Cards ────────────────────────────────────────────────


class CardResponse(BaseModel):
    id: str
    name: str
    last4: str
    status: str
    balance: str
    currency_code: str
    currency_symbol: str


class CardSensitiveResponse(BaseModel):
    card_number: str
    cvv: str
    expiry_month: str
    expiry_year: str


class EstimateRequest(BaseModel):
    amount: str


class EstimateResponse(BaseModel):
    amount: str
    fee: str
    total: str
    currency_symbol: str


class IssueCardRequest(BaseModel):
    amount: str
    card_name: str = ""


class TopupCardRequest(BaseModel):
    amount: str


class OperationCreatedResponse(BaseModel):
    operation_id: str
    status: str


# ── Withdraw ─────────────────────────────────────────────


class WithdrawEstimateRequest(BaseModel):
    amount: str


class WithdrawEstimateResponse(BaseModel):
    amount: str
    fee: str
    total: str
    currency_symbol: str
    fee_percent: str
    fee_fixed: str
    fee_minimal: str


class WithdrawRequest(BaseModel):
    amount: str
    address: str


# ── Balance ──────────────────────────────────────────────


class AccountInfo(BaseModel):
    id: str
    currency_code: str
    currency_symbol: str
    balance: str
    available: str
    address: Optional[str]


class BalanceResponse(BaseModel):
    accounts: List[AccountInfo]


# ── Deposit ──────────────────────────────────────────────


class DepositResponse(BaseModel):
    address: Optional[str]
    currency_code: str
    qr_data: Optional[str]


# ── Operations ───────────────────────────────────────────


class OperationResponse(BaseModel):
    id: str
    kind: str
    kind_label: str
    status: str
    amount: str
    currency_symbol: str
    created_at: datetime


class OperationStatusResponse(BaseModel):
    id: str
    status: str


class OperationListResponse(BaseModel):
    items: List[OperationResponse]
    total: int


# ── Profile ──────────────────────────────────────────────


class ProfileResponse(BaseModel):
    name: str
    email: Optional[str]
    phone: Optional[str]
    telegram_username: Optional[str]


class ProfileUpdateRequest(BaseModel):
    name: Optional[str]
    email: Optional[str]
    phone: Optional[str]

    class Config:
        # Allow partial updates
        extra = "forbid"
