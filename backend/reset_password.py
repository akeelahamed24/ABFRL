from db import SessionLocal, User
from auth import get_password_hash
import sys

def reset_user_password(email, new_password):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            print(f"User with email {email} not found")
            return False
        
        print(f"Current password hash: {user.password_hash}")
        print(f"Updating password for: {user.email}")
        
        # Hash the new password
        hashed_password = get_password_hash(new_password)
        user.password_hash = hashed_password
        
        db.commit()
        print(f"Password updated successfully for {email}")
        print(f"New hash: {hashed_password}")
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def check_and_fix_all_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            print(f"\nUser: {user.email}")
            print(f"Current hash: {user.password_hash}")
            
            # Check if it's plain text (less than 60 chars and doesn't start with $2)
            if user.password_hash and len(user.password_hash) < 60 and not user.password_hash.startswith('$2'):
                print("⚠️  Detected plain text password! Fixing...")
                # Hash the plain text password
                hashed = get_password_hash(user.password_hash)
                user.password_hash = hashed
                db.commit()
                print(f"Fixed hash: {hashed}")
    
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python reset_password.py <email> <new_password>")
        print("Example: python reset_password.py akeel@gmail.com 123456")
        print("\nOr run check_and_fix_all_users() to fix all plain text passwords")
    else:
        reset_user_password(sys.argv[1], sys.argv[2])