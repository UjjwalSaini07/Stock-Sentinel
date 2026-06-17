import httpx
import json

async def test_yahoo():
    ticker = "RELIANCE.NS"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1d&interval=15m"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient(headers=headers) as client:
        resp = await client.get(url)
        print("Status Code:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            chart = data.get("chart", {})
            result = chart.get("result", [])
            if result:
                meta = result[0].get("meta", {})
                print("Meta info:", {
                    "currency": meta.get("currency"),
                    "symbol": meta.get("symbol"),
                    "regularMarketPrice": meta.get("regularMarketPrice"),
                    "previousClose": meta.get("previousClose"),
                })
                indicators = result[0].get("indicators", {})
                quote = indicators.get("quote", [{}])[0]
                timestamps = result[0].get("timestamp", [])
                close_prices = quote.get("close", [])
                print(f"Fetched {len(timestamps)} data points.")
                if len(timestamps) > 0:
                    print("First point:", timestamps[0], close_prices[0])
                    print("Last point:", timestamps[-1], close_prices[-1])
            else:
                print("No result found in chart response")
        else:
            print("Response:", resp.text)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_yahoo())
