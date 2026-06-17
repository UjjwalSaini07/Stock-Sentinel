# StockSentinel — Personalised Stock Intelligence Agent

A full-stack personal stock tracking platform built on top of your existing Apify scraper. Every user gets their own portfolio, live price tracking, fundamental data, and Telegram alerts when their target price or stop loss is hit.

## What's Inside

```
stocksentinel/
├── scraper/          ← Your original Apify scraper (UNCHANGED)
├── backend/           FastAPI + MongoDB + Redis + Telegram bot
├── frontend/           Next.js 14 app (auth, dashboard, alerts)
├── docs/              Architecture documentation
└── docker-compose.yml  One-command full stack startup
```

## How It Fits Together

1. **Your scraper** (`scraper/`) keeps running exactly as before on Apify — Mon–Fri, 9:30–15:30, every 10 minutes — writing fundamentals to MongoDB's `stocksentineldb.stocks` collection. Nothing about it was changed.
2. **Backend** reads from that same MongoDB database, caches reads in Redis (10 min TTL matching the scrape interval), and adds everything personal: user accounts, portfolios, and alerts.
3. **Frontend** is where users sign up, add stocks they bought (ticker, price, quantity), see live P&L, and set target/stop-loss alerts.
4. **Telegram bot** polls active alerts every 60 seconds and DMs the user the moment a price crosses their target or stop loss.

## Quick Start

### 1. Prerequisites
- MongoDB Atlas connection string (the same one your scraper already uses)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Docker + Docker Compose installed

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env: paste your MONGODB_URI and TELEGRAM_BOT_TOKEN

cp frontend/.env.local.example frontend/.env.local
```

### 3. Run everything
```bash
docker-compose up --build
```

- Frontend → http://localhost:3000
- Backend API docs → http://localhost:8000/docs
- Telegram bot → running in background, polling for messages

### 4. Keep your scraper running on Apify
No changes needed — deploy `scraper/` to Apify as before. It writes to the same MongoDB the backend reads from.

## Local Development (without Docker)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Telegram bot (separate process):**
```bash
cd backend
python -m app.services.telegram_bot
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Redis (if not using Docker):**
```bash
redis-server
```

## Linking Telegram

1. Find your bot on Telegram (username set when you created it via BotFather)
2. In the StockSentinel app, go to **Alerts → Link Telegram Bot** — it shows you a `/start <token>` command
3. Send that command to your bot in Telegram
4. You're linked — alerts will now arrive as DMs

## Bot Commands
- `/start <token>` — Link your StockSentinel account
- `/portfolio` — Get instant P&L summary
- `/price TICKER` — Check any stock's live price
- `/alerts` — List your active alerts
- `/help` — Show all commands

## Architecture Details

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full schema design, API reference, caching strategy, and Phase 2 roadmap (AI stock summaries, portfolio health scoring, smart fundamental-based alerts).

## Tech Stack

| Layer | Technology |
|---|---|
| Scraper | Python + BeautifulSoup (Apify Actor) — unchanged |
| Backend | FastAPI, Motor (async MongoDB), Redis, PyJWT |
| Frontend | Next.js 14 (App Router), Tailwind CSS, Zustand, Axios |
| Database | MongoDB (shared with scraper) |
| Cache | Redis (10 min TTL) |
| Notifications | Telegram Bot API (long polling) |
| Auth | JWT (access + refresh tokens), bcrypt password hashing |

## Production Deployment Notes

- **Frontend** → Deploy to Vercel (native Next.js support)
- **Backend** → Deploy to Railway or Render
- **Telegram bot** → Run as a separate worker process (same image, different start command) — switch to webhook mode for production instead of long polling
- **Redis** → Use Upstash (serverless, free tier) instead of self-hosted
- **MongoDB** → Already on Atlas, no changes needed

Update `JWT_SECRET` to a long random string before going to production — never use the example value.
