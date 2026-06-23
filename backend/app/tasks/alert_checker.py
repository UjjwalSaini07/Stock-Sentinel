import asyncio
from datetime import datetime, timezone
from bson import ObjectId
from collections import defaultdict
from app.database import get_db
from app.services.scraper_service import scrape_stock
from app.services.telegram import send_telegram_message, notify_alert_triggered
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
                alert_type = alert.get("alert_type", "price")
                target_level = None
                trigger_msg = ""
                alert_type_label = "target"
                
                if alert_type == "price":
                    if alert.get("target_price") and price >= alert["target_price"]:
                        triggered = True
                        alert_type_label = "target"
                        target_level = alert["target_price"]
                        trigger_msg = f"🎯 *Price Crossed Above Target*\nStock: {ticker}\nTarget: ₹{target_level:,.2f}\nCurrent Price: ₹{price:,.2f}"
                    elif alert.get("stop_loss") and price <= alert["stop_loss"]:
                        triggered = True
                        alert_type_label = "stoploss"
                        target_level = alert["stop_loss"]
                        trigger_msg = f"🔴 *Stop Loss Hit*\nStock: {ticker}\nStop Loss: ₹{target_level:,.2f}\nCurrent Price: ₹{price:,.2f}"
                        
                elif alert_type == "volume":
                    vol = stock.get("volume")
                    if vol:
                        try:
                            val_str = alert.get("value", "0").lower().replace("x", "")
                            target_vol = float(val_str)
                            if vol >= target_vol:
                                triggered = True
                                trigger_msg = f"📊 *Volume Breakout Triggered*\nStock: {ticker}\nCondition: Volume {vol:,.0f} >= threshold {target_vol:,.0f}\nCurrent Price: ₹{price:,.2f}"
                        except:
                            pass
                            
                elif alert_type == "news":
                    from app.services.analysis_service import fetch_news_headlines
                    keyword = alert.get("value", "").lower()
                    if keyword:
                        headlines = await fetch_news_headlines(ticker)
                        matching = [h for h in headlines if keyword in h.lower()]
                        if matching:
                            triggered = True
                            trigger_msg = f"📰 *News Alert Triggered*\nStock: {ticker}\nKeyword: '{keyword}'\nMatched Headline: '{matching[0]}'\nCurrent Price: ₹{price:,.2f}"
                            
                elif alert_type == "sentiment":
                    from app.services.copilot_service import news_agent
                    target_sent = alert.get("value", "").capitalize()
                    if target_sent:
                        nws = await news_agent(ticker)
                        current_sent = nws.get("news_sentiment", "Neutral")
                        if current_sent.lower() == target_sent.lower():
                            triggered = True
                            trigger_msg = f"🔮 *Sentiment Shift Alert*\nStock: {ticker}\nCondition: Sentiment became *{current_sent}*\nCurrent Price: ₹{price:,.2f}"
                
                if triggered:
                    print(f"[AlertChecker] {ticker} triggered ({alert_type}) at ₹{price} for user {user_id}")
                    
                    await db.alerts.update_one(
                        {"_id": alert["_id"]},
                        {"$set": {"is_active": False, "triggered_at": datetime.now(timezone.utc)}}
                    )
                    
                    try:
                        user = await db.users.find_one({"_id": ObjectId(user_id)})
                        if user and user.get("telegram_chat_id") and user.get("telegram_bot_token"):
                            bot_token = user["telegram_bot_token"]
                            if alert_type == "price":
                                await notify_alert_triggered(user_id, ticker, price, alert_type_label, target_level)
                            else:
                                await send_telegram_message(user["telegram_chat_id"], trigger_msg, bot_token)
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

