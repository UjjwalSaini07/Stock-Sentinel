import httpx
from app.config import settings
from app.database import get_db
from bson import ObjectId

async def send_telegram_message(chat_id: str, message: str, bot_token: str = None):
    """Send a message to a Telegram chat."""
    if not bot_token:
        print(f"[Telegram] No bot token provided. Skipping message: {message}")
        return
    
    api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                api_url,
                json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}
            )
            resp.raise_for_status()
        except Exception as e:
            print(f"[Telegram] Error sending message: {e}")

async def notify_alert_triggered(user_id: str, ticker: str, price: float, alert_type: str, target: float):
    """Send alert notification to user's Telegram."""
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    
    if not user or not user.get("telegram_chat_id") or not user.get("telegram_bot_token"):
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
    
    await send_telegram_message(user["telegram_chat_id"], message, user["telegram_bot_token"])

async def send_portfolio_summary(chat_id: str, portfolio_data: list, bot_token: str = None):
    """Send weekly portfolio summary."""
    if not portfolio_data:
        await send_telegram_message(chat_id, "📊 Your portfolio is empty. Add some stocks on StockSentinel!", bot_token)
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
    
    await send_telegram_message(chat_id, "\n".join(lines), bot_token)
