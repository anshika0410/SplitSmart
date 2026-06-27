from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
import enum
import datetime
from .database import Base

# Removed SplitType enum to support Postgres string persistence

# Removed ExpenseCategory to support custom strings

# Removed RecurringFrequency enum to support Postgres string persistence

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=True)
    upi_vpa = Column(String, nullable=True) # e.g., user@okhdfcbank
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    expenses_paid = relationship("Expense", back_populates="payer")
    balances = relationship("Balance", foreign_keys="Balance.user_id")

class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    invite_code = Column(String, unique=True, index=True, nullable=True)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    expenses = relationship("Expense", back_populates="group")

class GroupMember(Base):
    __tablename__ = "group_members"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    is_admin = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    amount = Column(Float)
    currency = Column(String, default="INR")
    payer_id = Column(Integer, ForeignKey("users.id"), index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True, index=True)
    split_type = Column(String, default="equal")
    category = Column(String, default="other")
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    payer = relationship("User", back_populates="expenses_paid")
    group = relationship("Group", back_populates="expenses")
    splits = relationship("ExpenseSplit", back_populates="expense")

class ExpenseSplit(Base):
    __tablename__ = "expense_splits"
    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    amount_owed = Column(Float)
    
    expense = relationship("Expense", back_populates="splits")
    user = relationship("User")

class Balance(Base):
    """Tracks simplified debts between users"""
    __tablename__ = "balances"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True) # Person who owes money
    owes_to_user_id = Column(Integer, ForeignKey("users.id"), index=True) # Person who is owed money
    amount = Column(Float)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    owes_to = relationship("User", foreign_keys=[owes_to_user_id])

class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    amount = Column(Float)
    currency = Column(String, default="INR")
    category = Column(String, default="other")
    payer_id = Column(Integer, ForeignKey("users.id"), index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True)
    split_type = Column(String, default="equal")
    frequency = Column(String, default="monthly")
    next_run_date = Column(DateTime, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    payer = relationship("User")
    group = relationship("Group")
    splits = relationship("RecurringExpenseSplit", back_populates="recurring_expense", cascade="all, delete-orphan")

class RecurringExpenseSplit(Base):
    __tablename__ = "recurring_expense_splits"
    id = Column(Integer, primary_key=True, index=True)
    recurring_expense_id = Column(Integer, ForeignKey("recurring_expenses.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    amount_owed = Column(Float)
    
    recurring_expense = relationship("RecurringExpense", back_populates="splits")
    user = relationship("User")
