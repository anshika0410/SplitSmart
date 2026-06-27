from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone_number: Optional[str] = None
    upi_vpa: Optional[str] = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class GoogleLoginRequest(BaseModel):
    email: EmailStr
    name: str
    photo_url: Optional[str] = None

# Group Schemas
class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    invite_code: Optional[str] = None
    is_archived: bool = False

class GroupCreate(GroupBase):
    pass

class Group(GroupBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class GroupMemberBase(BaseModel):
    group_id: int
    user_id: int
    is_admin: bool = False

class GroupMemberCreate(GroupMemberBase):
    pass

class GroupMember(GroupMemberBase):
    id: int
    joined_at: datetime
    class Config:
        from_attributes = True

# Expense Split Schemas
class ExpenseSplitBase(BaseModel):
    user_id: int
    amount_owed: float

class ExpenseSplitCreate(ExpenseSplitBase):
    pass

class ExpenseSplit(ExpenseSplitBase):
    id: int
    expense_id: int
    class Config:
        from_attributes = True

# Expense Schemas
class ExpenseBase(BaseModel):
    description: str
    amount: float
    currency: str = "INR"
    payer_id: int
    group_id: Optional[int] = None
    split_type: str = "equal"
    category: str = "other"

class ExpenseCreate(ExpenseBase):
    splits: List[ExpenseSplitCreate]

class Expense(ExpenseBase):
    id: int
    created_at: datetime
    splits: List[ExpenseSplit]
    class Config:
        from_attributes = True

# Balance Schemas
class BalanceBase(BaseModel):
    user_id: int
    owes_to_user_id: int
    amount: float
    group_id: Optional[int] = None

class Balance(BalanceBase):
    id: int
    updated_at: datetime
    user: User
    owes_to: User
    class Config:
        from_attributes = True

# Recurring Expense Schemas

class RecurringExpenseSplitBase(BaseModel):
    user_id: int
    amount_owed: float

class RecurringExpenseSplitCreate(RecurringExpenseSplitBase):
    pass

class RecurringExpenseSplit(RecurringExpenseSplitBase):
    id: int
    recurring_expense_id: int
    class Config:
        from_attributes = True

class RecurringExpenseBase(BaseModel):
    description: str
    amount: float
    currency: str = "INR"
    category: str = "other"
    payer_id: int
    group_id: int
    split_type: str = "equal"
    frequency: str = "monthly"
    next_run_date: datetime
    is_active: bool = True

class RecurringExpenseCreate(RecurringExpenseBase):
    splits: List[RecurringExpenseSplitCreate]

class RecurringExpense(RecurringExpenseBase):
    id: int
    created_at: datetime
    splits: List[RecurringExpenseSplit]
    class Config:
        from_attributes = True
