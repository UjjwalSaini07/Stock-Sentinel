from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as aioredis
from app.config import settings

mongo_client: AsyncIOMotorClient = None
redis_client: aioredis.Redis = None
db = None

import os

async def connect_db():
    global mongo_client, redis_client, db
    uri = settings.MONGODB_URI
    if os.path.exists('/.dockerenv'):
        uri = uri.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")
    mongo_client = AsyncIOMotorClient(uri)
    db = mongo_client["stocksentineldb"]
    redis_client = aioredis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        health_check_interval=30,
        socket_keepalive=True,
        retry_on_timeout=True
    )
    print(f"✅ MongoDB + Redis connected (URI: {uri.split('@')[-1] if '@' in uri else uri})")

async def close_db():
    if mongo_client:
        mongo_client.close()
    if redis_client:
        await redis_client.close()

def get_db():
    return db

def get_redis():
    return redis_client
