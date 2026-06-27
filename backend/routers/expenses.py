from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, models, schemas
from ..database import get_db
from ..utils import simplify_debts

router = APIRouter(
    prefix="/expenses",
    tags=["expenses"],
)

@router.post("/", response_model=schemas.Expense)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    return crud.create_expense(db=db, expense=expense)

@router.post("/simplify/{group_id}")
def simplify_group_debts(group_id: int, db: Session = Depends(get_db)):
    # 1. Fetch all balances for the group
    balances = db.query(models.Balance).filter(models.Balance.group_id == group_id).all()
    
    if not balances:
        return {"message": "No debts to simplify in this group."}
        
    # 2. Call the simplification algorithm
    simplified_transactions = simplify_debts(balances)
    
    # 3. In a real app, we would update the database here.
    # For now, we return the simplified plan to the user.
    return {
        "group_id": group_id,
        "original_edges": len(balances),
        "simplified_edges": len(simplified_transactions),
        "simplified_transactions": simplified_transactions
    }

@router.post("/recurring", response_model=schemas.RecurringExpense)
def create_recurring_expense(recurring_expense: schemas.RecurringExpenseCreate, db: Session = Depends(get_db)):
    return crud.create_recurring_expense(db=db, recurring_expense=recurring_expense)

@router.post("/recurring/process")
def trigger_recurring_processing(db: Session = Depends(get_db)):
    """
    Triggers the recurring expenses processor.
    This checks all active recurring expenses, and if their next_run_date is in the past,
    it automatically generates an expense and advances the next run date.
    """
    processed_count = crud.process_recurring_expenses(db)
    return {"message": f"Successfully processed {processed_count} due recurring expenses."}
