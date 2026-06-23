from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# ── Auth ──────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

# ── Portfolio ─────────────────────────────────────────────
class PortfolioEntry(BaseModel):
    ticker: str
    exchange: str = "NSE"
    buy_price: float
    quantity: float
    buy_date: Optional[str] = None
    notes: Optional[str] = None

class PortfolioEntryOut(PortfolioEntry):
    current_price: Optional[float] = None
    pnl: Optional[float] = None
    pnl_percent: Optional[float] = None

class TelegramLinkRequest(BaseModel):
    chat_id: str

# ── Stock ─────────────────────────────────────────────────
class StockData(BaseModel):
    ticker: str
    exchange: str
    current_price: Optional[float]
    previous_close: Optional[float]
    market_cap: Optional[float]
    high: Optional[float]
    low: Optional[float]
    stock_pe: Optional[float]
    dividend_yield: Optional[float]
    roce: Optional[float]
    roe: Optional[float]
    face_value: Optional[float]
    last_updated: Optional[datetime] = None

# ── Alerts ────────────────────────────────────────────────
class AlertCreate(BaseModel):
    ticker: str
    exchange: str = "NSE"
    alert_type: str = "price"  # "price" | "volume" | "news" | "sentiment"
    condition: Optional[str] = None  # "above" | "below" | "contains" | "equals"
    value: Optional[str] = None  # target value or keyword
    buy_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    note: Optional[str] = None

class AlertOut(AlertCreate):
    id: str
    is_active: bool
    triggered_at: Optional[datetime] = None
    created_at: datetime

# ── User ──────────────────────────────────────────────────
class UserOut(BaseModel):
    id: str
    email: str
    name: str
    telegram_linked: bool
    portfolio: List[PortfolioEntry] = []
