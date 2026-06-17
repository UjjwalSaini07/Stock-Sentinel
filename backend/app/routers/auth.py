from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.models import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
from app.services.auth_service import (
    hash_password, verify_password, create_token, decode_token
)
from app.database import get_db
from bson import ObjectId

router = APIRouter()

@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    db = get_db()
    
    if await db.users.find_one({"email": body.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "telegram_chat_id": None,
        "portfolio": [],
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(user)
    user_id = str(result.inserted_id)
    
    return TokenResponse(
        access_token=create_token(user_id, "access"),
        refresh_token=create_token(user_id, "refresh")
    )

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    return TokenResponse(
        access_token=create_token(user_id, "access"),
        refresh_token=create_token(user_id, "refresh")
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user_id = payload["sub"]
    return TokenResponse(
        access_token=create_token(user_id, "access"),
        refresh_token=create_token(user_id, "refresh")
    )
