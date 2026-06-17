import httpx
import json

async def test_indices():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient(headers=headers) as client:
        for symbol in ["^NSEI", "^BSESN"]:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1d&interval=1d"
            resp = await client.get(url)
            print(symbol, resp.status_code)
            if resp.status_code == 200:
                meta = resp.json().get("chart", {}).get("result", [{}])[0].get("meta", {})
                print({
                    "symbol": symbol,
                    "price": meta.get("regularMarketPrice"),
                    "prevClose": meta.get("previousClose")
                })

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_indices())
