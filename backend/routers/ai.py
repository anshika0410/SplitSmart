from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Form
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
import os

from .. import crud, models, schemas, ai_services
from ..database import get_db

router = APIRouter(
    prefix="/ai",
    tags=["ai"],
)

class NLPRequest(BaseModel):
    text: str
    group_id: int
    current_user_id: int

@router.post("/parse-nl")
def parse_natural_language(req: NLPRequest, db: Session = Depends(get_db)):
    # 1. Fetch context (group members)
    group_members = db.query(models.GroupMember).filter(models.GroupMember.group_id == req.group_id).all()
    if not group_members:
        raise HTTPException(status_code=404, detail="Group not found or has no members")
        
    users_context = []
    for gm in group_members:
        user = crud.get_user(db, gm.user_id)
        if user:
            users_context.append({"id": user.id, "name": user.name})
            
    # Add current user to context to handle "I" or "me"
    current_user = crud.get_user(db, req.current_user_id)
    if current_user and not any(u["id"] == current_user.id for u in users_context):
        users_context.append({"id": current_user.id, "name": current_user.name, "is_current_user": True})

    # 2. Call Gemini
    try:
        parsed_data = ai_services.parse_natural_language_expense(req.text, users_context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # 3. Handle default payer ("I paid")
    if parsed_data.get("payer_id") == 1 and current_user:
        parsed_data["payer_id"] = current_user.id
        
    return parsed_data

@router.post("/parse-bill")
async def parse_bill_upload(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only images are allowed")
        
    contents = await file.read()
    
    try:
        parsed_data = ai_services.parse_bill_image(contents, file.content_type)
        return parsed_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/parse-audio")
async def parse_audio_upload(
    group_id: int = Form(...),
    current_user_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith("audio/") and not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only audio files are allowed")

    group_members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
    if not group_members:
        raise HTTPException(status_code=404, detail="Group not found or has no members")
        
    users_context = []
    for gm in group_members:
        user = crud.get_user(db, gm.user_id)
        if user:
            users_context.append({"id": user.id, "name": user.name})
            
    current_user = crud.get_user(db, current_user_id)
    if current_user and not any(u["id"] == current_user.id for u in users_context):
        users_context.append({"id": current_user.id, "name": current_user.name, "is_current_user": True})

    contents = await file.read()
    
    try:
        parsed_data = ai_services.parse_audio_expense(contents, file.content_type, users_context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    if parsed_data.get("payer_id") == 1 and current_user:
        parsed_data["payer_id"] = current_user.id
        
    return parsed_data
