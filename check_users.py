from backend.database import SessionLocal
from backend.models import User

def check_users():
    db = SessionLocal()
    users = db.query(User).all()
    print("Users in DB:", [{"id": u.id, "name": u.name} for u in users])

if __name__ == "__main__":
    check_users()
