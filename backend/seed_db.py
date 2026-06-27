import os
import sys

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal, engine
from backend.models import Base, User, Group, GroupMember
def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if group 1 already exists
    if db.query(Group).filter(Group.id == 1).first():
        print("Database already seeded.")
        return

    # Create mock users
    users = [
        User(id=1, email="rahul@example.com", name="Rahul"),
        User(id=2, email="aman@example.com", name="Aman"),
        User(id=3, email="priya@example.com", name="Priya"),
        User(id=4, email="vikas@example.com", name="Vikas")
    ]
    
    for u in users:
        # Avoid duplicate email errors
        if not db.query(User).filter(User.email == u.email).first():
            db.add(u)
    
    db.commit()

    # Create mock group
    group = Group(id=1, name="Goa Trip", description="Mock group for testing AI")
    db.add(group)
    db.commit()

    # Add users to group
    members = [
        GroupMember(group_id=1, user_id=1),
        GroupMember(group_id=1, user_id=2),
        GroupMember(group_id=1, user_id=3),
        GroupMember(group_id=1, user_id=4)
    ]
    
    for m in members:
        db.add(m)
        
    db.commit()
    print("Successfully seeded the database with mock group and members!")

if __name__ == "__main__":
    seed()
