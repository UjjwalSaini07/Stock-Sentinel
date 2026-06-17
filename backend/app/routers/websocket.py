from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.stock_service import get_stock_data
import asyncio
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}  # ticker -> [ws]

    async def connect(self, ticker: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(ticker, []).append(ws)

    def disconnect(self, ticker: str, ws: WebSocket):
        if ticker in self.active:
            self.active[ticker].discard(ws) if hasattr(self.active[ticker], 'discard') else None
            try:
                self.active[ticker].remove(ws)
            except ValueError:
                pass

    async def broadcast(self, ticker: str, data: dict):
        dead = []
        for ws in self.active.get(ticker, []):
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ticker, ws)

manager = ConnectionManager()

@router.websocket("/prices/{ticker}")
async def price_feed(ws: WebSocket, ticker: str):
    ticker = ticker.upper()
    await manager.connect(ticker, ws)
    try:
        while True:
            stock = await get_stock_data(ticker)
            if stock:
                await ws.send_text(json.dumps({
                    "ticker": ticker,
                    "price": stock.get("current_price"),
                    "previous_close": stock.get("previous_close"),
                    "high": stock.get("high"),
                    "low": stock.get("low"),
                    "last_updated": stock.get("last_updated")
                }))
            await asyncio.sleep(30)  # push every 30s
    except WebSocketDisconnect:
        manager.disconnect(ticker, ws)
