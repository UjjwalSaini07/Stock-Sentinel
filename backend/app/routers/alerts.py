from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from app.models import AlertCreate
from app.services.auth_service import get_current_user
from app.database import get_db

router = APIRouter()

def serialize_alert(alert: dict) -> dict:
    alert["id"] = str(alert.pop("_id"))
    alert["user_id"] = str(alert["user_id"])
    if isinstance(alert.get("triggered_at"), datetime):
        alert["triggered_at"] = alert["triggered_at"].isoformat()
    if isinstance(alert.get("created_at"), datetime):
        alert["created_at"] = alert["created_at"].isoformat()
    return alert

@router.post("/")
async def create_alert(body: AlertCreate, user=Depends(get_current_user)):
    db = get_db()
    if not body.target_price and not body.stop_loss:
        raise HTTPException(status_code=400, detail="Provide at least a target_price or stop_loss")

    alert = {
        **body.dict(),
        "ticker": body.ticker.upper(),
        "user_id": user["_id"],
        "is_active": True,
        "triggered_at": None,
        "created_at": datetime.utcnow()
    }
    result = await db.alerts.insert_one(alert)
    alert["id"] = str(result.inserted_id)
    return {"message": "Alert created", "alert_id": str(result.inserted_id)}

@router.get("/")
async def list_alerts(user=Depends(get_current_user)):
    db = get_db()
    cursor = db.alerts.find({"user_id": user["_id"]}).sort("created_at", -1)
    alerts = await cursor.to_list(length=100)
    return [serialize_alert(a) for a in alerts]

@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, user=Depends(get_current_user)):
    db = get_db()
    result = await db.alerts.delete_one({"_id": ObjectId(alert_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert deleted"}

@router.patch("/{alert_id}/toggle")
async def toggle_alert(alert_id: str, user=Depends(get_current_user)):
    db = get_db()
    alert = await db.alerts.find_one({"_id": ObjectId(alert_id), "user_id": user["_id"]})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    new_state = not alert["is_active"]
    await db.alerts.update_one({"_id": ObjectId(alert_id)}, {"$set": {"is_active": new_state}})
    return {"is_active": new_state}
