import httpx
import json
from datetime import datetime, timezone

async def test_yahoo_7d():
    ticker = "RELIANCE.NS"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=7d&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient(headers=headers) as client:
        resp = await client.get(url)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            result = data.get("chart", {}).get("result", [])
            if result:
                timestamps = result[0].get("timestamp", [])
                close = result[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
                print(f"Timestamps: {len(timestamps)}, Closes: {len(close)}")
                for ts, c in zip(timestamps, close):
                    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                    print(f"Date: {dt.date().isoformat()}, Close: {c}")
            else:
                print("No result")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_yahoo_7d())
