# StockSentinel — Information Architecture

This document defines the storage layers, data relationships, cache keys, and application routing hierarchies that compose the StockSentinel platform.


## 1. Database Schema (MongoDB)

StockSentinel uses MongoDB for persistent store. The default database is `stocksentineldb`.

### Collection: `users`
Stores user profile information, authentication hashes, and their personal holdings.
* **Fields:**
  * `_id` (`ObjectId`): Unique identifier.
  * `email` (`string`): Unique user email.
  * `password_hash` (`string`): Bcrypt hash of password.
  * `name` (`string`): User display name.
  * `telegram_chat_id` (`string | null`): Connected Telegram chat ID for alert notifications.
  * `created_at` (`ISODate`): Timestamp of registration.
  * `portfolio` (`array` of objects):
    * `ticker` (`string`): Stock symbol (e.g., `"RELIANCE"`).
    * `exchange` (`string`): Stock exchange (e.g., `"NSE"`).
    * `buy_price` (`double`): Cost basis per share.
    * `quantity` (`int`): Number of shares held.
    * `buy_date` (`string`): YYYY-MM-DD format date.
    * `notes` (`string`): Optional user observations.
* **Indexes:**
  * `email` -> Unique Index.

### Collection: `stocks`
Stores stock fundamental data, cached prices, and technical signals. Updated by the Apify scraper.
* **Fields:**
  * `_id` (`ObjectId`): Unique identifier.
  * `ticker` (`string`): Stock symbol (e.g., `"RELIANCE"`).
  * `exchange` (`string`): Exchange name (e.g., `"NSE"`).
  * `current_price` (`double`): Last traded price.
  * `previous_close` (`double`): Previous day's close.
  * `market_cap` (`double`): Total market capitalization in Lakhs.
  * `high` (`double`): 52-week high price.
  * `low` (`double`): 52-week low price.
  * `stock_pe` (`double`): Price-to-Earnings ratio.
  * `dividend_yield` (`double`): Annual dividend yield percentage.
  * `roce` (`double`): Return on Capital Employed percentage.
  * `roe` (`double`): Return on Equity percentage.
  * `face_value` (`double`): Share face value.
  * `last_updated` (`ISODate`): Timestamp of last scrape update.
* **Indexes:**
  * `ticker` -> Unique Index.

### Collection: `alerts`
Stores user-configured price alerts.
* **Fields:**
  * `_id` (`ObjectId`): Unique identifier.
  * `user_id` (`ObjectId`): Foreign key referencing `users._id`.
  * `ticker` (`string`): Target stock symbol (e.g., `"RELIANCE"`).
  * `exchange` (`string`): Target exchange (e.g., `"NSE"`).
  * `buy_price` (`double`): Stock price when the alert was configured.
  * `target_price` (`double | null`): Price target threshold.
  * `stop_loss` (`double | null`): Stop loss price threshold.
  * `is_active` (`boolean`): Active check status.
  * `triggered_at` (`ISODate | null`): Timestamp of trigger.
  * `created_at` (`ISODate`): Timestamp of creation.
  * `note` (`string`): Custom context.
* **Indexes:**
  * `user_id` -> Non-unique index.
  * `is_active` -> Sparse/partial index.

### Collection: `price_history`
Stores historical prices for chart rendering.
* **Fields:**
  * `_id` (`ObjectId`): Unique identifier.
  * `ticker` (`string`): Stock symbol.
  * `price` (`double`): Traded price.
  * `timestamp` (`ISODate`): Capture timestamp.
* **Indexes:**
  * `ticker` + `timestamp` -> Compound Index.


## 2. Redis Caching Layer

Redis acts as a high-performance buffer between MongoDB and client REST requests.

### Key Schemas & TTL Policy

| Key Pattern | Data Structure | TTL | Description |
|---|---|---|---|
| `stock:{ticker}` | String (JSON) | 600s (10m) | Cached fundamentals, updated on cache miss from DB. |
| `alerts:user:{user_id}` | Set | 300s (5m) | Active alert configs for specific users to optimize alert checking. |
| `websocket:price:{ticker}` | String | None | Holds the latest streaming price for low-latency distribution. |


## 3. Frontend Routing (Next.js 14 App Router)

```
frontend/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx           # User authentication form
│   └── register/
│       └── page.tsx           # User registration form
├── (dashboard)/
│   ├── layout.tsx             # Collapsible side navigation & JWT verification
│   ├── dashboard/
│   │   └── page.tsx           # Portfolio valuation, audit, simulator, & action matrix
│   ├── watchlist/
│   │   └── page.tsx           # Tracked stock list with WebSocket price tickers
│   ├── stock/[ticker]/
│   │   └── page.tsx           # Deep dive into company fundamentals & technical signals
│   └── alerts/
│       └── page.tsx           # Alert creation, target tracker, & history ledger
└── layout.tsx                 # Toast context provider & HTML wrapper
```
