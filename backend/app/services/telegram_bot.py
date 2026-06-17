"""
Telegram Bot — StockSentinel
Run this standalone: python -m app.services.telegram_bot

Commands:
  /start <token>  — Link Telegram to StockSentinel account
  /portfolio      — View portfolio summary
  /price TICKER   — Get current price
  /alerts         — List active alerts
  /help           — Show commands
"""
import asyncio
import httpx
from app.config import settings
from app.database import connect_db, get_db
from app.services.stock_service import get_stock_data, get_portfolio_with_prices
from app.services.auth_service import decode_token
from bson import ObjectId

API = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"
OFFSET = 0

async def get_updates(offset: int):
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{API}/getUpdates", params={"offset": offset, "timeout": 25})
        return r.json().get("result", [])

async def send(chat_id: str, text: str):
    async with httpx.AsyncClient() as client:
        await client.post(f"{API}/sendMessage", json={
            "chat_id": chat_id, "text": text, "parse_mode": "Markdown"
        })

async def handle_start(chat_id: str, args: str):
    db = get_db()
    if not args:
        await send(chat_id, "👋 Welcome to *StockSentinel Bot*!\nOpen the app and go to *Settings → Link Telegram* to connect your account.")
        return
    try:
        payload = decode_token(args)
        user_id = payload["sub"]
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"telegram_chat_id": str(chat_id)}})
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        name = user.get("name", "there") if user else "there"
        await send(chat_id, f"✅ *Linked!* Hi {name}, your Telegram is now connected to StockSentinel.\nType /help to see what I can do.")
    except Exception:
        await send(chat_id, "❌ Invalid or expired link. Please generate a new one from the StockSentinel app.")

async def handle_portfolio(chat_id: str):
    db = get_db()
    user = await db.users.find_one({"telegram_chat_id": str(chat_id)})
    if not user:
        await send(chat_id, "❌ Account not linked. Open StockSentinel → Settings → Link Telegram.")
        return
    portfolio = await get_portfolio_with_prices(user.get("portfolio", []))
    if not portfolio:
        await send(chat_id, "📭 Your portfolio is empty. Add stocks on StockSentinel!")
        return
    lines = ["📊 *Your Portfolio*\n"]
    total_invested = total_current = 0
    for item in portfolio:
        qty = item["quantity"]
        bp = item["buy_price"]
        cp = item.get("current_price") or bp
        pnl = item.get("pnl", 0) or 0
        pct = item.get("pnl_percent", 0) or 0
        em = "🟢" if pnl >= 0 else "🔴"
        lines.append(f"{em} *{item['ticker']}* x{qty} | ₹{cp:,.0f} | P&L: ₹{pnl:+,.0f} ({pct:+.1f}%)")
        total_invested += bp * qty
        total_current += cp * qty
    total_pnl = total_current - total_invested
    em2 = "🟢" if total_pnl >= 0 else "🔴"
    lines.append(f"\n{em2} *Total P&L: ₹{total_pnl:+,.0f}*")
    await send(chat_id, "\n".join(lines))

async def handle_price(chat_id: str, ticker: str):
    stock = await get_stock_data(ticker.upper())
    if not stock:
        await send(chat_id, f"❌ Stock `{ticker}` not found in database.")
        return
    cp = stock.get("current_price", "N/A")
    pc = stock.get("previous_close", "N/A")
    change = ""
    if isinstance(cp, float) and isinstance(pc, float) and pc > 0:
        chg = cp - pc
        pct = (chg / pc) * 100
        em = "🟢" if chg >= 0 else "🔴"
        change = f"\n{em} Change: ₹{chg:+.2f} ({pct:+.2f}%)"
    await send(chat_id, f"📈 *{ticker.upper()}* (NSE)\nPrice: ₹{cp:,.2f}\nPrev Close: ₹{pc:,.2f}{change}")

async def handle_alerts(chat_id: str):
    db = get_db()
    user = await db.users.find_one({"telegram_chat_id": str(chat_id)})
    if not user:
        await send(chat_id, "❌ Account not linked.")
        return
    alerts = await db.alerts.find({"user_id": user["_id"], "is_active": True}).to_list(50)
    if not alerts:
        await send(chat_id, "🔔 No active alerts. Set them on StockSentinel!")
        return
    lines = ["🔔 *Active Alerts*\n"]
    for a in alerts:
        parts = [f"*{a['ticker']}*"]
        if a.get("target_price"):
            parts.append(f"🎯 Target: ₹{a['target_price']:,.0f}")
        if a.get("stop_loss"):
            parts.append(f"🔴 SL: ₹{a['stop_loss']:,.0f}")
        lines.append(" | ".join(parts))
    await send(chat_id, "\n".join(lines))

async def process_update(update: dict):
    msg = update.get("message", {})
    chat_id = str(msg.get("chat", {}).get("id", ""))
    text = msg.get("text", "").strip()
    if not text or not chat_id:
        return

    if settings.TELEGRAM_CHAT_ID and chat_id != settings.TELEGRAM_CHAT_ID:
        print(f"⚠️ Ignored message from unauthorized chat ID: {chat_id}")
        await send(chat_id, "❌ Unauthorized. This bot is configured to only respond to a specific user.")
        return

    parts = text.split(maxsplit=1)
    cmd = parts[0].lower()
    args = parts[1] if len(parts) > 1 else ""

    if cmd == "/start":
        await handle_start(chat_id, args)
    elif cmd == "/portfolio":
        await handle_portfolio(chat_id)
    elif cmd == "/price":
        if args:
            await handle_price(chat_id, args.strip())
        else:
            await send(chat_id, "Usage: `/price RELIANCE`")
    elif cmd == "/alerts":
        await handle_alerts(chat_id)
    elif cmd == "/help":
        await send(chat_id, (
            "🤖 *StockSentinel Bot Commands*\n\n"
            "/portfolio — Portfolio summary with P&L\n"
            "/price TICKER — Live price for any NSE stock\n"
            "/alerts — Your active price alerts\n"
            "/help — This message"
        ))

async def run_bot():
    global OFFSET
    await connect_db()
    print("🤖 StockSentinel Telegram Bot running...")
    while True:
        try:
            updates = await get_updates(OFFSET)
            for update in updates:
                await process_update(update)
                OFFSET = update["update_id"] + 1
        except Exception as e:
            print(f"[Bot] Error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(run_bot())
