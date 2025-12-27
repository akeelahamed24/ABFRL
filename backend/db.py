# db.py - Fixed Version
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DECIMAL, TIMESTAMP, ForeignKey, JSON, func, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from typing import Optional

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://retail_qtaf_user:XC4ExHINaIfVfbSzU0E6OmJA3EAqZkrj@dpg-d4t7leu3jp1c73e8oj8g-a.oregon-postgres.render.com/retail_qtaf")

# Configure engine with connection pooling and timeout settings
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
    connect_args={
        "connect_timeout": 10,
        "application_name": "ecommerce_api"
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone = Column(String(20))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100))
    postal_code = Column(String(20))
    loyalty_score = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    carts = relationship("Cart", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    dress_category = Column(String(100), nullable=False, index=True)
    occasion = Column(String(100), index=True)
    price = Column(DECIMAL(10, 2), nullable=False)
    stock = Column(Integer, default=0)
    material = Column(String(200))
    available_sizes = Column(String(100))
    colors = Column(String(200))
    image_url = Column(String(500))
    featured_dress = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    carts = relationship("Cart", back_populates="product", cascade="all, delete-orphan")
    order_items = relationship("OrderItem", back_populates="product", cascade="all, delete-orphan")

class Cart(Base):
    __tablename__ = "carts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    added_at = Column(TIMESTAMP, default=datetime.utcnow)
    
    user = relationship("User", back_populates="carts")
    product = relationship("Product", back_populates="carts")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    total_amount = Column(DECIMAL(10, 2), nullable=False)
    tax_amount = Column(DECIMAL(10, 2), default=0)
    shipping_amount = Column(DECIMAL(10, 2), default=0)
    discount_amount = Column(DECIMAL(10, 2), default=0)
    final_amount = Column(DECIMAL(10, 2), nullable=False)
    payment_status = Column(String(20), default="pending")
    payment_method = Column(String(50))
    transaction_id = Column(String(100))
    shipping_address = Column(Text, nullable=False)
    billing_address = Column(Text, nullable=False)
    order_status = Column(String(20), default="processing")
    tracking_number = Column(String(100))
    notes = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    total_price = Column(DECIMAL(10, 2), nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    order = relationship("Order", back_populates="order_items")
    product = relationship("Product", back_populates="order_items")

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String(20), default="active")
    current_agent = Column(String(50))
    context = Column(JSON, default=dict)
    session_metadata = Column(JSON, default=dict)  # Fixed: Added this column

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    agent_tasks = relationship("AgentTask", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), ForeignKey("chat_sessions.session_id", ondelete="CASCADE"), nullable=False)
    message_type = Column(String(20), nullable=False)  # user, assistant, system, agent
    agent_type = Column(String(50))
    content = Column(Text, nullable=False)
    message_metadata = Column(JSON, default=dict)  # Fixed: Changed from metadata to message_metadata
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")

class AgentTask(Base):
    __tablename__ = "agent_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, nullable=False, index=True)
    session_id = Column(String(100), ForeignKey("chat_sessions.session_id", ondelete="CASCADE"), nullable=False)
    agent_type = Column(String(50), nullable=False)
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    parameters = Column(JSON, default=dict)
    result = Column(JSON)
    error_message = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    completed_at = Column(TIMESTAMP)
    processing_time = Column(Integer)  # in seconds

    session = relationship("ChatSession", back_populates="agent_tasks")

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

def get_db_context():
    """Context manager for database sessions with automatic commit/rollback"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

def create_tables():
    """Create all tables in the database"""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
        
        # Verify critical columns exist
        with engine.connect() as conn:
            # Check if session_metadata column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'chat_sessions' 
                AND column_name = 'session_metadata'
            """)).fetchone()
            
            if not result:
                print("⚠️ Warning: session_metadata column might need to be added manually")
                print("Run: ALTER TABLE chat_sessions ADD COLUMN session_metadata JSON DEFAULT '{}'::json")
            
            # Check if message_metadata column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'chat_messages' 
                AND column_name = 'message_metadata'
            """)).fetchone()
            
            if not result:
                print("⚠️ Warning: message_metadata column might need to be added manually")
                print("Run: ALTER TABLE chat_messages ADD COLUMN message_metadata JSON DEFAULT '{}'::json")
                
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        raise e

def check_and_fix_schema():
    """Check and fix any missing columns in the schema"""
    try:
        with engine.connect() as conn:
            # Check for missing columns
            columns_to_check = [
                ("chat_sessions", "session_metadata", "JSON DEFAULT '{}'::json"),
                ("chat_messages", "message_metadata", "JSON DEFAULT '{}'::json")
            ]
            
            for table_name, column_name, column_def in columns_to_check:
                result = conn.execute(text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = '{table_name}' 
                    AND column_name = '{column_name}'
                """)).fetchone()
                
                if not result:
                    print(f"🛠️ Adding missing column: {table_name}.{column_name}")
                    try:
                        conn.execute(text(f"""
                            ALTER TABLE {table_name} 
                            ADD COLUMN {column_name} {column_def}
                        """))
                        conn.commit()
                        print(f"✅ Added {table_name}.{column_name}")
                    except Exception as e:
                        print(f"⚠️ Could not add column {column_name}: {e}")
                        # Try alternative syntax
                        try:
                            conn.execute(text(f"""
                                ALTER TABLE {table_name} 
                                ADD COLUMN {column_name} JSON
                            """))
                            conn.commit()
                            print(f"✅ Added {table_name}.{column_name} with default syntax")
                        except Exception as e2:
                            print(f"❌ Failed to add column {column_name}: {e2}")
        
        print("✅ Schema check completed")
        return True
        
    except Exception as e:
        print(f"❌ Error checking schema: {e}")
        return False

# Call schema check on import
if __name__ != "__main__":
    try:
        check_and_fix_schema()
    except:
        pass  # Silently fail if tables don't exist yet