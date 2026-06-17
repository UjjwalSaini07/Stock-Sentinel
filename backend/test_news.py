import httpx
import xml.etree.ElementTree as ET

async def test_news():
    ticker = "RELIANCE"
    # Google News RSS Search
    url = f"https://news.google.com/rss/search?q={ticker}+stock+NSE&hl=en-IN&gl=IN&ceid=IN:en"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient(headers=headers) as client:
        resp = await client.get(url)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            root = ET.fromstring(resp.text)
            channel = root.find("channel")
            items = channel.findall("item")
            print(f"Found {len(items)} news items for {ticker}")
            for item in items[:3]:
                title = item.find("title").text
                link = item.find("link").text
                pub_date = item.find("pubDate").text
                source = item.find("source").text if item.find("source") is not None else "Unknown"
                print(f"Title: {title}\nLink: {link}\nDate: {pub_date}\nSource: {source}\n---")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_news())
