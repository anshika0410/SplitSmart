from backend.database import SessionLocal
from backend.models import User

def seed_users():
    db = SessionLocal()
    
    # Check if users exist
    if db.query(User).count() > 0:
        print("Users already seeded.")
        return

    users = [
        User(name="Rohan Sharma", email="rohan@example.com", phone_number="+919876543210", upi_vpa="rohan@okhdfcbank"),
        User(name="Amit Kumar", email="amit@example.com", phone_number="+919876543211", upi_vpa="amit@okicici"),
        User(name="Priya Singh", email="priya@example.com", phone_number="+919876543212", upi_vpa="priya@oksbi"),
        User(name="Sneha Gupta", email="sneha@example.com", phone_number="+919876543213", upi_vpa="sneha@okaxis")
    ]
    
    db.add_all(users)
    db.commit()
    print("Successfully seeded users to the database.")

if __name__ == "__main__":
    seed_users()
