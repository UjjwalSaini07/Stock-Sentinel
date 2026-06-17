import httpx
import json

async def test_meta():
    symbol = "^NSEI"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=2d&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient(headers=headers) as client:
        resp = await client.get(url)
        if resp.status_code == 200:
            result = resp.json().get("chart", {}).get("result", [{}])[0]
            meta = result.get("meta", {})
            print("Meta keys:", list(meta.keys()))
            print("Meta values:")
            for k, v in meta.items():
                if not isinstance(v, (dict, list)):
                    print(f"  {k}: {v}")
            # print timestamps and closing prices
            timestamps = result.get("timestamp", [])
            close = result.get("indicators", {}).get("quote", [{}])[0].get("close", [])
            print("Timestamps:", timestamps)
            print("Closes:", close)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_meta())
