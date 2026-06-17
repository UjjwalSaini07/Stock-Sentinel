import httpx
from app.config import settings
from app.database import get_db
from bson import ObjectId

TELEGRAM_API = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"

async def send_telegram_message(chat_id: str, message: str):
    """Send a message to a Telegram chat."""
    if not settings.TELEGRAM_BOT_TOKEN:
        print(f"[Telegram] No token set. Would send: {message}")
        return
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{TELEGRAM_API}/sendMessage",
                json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}
            )
            resp.raise_for_status()
        except Exception as e:
            print(f"[Telegram] Error sending message: {e}")

async def notify_alert_triggered(user_id: str, ticker: str, price: float, alert_type: str, target: float):
    """Send alert notification to user's Telegram."""
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    
    if not user or not user.get("telegram_chat_id"):
        return
    
    emoji = "🎯" if alert_type == "target" else "🔴"
    label = "TARGET REACHED" if alert_type == "target" else "STOP LOSS HIT"
    
    message = (
        f"{emoji} *StockSentinel Alert*\n\n"
        f"*{ticker}* — {label}\n"
        f"Price: ₹{price:,.2f}\n"
        f"Your level: ₹{target:,.2f}\n\n"
        f"_Check your portfolio now!_"
    )
    
    await send_telegram_message(user["telegram_chat_id"], message)

async def send_portfolio_summary(chat_id: str, portfolio_data: list):
    """Send weekly portfolio summary."""
    if not portfolio_data:
        await send_telegram_message(chat_id, "📊 Your portfolio is empty. Add some stocks on StockSentinel!")
        return
    
    lines = ["📊 *Your Portfolio Summary*\n"]
    total_pnl = 0
    
    for item in portfolio_data:
        ticker = item["ticker"]
        pnl = item.get("pnl", 0) or 0
        pnl_pct = item.get("pnl_percent", 0) or 0
        total_pnl += pnl
        emoji = "🟢" if pnl >= 0 else "🔴"
        lines.append(f"{emoji} *{ticker}*: ₹{pnl:+,.2f} ({pnl_pct:+.1f}%)")
    
    total_emoji = "🟢" if total_pnl >= 0 else "🔴"
    lines.append(f"\n{total_emoji} *Total P&L*: ₹{total_pnl:+,.2f}")
    
    await send_telegram_message(chat_id, "\n".join(lines))
