import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from apify import Actor
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from pymongo import MongoClient

SCRAPPER_DIR = Path(__file__).resolve().parent


def get_ticker_file_path() -> Path:
    """Finds the IndianStockTicker.json file by searching candidate paths.

    Returns:
        Path: The absolute path to the IndianStockTicker.json file.
    """
    candidates = [
        SCRAPPER_DIR / "IndianStockTicker.json",
        Path.cwd() / "IndianStockTicker.json",
        SCRAPPER_DIR.parent / "IndianStockTicker.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        f"Ticker file not found. Expected 'IndianStockTicker.json' in one of: {[str(c) for c in candidates]}"
    )


def fetch_stock_data(ticker: str, exchange: str) -> dict:
    """Fetches stock metrics from screener.in and Google Finance.

    Args:
        ticker (str): The stock ticker symbol.
        exchange (str): The stock exchange (e.g. NSE).

    Returns:
        dict: Scraped stock data or an error dict.
    """
    url = f"https://www.screener.in/company/{ticker}/"
    response = requests.get(url)
    if response.status_code != 200:
        return {"error": f"Failed to fetch data. Status code: {response.status_code}"}

    soup = BeautifulSoup(response.text, "html.parser")

    def get_text(selector):
        element = soup.select_one(selector)
        return element.text.strip() if element else None

    def parse_numeric(value):
        try:
            return float(value.replace(",", "").strip("₹").strip("%")) if value else None
        except ValueError:
            return None

    try:
        market_cap = get_text("li:-soup-contains('Market Cap') .number")
        current_price = get_text("li:-soup-contains('Current Price') .number")
        high_low = get_text("li:-soup-contains('High / Low') .nowrap.value")
        stock_pe = get_text("li:-soup-contains('Stock P/E') .number")
        dividend_yield = get_text("li:-soup-contains('Dividend Yield') .number")
        roce = get_text("li:-soup-contains('ROCE') .number")
        roe = get_text("li:-soup-contains('ROE') .number")
        face_value = get_text("li:-soup-contains('Face Value') .number")

        high, low = None, None
        if high_low and " / " in high_low:
            high, low = map(parse_numeric, high_low.split(" / "))

        google_finance_url = f"https://www.google.com/finance/quote/{ticker}:{exchange}"
        google_response = requests.get(google_finance_url)
        previous_close = None

        if google_response.status_code == 200:
            google_soup = BeautifulSoup(google_response.text, "html.parser")
            previous_close_element = google_soup.select_one("div.gyFHrc div.P6K39c")
            if previous_close_element:
                previous_close = parse_numeric(previous_close_element.text)

        peers_section = soup.select_one("#peers")
        sector = None
        industry = None
        if peers_section:
            market_links = peers_section.find_all("a", href=lambda h: h and h.startswith("/market/"))
            if market_links:
                sector = market_links[0].text.strip()
                industry = market_links[-1].text.strip()

        return {
            "ticker": ticker,
            "exchange": exchange,
            "market_cap": parse_numeric(market_cap),
            "current_price": parse_numeric(current_price),
            "previous_close": previous_close,
            "high": high,
            "low": low,
            "stock_pe": parse_numeric(stock_pe),
            "dividend_yield": parse_numeric(dividend_yield),
            "roce": parse_numeric(roce),
            "roe": parse_numeric(roe),
            "face_value": parse_numeric(face_value),
            "sector": sector,
            "industry": industry,
            "last_updated": datetime.now(timezone.utc)
        }
    except Exception as e:
        return {"error": f"Failed to parse stock data: {e}"}


def run_scraper():
    """Main execution block to fetch data and write to MongoDB."""
    load_dotenv()
    Actor.init()

    mongo_uri = os.getenv("MONGODB_URI")
    if not mongo_uri:
        raise ValueError("MONGODB_URI is not set. Check your .env file.")

    client = MongoClient(mongo_uri)
    db = client["stocksentineldb"]
    collection = db["stocks"]

    try:
        ticker_file_path = get_ticker_file_path()
        with ticker_file_path.open("r", encoding="utf-8") as ticker_file:
            tickers = json.load(ticker_file)
    except Exception as e:
        print(f"Error loading ticker file: {e}")
        tickers = []

    # Dynamically fetch user-defined tickers from portfolio and active alerts
    try:
        # Portfolios
        users_col = db["users"]
        portfolio_tickers = users_col.distinct("portfolio.ticker")
        
        # Active Alerts
        alerts_col = db["alerts"]
        alert_tickers = alerts_col.distinct("ticker", {"is_active": True})
        
        dynamic_tickers = list(set(portfolio_tickers + alert_tickers))
        print(f"Loaded {len(dynamic_tickers)} dynamic tickers from portfolios/alerts: {dynamic_tickers}")
        
        for dt in dynamic_tickers:
            if dt and dt not in tickers:
                tickers.append(dt)
    except Exception as e:
        print(f"Error loading dynamic tickers: {e}")

    batch_size = 20

    try:
        for i in range(0, len(tickers), batch_size):
            batch = tickers[i : i + batch_size]

            for ticker in batch:
                try:
                    stock_data = fetch_stock_data(ticker, "NSE")
                    if "error" not in stock_data:
                        collection.update_one(
                            {"ticker": stock_data["ticker"]},
                            {"$set": stock_data},
                            upsert=True,
                        )
                        # Save to price history only if price changed
                        last_record = db["price_history"].find_one(
                            {"ticker": stock_data["ticker"]},
                            sort=[("timestamp", -1)]
                        )
                        if not last_record or last_record.get("price") != stock_data["current_price"]:
                            db["price_history"].insert_one({
                                "ticker": stock_data["ticker"],
                                "price": stock_data["current_price"],
                                "timestamp": datetime.now(timezone.utc)
                            })
                            print(f"Saved {stock_data['ticker']} price tick to history")
                        else:
                            print(f"Price for {stock_data['ticker']} did not change ({stock_data['current_price']}); skipping history insert")
                    else:
                        print(f"Error fetching data for {ticker}: {stock_data['error']}")
                except Exception as e:
                    print(f"Unexpected error for {ticker}: {e}")
                time.sleep(2)

            print(f"Batch {i // batch_size + 1} processed")

        print("All stock data updated in MongoDB.")
    except Exception as e:
        print(f"Critical error occurred: {e}")
    finally:
        client.close()
        print("MongoDB connection closed.")
        Actor.exit()


if __name__ == "__main__":
    run_scraper()
