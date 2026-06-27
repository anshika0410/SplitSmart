from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, schemas, database

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/google", response_model=schemas.User)
def google_login(login_data: schemas.GoogleLoginRequest, db: Session = Depends(database.get_db)):
    # Check if user exists by email
    user = crud.get_user_by_email(db, email=login_data.email)
    if not user:
        # Create new user
        user_create = schemas.UserCreate(
            name=login_data.name,
            email=login_data.email,
            phone_number=None,
            upi_vpa=None
        )
        user = crud.create_user(db, user_create)
    return user
