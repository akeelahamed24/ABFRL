# add_metadata_columns_v2.py
from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://retail_qtaf_user:XC4ExHINaIfVfbSzU0E6OmJA3EAqZkrj@dpg-d4t7leu3jp1c73e8oj8g-a.oregon-postgres.render.com/retail_qtaf"
)

engine = create_engine(DATABASE_URL)

def run_migration():
    with engine.begin() as conn:  # auto-commit / rollback
        try:
            print("🔧 Running database migration...")

            # chat_sessions → session_metadata
            conn.execute(text("""
                ALTER TABLE chat_sessions
                ADD COLUMN IF NOT EXISTS session_metadata JSONB
                DEFAULT '{}'::jsonb
            """))
            print("✅ chat_sessions.session_metadata ensured")

            # chat_messages → message_metadata
            conn.execute(text("""
                ALTER TABLE chat_messages
                ADD COLUMN IF NOT EXISTS message_metadata JSONB
                DEFAULT '{}'::jsonb
            """))
            print("✅ chat_messages.message_metadata ensured")

            print("🎉 Migration completed successfully")

        except Exception as e:
            print(f"❌ Migration failed: {e}")
            raise  # ensures rollback

if __name__ == "__main__":
    run_migration()
