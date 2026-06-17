import asyncio
from datetime import datetime, timezone
from bson import ObjectId
from collections import defaultdict
from app.database import get_db
from app.services.scraper_service import scrape_stock
from app.services.telegram import notify_alert_triggered
from app.config import settings

async def check_all_alerts():
    """Check all active alerts against live scraped prices."""
    db = get_db()
    
    try:
        cursor = db.alerts.find({"is_active": True})
        alerts = await cursor.to_list(length=1000)
        
        if not alerts:
            return
            
        # Group alerts by ticker
        alerts_by_ticker = defaultdict(list)
        for alert in alerts:
            alerts_by_ticker[alert["ticker"].upper()].append(alert)
            
        print(f"[AlertChecker] Evaluating {len(alerts)} active alerts across {len(alerts_by_ticker)} unique tickers...")
        
        for ticker, ticker_alerts in alerts_by_ticker.items():
            # Scrape fresh live price
            stock = await scrape_stock(ticker)
            
            # Fallback to database if scrape fails
            if not stock or not stock.get("current_price"):
                print(f"[AlertChecker] Failed to scrape {ticker}. Falling back to DB cache...")
                stock = await db.stocks.find_one({"ticker": ticker})
                
            if not stock or not stock.get("current_price"):
                print(f"[AlertChecker] No price available for {ticker}. Skipping...")
                continue
                
            price = stock["current_price"]
            
            for alert in ticker_alerts:
                user_id = str(alert["user_id"])
                triggered = False
                alert_type = None
                target_level = None
                
                # Check target price (price went UP to target)
                if alert.get("target_price") and price >= alert["target_price"]:
                    triggered = True
                    alert_type = "target"
                    target_level = alert["target_price"]
                
                # Check stop loss (price went DOWN to stop loss)
                elif alert.get("stop_loss") and price <= alert["stop_loss"]:
                    triggered = True
                    alert_type = "stoploss"
                    target_level = alert["stop_loss"]
                
                if triggered:
                    print(f"[AlertChecker] {ticker} triggered ({alert_type}) at ₹{price} for user {user_id} (Target level: {target_level})")
                    
                    # Mark alert as triggered
                    await db.alerts.update_one(
                        {"_id": alert["_id"]},
                        {"$set": {"is_active": False, "triggered_at": datetime.now(timezone.utc)}}
                    )
                    
                    # Send Telegram notification
                    try:
                        await notify_alert_triggered(user_id, ticker, price, alert_type, target_level)
                    except Exception as telegram_error:
                        print(f"[AlertChecker] Telegram notification failed for {ticker}: {telegram_error}")
    
    except Exception as e:
        print(f"[AlertChecker] Error during alert check: {e}")

async def start_alert_checker():
    """Runs the alert checker in a loop every N seconds."""
    print(f"[AlertChecker] Started — checking every {settings.ALERT_CHECK_INTERVAL}s")
    while True:
        await asyncio.sleep(settings.ALERT_CHECK_INTERVAL)
        await check_all_alerts()

