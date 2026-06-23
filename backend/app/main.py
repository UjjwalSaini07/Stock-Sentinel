from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import connect_db, close_db
from app.routers import auth, portfolio, stock, alerts, websocket, copilot, quant
from app.tasks.alert_checker import start_alert_checker
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    asyncio.create_task(start_alert_checker())
    yield
    await close_db()

app = FastAPI(title="StockSentinel API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(portfolio.router, prefix="/user", tags=["portfolio"])
app.include_router(stock.router, prefix="/stock", tags=["stock"])
app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])
app.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
app.include_router(quant.router, prefix="/quant", tags=["quant"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "StockSentinel API"}
