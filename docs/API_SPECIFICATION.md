# StockSentinel — API Specification

This document provides detailed API specifications for the StockSentinel platform. The backend service runs on FastAPI at port `8000` by default.

## 1. Authentication Endpoints

All endpoints except `/auth/register` and `/auth/login` require an `Authorization` header containing the user's JWT access token:
`Authorization: Bearer <access_token>`

### Register Account
* **URL:** `/auth/register`
* **Method:** `POST`
* **Payload:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword",
    "name": "Jane Doe"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "message": "User registered successfully"
  }
  ```

### Log In / Get Token
* **URL:** `/auth/login`
* **Method:** `POST`
* **Payload:**
  ```json
  {
    "username": "user@example.com",
    "password": "securepassword"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "token_type": "bearer"
  }
  ```

### Refresh Token
* **URL:** `/auth/refresh`
* **Method:** `POST`
* **Payload:**
  ```json
  {
    "refresh_token": "eyJhbGciOi..."
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "token_type": "bearer"
  }
  ```


## 2. User Profile & Portfolio Endpoints

### Get Current User Profile (with Live Valuations)
* **URL:** `/user/me`
* **Method:** `GET`
* **Success Response (200 OK):**
  ```json
  {
    "id": "60c72b2f9b1d8e256c8b4567",
    "email": "user@example.com",
    "name": "Jane Doe",
    "telegram_linked": true,
    "portfolio": [
      {
        "ticker": "RELIANCE",
        "exchange": "NSE",
        "buy_price": 2400.00,
        "quantity": 10,
        "buy_date": "2024-01-15",
        "notes": "Long term hold",
        "sector": "Energy",
        "industry": "Oil & Gas",
        "stock_pe": 28.4,
        "roe": 9.1,
        "roce": 10.8,
        "high": 2470.00,
        "low": 2410.00,
        "current_price": 2450.00,
        "pnl": 500.00,
        "pnl_percent": 2.08
      }
    ]
  }
  ```

### Add Asset to Portfolio
* **URL:** `/user/portfolio`
* **Method:** `POST`
* **Payload:**
  ```json
  {
    "ticker": "RELIANCE",
    "exchange": "NSE",
    "buy_price": 2400.00,
    "quantity": 10,
    "buy_date": "2024-01-15",
    "notes": "Long term hold"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "message": "RELIANCE added to portfolio"
  }
  ```

### Remove Asset from Portfolio
* **URL:** `/user/portfolio/{ticker}`
* **Method:** `DELETE`
* **Success Response (200 OK):**
  ```json
  {
    "message": "RELIANCE removed from portfolio"
  }
  ```

### Get Portfolio Performance timeline & Risk Audit
* **URL:** `/user/portfolio/performance`
* **Method:** `GET`
* **Success Response (200 OK):**
  ```json
  {
    "timeline": [
      {
        "date": "2026-06-11",
        "portfolio_value": 24500.00,
        "portfolio_return": 2.08,
        "nifty_return": 1.25,
        "cost_basis": 24000.00
      }
    ],
    "risk": {
      "beta": 1.05,
      "var_95": 450.00,
      "volatility": 18.5,
      "concentration_score": 75
    },
    "audit": {
      "weighted_pe": 28.4,
      "weighted_roe": 9.1,
      "est_annual_dividend": 88.00
    }
  }
  ```


## 3. Stock Metadata & Search Endpoints

### Get Stock Fundamental & Technical Indicators
* **URL:** `/stock/{ticker}`
* **Method:** `GET`
* **Success Response (200 OK):**
  ```json
  {
    "ticker": "RELIANCE",
    "exchange": "NSE",
    "current_price": 2450.00,
    "previous_close": 2430.00,
    "market_cap": 1658000.00,
    "high": 2470.00,
    "low": 2410.00,
    "stock_pe": 28.4,
    "dividend_yield": 0.36,
    "roce": 10.8,
    "roe": 9.1,
    "face_value": 10.0,
    "last_updated": "2026-06-17T15:30:00Z",
    "from_cache": true,
    "rsi": 58.2,
    "rsi_signal": "Neutral",
    "sma_50": 2415.50,
    "sma_50_signal": "Bullish"
  }
  ```

### Fuzzy Search Tickers
* **URL:** `/stock/search`
* **Method:** `GET`
* **Query Params:** `q` (search query prefix)
* **Success Response (200 OK):**
  ```json
  [
    {
      "ticker": "RELIANCE",
      "company_name": "Reliance Industries Limited",
      "current_price": 2450.00,
      "exchange": "NSE"
    }
  ]
  ```


## 4. Alert System Endpoints

### Create Price-Level Alert
* **URL:** `/alerts`
* **Method:** `POST`
* **Payload:**
  ```json
  {
    "ticker": "RELIANCE",
    "exchange": "NSE",
    "buy_price": 2400.00,
    "target_price": 2550.00,
    "stop_loss": 2350.00,
    "note": "Alert at key ranges"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "message": "Alert set successfully for RELIANCE"
  }
  ```

### Get Active & Historical Alerts
* **URL:** `/alerts`
* **Method:** `GET`
* **Success Response (200 OK):**
  ```json
  [
    {
      "id": "60c72b2f9b1d8e256c8b9999",
      "ticker": "RELIANCE",
      "exchange": "NSE",
      "buy_price": 2400.00,
      "target_price": 2550.00,
      "stop_loss": 2350.00,
      "note": "Alert at key ranges",
      "is_active": true,
      "triggered_at": null,
      "created_at": "2026-06-17T10:00:00Z"
    }
  ]
  ```

### Delete Alert
* **URL:** `/alerts/{id}`
* **Method:** `DELETE`
* **Success Response (200 OK):**
  ```json
  {
    "message": "Alert deleted successfully"
  }
  ```


## 5. WebSockets Live Data Channel

### Connect Live Price Feed
* **URL:** `/ws/prices`
* **Protocol:** `WS`
* **Format:** JSON messages
* **Incoming Client Command (Subscribe to symbols):**
  ```json
  {
    "action": "subscribe",
    "tickers": ["RELIANCE", "TCS", "INFY"]
  }
  ```
* **Outgoing Server Broadcast (Every 2–5 seconds):**
  ```json
  {
    "ticker": "RELIANCE",
    "price": 2452.45,
    "timestamp": "2026-06-17T15:53:50Z"
  }
  ```


## 6. Market Intelligence Endpoints

All endpoints require JWT Bearer authentication headers.

### Get Global Markets Overview
* **URL:** `/intel/markets`
* **Method:** `GET`
* **Success Response (200 OK):** Returns grouped list of indices, commodities, forex, and cryptocurrency assets (including ticker, name, price, change, change_pct, and sparkline arrays).

### Get Sector Rotation Momentum
* **URL:** `/intel/sectors`
* **Method:** `GET`
* **Success Response (200 OK):** Returns benchmark 1-month change, sector relative strength matrices, and quadrant mappings (Leading, Improving, Lagging, Weakening).

### Get Economic Calendar
* **URL:** `/intel/calendar/economic`
* **Method:** `GET`
* **Success Response (200 OK):** Returns upcoming economic events (inflation rate decisions, GDP growth estimates, non-farm payroll releases).

### Get Corporate actions Calendar
* **URL:** `/intel/calendar/corporate`
* **Method:** `GET`
* **Success Response (200 OK):** Returns corporate earnings dates, stock splits, dividends, and corporate actions filtered for the user's watchlist tickers.

### Get Insider Trading Records
* **URL:** `/intel/insiders`
* **Method:** `GET`
* **Success Response (200 OK):** Returns insider buying/selling transactions for user's watchlist tickers.

### Get AI News Intelligence
* **URL:** `/intel/news`
* **Method:** `GET`
* **Success Response (200 OK):** Returns Llama-3 parsed news event clusters, sentiment tags (Bullish/Bearish/Neutral), and estimated market impact scores.

### Get Daily Briefing Feed
* **URL:** `/intel/briefing`
* **Method:** `GET`
* **Success Response (200 OK):** Returns high-level terminal market briefing context.

### Get Treasury Yield Curve Rates
* **URL:** `/intel/yields`
* **Method:** `GET`
* **Success Response (200 OK):** Returns sovereign bond yield curve data (1-month, 3-month, 1-year, 5-year, 10-year yields).

### Get Block Deals Ledger
* **URL:** `/intel/blockdeals`
* **Method:** `GET`
* **Success Response (200 OK):** Returns bulk block deals executed on exchanges for user's watchlist.
