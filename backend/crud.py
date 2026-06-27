from sqlalchemy.orm import Session
from . import models, schemas
import datetime
from dateutil.relativedelta import relativedelta

# Users
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        name=user.name, 
        email=user.email, 
        phone_number=user.phone_number,
        upi_vpa=user.upi_vpa
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Groups
import uuid

def get_groups(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Group).offset(skip).limit(limit).all()

def create_group(db: Session, group: schemas.GroupCreate, creator_id: int):
    # Generate a unique invite code
    invite_code = str(uuid.uuid4())[:8]
    db_group = models.Group(name=group.name, description=group.description, invite_code=invite_code)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    
    # Add creator as admin
    add_user_to_group(db, db_group.id, creator_id, is_admin=True)
    
    return db_group

def add_user_to_group(db: Session, group_id: int, user_id: int, is_admin: bool = False):
    # Check if already a member
    existing = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id, 
        models.GroupMember.user_id == user_id
    ).first()
    if existing:
        return existing
        
    db_member = models.GroupMember(group_id=group_id, user_id=user_id, is_admin=is_admin)
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member
def get_group_by_invite_code(db: Session, invite_code: str):
    return db.query(models.Group).filter(models.Group.invite_code == invite_code).first()

def get_group_members(db: Session, group_id: int):
    # Returns User objects that belong to the group
    members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
    user_ids = [m.user_id for m in members]
    return db.query(models.User).filter(models.User.id.in_(user_ids)).all()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        name=user.name,
        email=user.email,
        phone_number=user.phone_number,
        upi_vpa=user.upi_vpa
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_groups(db: Session, user_id: int, archived: bool = False):
    # Returns Group objects the user belongs to
    memberships = db.query(models.GroupMember).filter(models.GroupMember.user_id == user_id).all()
    group_ids = [m.group_id for m in memberships]
    return db.query(models.Group).filter(
        models.Group.id.in_(group_ids),
        models.Group.is_archived == archived
    ).all()

# Expenses
def create_expense(db: Session, expense: schemas.ExpenseCreate):
    db_expense = models.Expense(
        description=expense.description,
        amount=expense.amount,
        currency=expense.currency,
        payer_id=expense.payer_id,
        group_id=expense.group_id,
        split_type=expense.split_type,
        category=expense.category
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    # Create splits
    for split in expense.splits:
        db_split = models.ExpenseSplit(
            expense_id=db_expense.id,
            user_id=split.user_id,
            amount_owed=split.amount_owed
        )
        db.add(db_split)
    
    db.commit()
    db.refresh(db_expense)
    
    # Update balances (simplified logic to add debts)
    # This just records the direct debts. In a real app, we'd trigger the Min Cash Flow algorithm here or via a background job.
    for split in expense.splits:
        if split.user_id != expense.payer_id:
            # Check if balance exists
            existing_balance = db.query(models.Balance).filter(
                models.Balance.user_id == split.user_id,
                models.Balance.owes_to_user_id == expense.payer_id,
                models.Balance.group_id == expense.group_id
            ).first()
            
            if existing_balance:
                existing_balance.amount += split.amount_owed
            else:
                new_balance = models.Balance(
                    user_id=split.user_id,
                    owes_to_user_id=expense.payer_id,
                    amount=split.amount_owed,
                    group_id=expense.group_id
                )
                db.add(new_balance)
    
    db.commit()
    
    return db_expense

# Recurring Expenses
import datetime
from dateutil.relativedelta import relativedelta

def create_recurring_expense(db: Session, recurring_expense: schemas.RecurringExpenseCreate):
    db_recurring = models.RecurringExpense(
        description=recurring_expense.description,
        amount=recurring_expense.amount,
        currency=recurring_expense.currency,
        category=recurring_expense.category,
        payer_id=recurring_expense.payer_id,
        group_id=recurring_expense.group_id,
        split_type=recurring_expense.split_type,
        frequency=recurring_expense.frequency,
        next_run_date=recurring_expense.next_run_date,
        is_active=recurring_expense.is_active
    )
    db.add(db_recurring)
    db.commit()
    db.refresh(db_recurring)
    
    for split in recurring_expense.splits:
        db_split = models.RecurringExpenseSplit(
            recurring_expense_id=db_recurring.id,
            user_id=split.user_id,
            amount_owed=split.amount_owed
        )
        db.add(db_split)
    
    db.commit()
    db.refresh(db_recurring)
    return db_recurring

def process_recurring_expenses(db: Session):
    now = datetime.datetime.utcnow()
    due_expenses = db.query(models.RecurringExpense).filter(
        models.RecurringExpense.is_active == True,
        models.RecurringExpense.next_run_date <= now
    ).all()
    
    processed_count = 0
    for re in due_expenses:
        # Create an actual expense
        expense_create = schemas.ExpenseCreate(
            description=f"{re.description} ({re.next_run_date.strftime('%b %Y')})",
            amount=re.amount,
            currency=re.currency,
            payer_id=re.payer_id,
            group_id=re.group_id,
            split_type=re.split_type,
            splits=[
                schemas.ExpenseSplitCreate(user_id=s.user_id, amount_owed=s.amount_owed)
                for s in re.splits
            ]
        )
        # Call the existing create_expense to handle splits and balances
        create_expense(db, expense_create)
        processed_count += 1
        
        # Advance the next_run_date
        if re.frequency == "daily":
            re.next_run_date += relativedelta(days=1)
        elif re.frequency == "weekly":
            re.next_run_date += relativedelta(weeks=1)
        elif re.frequency == "monthly":
            re.next_run_date += relativedelta(months=1)
            
    db.commit()
    return processed_count

def update_group(db: Session, group_id: int, group_update: schemas.GroupCreate):
    db_group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if db_group:
        db_group.name = group_update.name
        db_group.description = group_update.description
        db.commit()
        db.refresh(db_group)
    return db_group

def delete_group(db: Session, group_id: int):
    # Cascading delete
    
    # 1. Delete all group members
    db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).delete(synchronize_session=False)
    
    # 2. Delete all balances associated with the group
    db.query(models.Balance).filter(models.Balance.group_id == group_id).delete(synchronize_session=False)
    
    # 3. Delete expenses and their splits
    expenses = db.query(models.Expense).filter(models.Expense.group_id == group_id).all()
    if expenses:
        expense_ids = [e.id for e in expenses]
        db.query(models.ExpenseSplit).filter(models.ExpenseSplit.expense_id.in_(expense_ids)).delete(synchronize_session=False)
        db.query(models.Expense).filter(models.Expense.id.in_(expense_ids)).delete(synchronize_session=False)
        
    # 4. Delete recurring expenses and their splits
    recurring_expenses = db.query(models.RecurringExpense).filter(models.RecurringExpense.group_id == group_id).all()
    if recurring_expenses:
        rec_ids = [r.id for r in recurring_expenses]
        db.query(models.RecurringExpenseSplit).filter(models.RecurringExpenseSplit.recurring_expense_id.in_(rec_ids)).delete(synchronize_session=False)
        db.query(models.RecurringExpense).filter(models.RecurringExpense.id.in_(rec_ids)).delete(synchronize_session=False)

    # 5. Finally, delete the group itself
    db.query(models.Group).filter(models.Group.id == group_id).delete(synchronize_session=False)
    
    db.commit()
    return True

def archive_group(db: Session, group_id: int):
    db_group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if db_group:
        db_group.is_archived = True
        db.commit()
        db.refresh(db_group)
    return db_group

def unarchive_group(db: Session, group_id: int):
    db_group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if db_group:
        db_group.is_archived = False
        db.commit()
        db.refresh(db_group)
    return db_group

def remove_user_from_group(db: Session, group_id: int, user_id: int):
    result = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id, 
        models.GroupMember.user_id == user_id
    ).delete(synchronize_session=False)
    db.commit()
    return result > 0
