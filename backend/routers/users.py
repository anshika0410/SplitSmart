from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

@router.post("/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@router.get("/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@router.get("/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.get("/{user_id}/balances", response_model=List[schemas.Balance])
def read_user_balances(user_id: int, group_id: int = None, db: Session = Depends(get_db)):
    """Fetch all balances where the user owes money or is owed money."""
    from sqlalchemy import or_
    query = db.query(models.Balance).filter(
        or_(models.Balance.user_id == user_id, models.Balance.owes_to_user_id == user_id),
        models.Balance.amount > 0
    )
    if group_id:
        query = query.filter(models.Balance.group_id == group_id)
    return query.all()

@router.get("/{user_id}/upi_link/{owes_to_user_id}")
def generate_upi_link(user_id: int, owes_to_user_id: int, db: Session = Depends(get_db)):
    """
    Generates a generic UPI deep link for settling a balance.
    The frontend can use React Native Linking.openURL(url) with this response.
    """
    balance = db.query(models.Balance).filter(
        models.Balance.user_id == user_id,
        models.Balance.owes_to_user_id == owes_to_user_id
    ).first()
    
    if not balance or balance.amount <= 0:
        raise HTTPException(status_code=400, detail="No valid balance found to settle")
        
    payee = balance.owes_to
    if not payee.upi_vpa:
        raise HTTPException(status_code=400, detail=f"{payee.name} does not have a valid UPI ID registered.")
        
    # Generate generic UPI deep link
    upi_url = f"upi://pay?pa={payee.upi_vpa}&pn={payee.name}&am={balance.amount}&cu=INR"
    return {"upi_link": upi_url}

@router.get("/{user_id}/activities")
def read_user_activities(user_id: int, group_id: int = None, db: Session = Depends(get_db)):
    """Fetch recent expenses where the user was either the payer or a split member."""
    from sqlalchemy import or_
    
    # Get expenses where user paid
    paid_query = db.query(models.Expense).filter(models.Expense.payer_id == user_id)
    if group_id:
        paid_query = paid_query.filter(models.Expense.group_id == group_id)
    paid_expenses = paid_query.all()
    
    # Get expenses where user is part of a split
    splits_query = db.query(models.ExpenseSplit).filter(models.ExpenseSplit.user_id == user_id)
    user_splits = splits_query.all()
    split_expense_ids = [s.expense_id for s in user_splits]
    
    split_query = db.query(models.Expense).filter(
        models.Expense.id.in_(split_expense_ids),
        models.Expense.payer_id != user_id
    )
    if group_id:
        split_query = split_query.filter(models.Expense.group_id == group_id)
    split_expenses = split_query.all()
    
    # Combine and deduplicate
    all_expenses = {e.id: e for e in paid_expenses + split_expenses}.values()
    
    # Sort by created_at descending
    sorted_expenses = sorted(all_expenses, key=lambda x: x.created_at, reverse=True)[:50]
    
    result = []
    for exp in sorted_expenses:
        payer_name = exp.payer.name if exp.payer else "Unknown"
        is_payer = exp.payer_id == user_id
        
        user_split = next((s for s in exp.splits if s.user_id == user_id), None)
        user_share = user_split.amount_owed if user_split else 0
        
        result.append({
            "id": exp.id,
            "description": exp.description,
            "amount": exp.amount,
            "payer_name": payer_name,
            "is_payer": is_payer,
            "user_share": user_share,
            "created_at": exp.created_at.isoformat()
        })
        
    return result

@router.post("/{user_id}/settle/{owes_to_user_id}")
def settle_balance(user_id: int, owes_to_user_id: int, db: Session = Depends(get_db)):
    """Mark a balance as settled by zeroing out the amount."""
    balance = db.query(models.Balance).filter(
        models.Balance.user_id == user_id,
        models.Balance.owes_to_user_id == owes_to_user_id
    ).first()
    
    if balance:
        balance.amount = 0
        db.commit()
    
    return {"message": "Balance marked as settled"}
