from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import connect_db, close_db, get_db, get_redis
from app.routers import auth, portfolio, stock, alerts, websocket, copilot, quant, intel
from app.tasks.alert_checker import start_alert_checker
from app.config import settings
import asyncio
import time
import platform
import sys
from datetime import datetime

start_time = time.time()

def get_uptime_string(seconds: float) -> str:
    days, rem = divmod(int(seconds), 86400)
    hours, rem = divmod(rem, 3600)
    minutes, seconds_int = divmod(rem, 60)
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds_int}s")
    return " ".join(parts)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    asyncio.create_task(start_alert_checker())
    yield
    await close_db()

app = FastAPI(title="StockSentinel API", version="1.0.0", lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://stocksentineliq.vercel.app",
]
if settings.FRONTEND_URL:
    frontend_url_clean = settings.FRONTEND_URL.rstrip("/")
    if frontend_url_clean not in origins:
        origins.append(frontend_url_clean)
        origins.append(f"{frontend_url_clean}/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
app.include_router(intel.router, prefix="/intel", tags=["intel"])

@app.get("/")
async def home():
    return {
        "project": "StockSentinel",
        "description": "Advanced Agentic Stock Analysis, Market Intelligence & Quant Backtesting Suite",
        "version": "1.0.0",
        "author": {
            "name": "Ujjwal Saini",
            "github": "https://github.com/UjjwalSaini07",
        },
        "documentation": "/docs",
        "currency_standard": "Indian Rupees (₹) default, with dual-currency USD/native reference support",
        "features": [
            "Real-time Market Intelligence & Forex Conversion (INR)",
            "Quant Lab Simulation & Strategy Backtester",
            "Automated Threshold & Moving Average Cross Alerts",
            "Intelligent Trade Copilot (Llama 3.3 Powered)"
        ],
        "tech_stack": {
            "backend": ["FastAPI", "Uvicorn", "Pydantic"],
            "database": ["MongoDB Atlas", "Upstash Redis (Secure SSL/TLS Caching)"],
            "ai_engine": ["Groq (Llama 3.3 70B Versatile)"],
            "frontend": ["Next.js 14", "Tailwind CSS", "Recharts", "Zustand"]
        }
    }

@app.get("/health")
async def health():
    current_time = time.time()
    uptime_seconds = current_time - start_time
    
    mongodb_status = "unhealthy"
    mongodb_latency = 0.0
    mongodb_error = None
    try:
        db = get_db()
        if db is not None:
            t0 = time.perf_counter()
            await db.client.admin.command('ping')
            t1 = time.perf_counter()
            mongodb_latency = (t1 - t0) * 1000  # ms
            mongodb_status = "healthy"
        else:
            mongodb_error = "Database client not initialized"
    except Exception as e:
        mongodb_error = str(e)

    redis_status = "unhealthy"
    redis_latency = 0.0
    redis_error = None
    try:
        redis_client = get_redis()
        if redis_client is not None:
            t0 = time.perf_counter()
            await redis_client.ping()
            t1 = time.perf_counter()
            redis_latency = (t1 - t0) * 1000  # ms
            redis_status = "healthy"
        else:
            redis_error = "Redis client not initialized"
    except Exception as e:
        redis_error = str(e)

    status = "healthy"
    if mongodb_status == "unhealthy" and redis_status == "unhealthy":
        status = "unhealthy"
    elif mongodb_status == "unhealthy" or redis_status == "unhealthy":
        status = "degraded"

    telegram_enabled = "enabled" if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID else "disabled"
    groq_enabled = "enabled" if settings.GROQ_API_KEY else "disabled"

    return {
        "status": status,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "uptime": get_uptime_string(uptime_seconds),
        "uptime_seconds": round(uptime_seconds, 2),
        "services": {
            "mongodb": {
                "status": mongodb_status,
                "latency_ms": round(mongodb_latency, 2) if mongodb_status == "healthy" else None,
                "error": mongodb_error
            },
            "redis": {
                "status": redis_status,
                "latency_ms": round(redis_latency, 2) if redis_status == "healthy" else None,
                "error": redis_error
            }
        },
        "environment": {
            "telegram_alerts": telegram_enabled,
            "groq_ai": groq_enabled
        },
        "system": {
            "python_version": sys.version.split()[0],
            "platform": platform.system(),
            "os_release": platform.release()
        }
    }
