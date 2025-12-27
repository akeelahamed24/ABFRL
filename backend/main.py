# main.py - Fixed Version
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any  # Added missing imports
import uuid
from datetime import datetime

from db import get_db, User, Product, Cart, Order, OrderItem, ChatSession, ChatMessage, AgentTask, create_tables
from auth import get_current_user, get_current_admin_user, get_password_hash, verify_password, create_access_token
from checkout_service import get_checkout_service, CheckoutService, CheckoutError
from payment_gateway import payment_gateway, PaymentStatus, PaymentMethod
from chatbot import (
    ChatRequest, ChatResponse, AgentTaskRequest, conv_manager,
    sales_agent, recommendation_agent, inventory_agent,
    payment_agent, fulfillment_agent, loyalty_agent, support_agent,
    error_handler, performance_monitor
)
from pydantic import BaseModel, EmailStr, Field

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    first_name: str
    last_name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    loyalty_score: int
    is_admin: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ProductCreate(BaseModel):
    product_name: str
    description: Optional[str] = None
    dress_category: str
    occasion: Optional[str] = None
    price: float
    stock: int = 0
    material: Optional[str] = None
    available_sizes: Optional[str] = None
    colors: Optional[str] = None
    image_url: Optional[str] = None
    featured_dress: bool = False

class ProductResponse(BaseModel):
    id: int
    product_name: str
    description: Optional[str]
    dress_category: str
    occasion: Optional[str]
    price: float
    stock: int
    material: Optional[str]
    available_sizes: Optional[str]
    colors: Optional[str]
    image_url: Optional[str]
    featured_dress: bool
    created_at: datetime

    class Config:
        from_attributes = True

class PaginatedProductsResponse(BaseModel):
    products: List[ProductResponse]
    total: int
    page: int
    limit: int
    total_pages: int

class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)

class CartItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    price: float
    quantity: int
    total: float
    image_url: Optional[str]
    added_at: datetime
    
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    shipping_address: str
    billing_address: str
    payment_method: str
    notes: Optional[str] = None

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    total_price: float
    
    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    order_number: str
    user_id: int
    total_amount: float
    tax_amount: float
    shipping_amount: float
    discount_amount: float
    final_amount: float
    payment_status: str
    payment_method: Optional[str]
    order_status: str
    shipping_address: str
    billing_address: str
    tracking_number: Optional[str]
    notes: Optional[str]
    created_at: datetime
    order_items: List[OrderItemResponse]
    
    class Config:
        from_attributes = True

class CheckoutRequest(BaseModel):
    shipping_address: str = Field(..., min_length=10)
    billing_address: str = Field(..., min_length=10)
    payment_method: str = Field(..., pattern="^(credit_card|debit_card|net_banking|upi|wallet)$")
    notes: Optional[str] = None
    card_details: Optional[Dict] = None

class CheckoutResponse(BaseModel):
    success: bool
    order_id: Optional[int] = None
    order_number: Optional[str] = None
    final_amount: Optional[float] = None
    payment_result: Optional[Dict] = None
    items: Optional[List[Dict]] = None
    error: Optional[str] = None
    error_type: Optional[str] = None

class PaymentRequest(BaseModel):
    payment_method: str = Field(..., pattern="^(credit_card|debit_card|net_banking|upi|wallet)$")
    card_details: Optional[Dict] = None

class PaymentResponse(BaseModel):
    success: bool
    status: str
    message: str
    transaction_id: Optional[str] = None
    order_id: Optional[int] = None
    order_number: Optional[str] = None

class CancelOrderResponse(BaseModel):
    success: bool
    order_id: int
    order_number: str
    refund_result: Optional[Dict] = None

# Agent Task Response Model (Fixed naming conflict)
class AgentTaskResponseModel(BaseModel):
    task_id: str
    agent_type: str
    user_id: str
    session_id: str
    parameters: Dict[str, Any]
    status: str = "pending"
    result: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True

# Initialize FastAPI app
app = FastAPI(title="Ecommerce Retail API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
@app.on_event("startup")
async def startup_event():
    try:
        create_tables()
        print("Database tables created successfully")
    except Exception as e:
        print(f"Error during startup: {e}")

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "agents": 7, "timestamp": datetime.utcnow()}

# Auth endpoints
@app.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    
    user = User(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        address=user_data.address,
        city=user_data.city,
        state=user_data.state,
        country=user_data.country,
        postal_code=user_data.postal_code
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

@app.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.email == user_data.email, User.is_active == True).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        if not verify_password(user_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password"
            )
        
        access_token = create_access_token(data={"sub": str(user.id)})
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication error: {str(e)}"
        )

@app.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# Product endpoints
@app.get("/products", response_model=PaginatedProductsResponse)
async def get_products(
    db: Session = Depends(get_db),
    category: Optional[str] = None,
    occasion: Optional[str] = None,
    featured: Optional[bool] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    query = db.query(Product)

    if category:
        query = query.filter(Product.dress_category == category)

    if occasion:
        query = query.filter(Product.occasion == occasion)

    if featured is not None:
        query = query.filter(Product.featured_dress == featured)

    if min_price is not None:
        query = query.filter(Product.price >= min_price)

    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    if search:
        query = query.filter(
            (Product.product_name.ilike(f"%{search}%")) |
            (Product.description.ilike(f"%{search}%"))
        )

    # Get total count for pagination
    total = query.count()

    # Calculate offset from page
    offset = (page - 1) * limit

    products = query.order_by(desc(Product.created_at)).offset(offset).limit(limit).all()

    total_pages = (total + limit - 1) // limit  # Ceiling division

    return {
        "products": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@app.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    product = Product(**product_data.dict())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@app.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    for key, value in product_data.dict().items():
        setattr(product, key, value)
    
    db.commit()
    db.refresh(product)
    return product

@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(product)
    db.commit()

# Cart endpoints
@app.get("/cart", response_model=List[CartItemResponse])
async def get_cart_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_items = db.query(Cart, Product).join(
        Product, Cart.product_id == Product.id
    ).filter(Cart.user_id == current_user.id).all()
    
    response = []
    for cart_item, product in cart_items:
        response.append({
            "id": cart_item.id,
            "product_id": product.id,
            "product_name": product.product_name,
            "price": float(product.price),
            "quantity": cart_item.quantity,
            "total": float(product.price) * cart_item.quantity,
            "image_url": product.image_url,
            "added_at": cart_item.added_at
        })
    
    return response

@app.post("/cart", response_model=CartItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_cart(
    cart_data: CartItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if product exists and has stock
    product = db.query(Product).filter(Product.id == cart_data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product.stock < cart_data.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    # Check if item already in cart
    existing_cart_item = db.query(Cart).filter(
        Cart.user_id == current_user.id,
        Cart.product_id == cart_data.product_id
    ).first()
    
    if existing_cart_item:
        existing_cart_item.quantity += cart_data.quantity
        db.commit()
        cart_item = existing_cart_item
    else:
        cart_item = Cart(
            user_id=current_user.id,
            product_id=cart_data.product_id,
            quantity=cart_data.quantity
        )
        db.add(cart_item)
        db.commit()
        db.refresh(cart_item)
    
    return {
        "id": cart_item.id,
        "product_id": product.id,
        "product_name": product.product_name,
        "price": float(product.price),
        "quantity": cart_item.quantity,
        "total": float(product.price) * cart_item.quantity,
        "image_url": product.image_url,
        "added_at": cart_item.added_at
    }

@app.put("/cart/{cart_item_id}")
async def update_cart_item(
    cart_item_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    quantity = data.get('quantity')
    if not quantity or quantity <= 0:
        raise HTTPException(status_code=400, detail="Invalid quantity")
    
    cart_item = db.query(Cart).filter(
        Cart.id == cart_item_id,
        Cart.user_id == current_user.id
    ).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    
    product = db.query(Product).filter(Product.id == cart_item.product_id).first()
    if product.stock < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    cart_item.quantity = quantity
    db.commit()
    
    return {"message": "Cart item updated successfully"}

@app.delete("/cart/{cart_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_cart_item(
    cart_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_item = db.query(Cart).filter(
        Cart.id == cart_item_id,
        Cart.user_id == current_user.id
    ).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    
    db.delete(cart_item)
    db.commit()

@app.delete("/cart", status_code=status.HTTP_204_NO_CONTENT)
async def clear_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Cart).filter(Cart.user_id == current_user.id).delete()
    db.commit()

# Order endpoints
@app.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get cart items
    cart_items = db.query(Cart).filter(Cart.user_id == current_user.id).all()
    
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Calculate totals
    total_amount = 0
    order_items_data = []
    
    for cart_item in cart_items:
        product = db.query(Product).filter(Product.id == cart_item.product_id).first()
        
        if not product or product.stock < cart_item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for product: {product.product_name if product else 'Unknown'}"
            )
        
        item_total = float(product.price) * cart_item.quantity
        total_amount += item_total
        
        order_items_data.append({
            "product_id": product.id,
            "product_name": product.product_name,
            "quantity": cart_item.quantity,
            "unit_price": float(product.price),
            "total_price": item_total
        })
    
    # Apply 10% discount for loyal customers
    discount_rate = 0.1 if current_user.loyalty_score > 1000 else 0
    discount_amount = total_amount * discount_rate
    
    # Calculate tax (assuming 8.875% tax rate)
    tax_rate = 0.08875
    tax_amount = (total_amount - discount_amount) * tax_rate
    
    # Shipping (free over $100)
    shipping_amount = 0 if (total_amount - discount_amount) > 100 else 15.00
    
    final_amount = total_amount - discount_amount + tax_amount + shipping_amount
    
    # Create order
    order = Order(
        order_number=f"LUX-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}",
        user_id=current_user.id,
        total_amount=total_amount,
        tax_amount=tax_amount,
        shipping_amount=shipping_amount,
        discount_amount=discount_amount,
        final_amount=final_amount,
        payment_status="pending",
        payment_method=order_data.payment_method,
        shipping_address=order_data.shipping_address or current_user.address,
        billing_address=order_data.billing_address or current_user.address,
        order_status="processing",
        notes=order_data.notes
    )
    
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Create order items and update stock
    for item_data in order_items_data:
        order_item = OrderItem(
            order_id=order.id,
            **item_data
        )
        db.add(order_item)
        
        # Update product stock
        product = db.query(Product).filter(Product.id == item_data["product_id"]).first()
        product.stock -= item_data["quantity"]
    
    # Clear cart
    db.query(Cart).filter(Cart.user_id == current_user.id).delete()
    
    # Update loyalty score
    current_user.loyalty_score += int(final_amount / 10)
    
    db.commit()
    db.refresh(order)
    
    # Get order with items for response
    order_with_items = db.query(Order).filter(Order.id == order.id).first()
    return order_with_items

@app.get("/orders", response_model=List[OrderResponse])
async def get_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(desc(Order.created_at)).all()
    return orders

@app.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order

@app.put("/orders/{order_id}/cancel")
async def cancel_order_route(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.order_status not in ["processing", "confirmed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel order in current status")
    
    order.order_status = "cancelled"
    order.payment_status = "refunded"
    
    # Restore stock
    order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    for item in order_items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.stock += item.quantity
    
    db.commit()
    return {"message": "Order cancelled successfully"}

# Checkout endpoints
@app.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    checkout_data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Complete checkout flow including cart validation, order creation, and payment processing
    """
    try:
        checkout_service = get_checkout_service(db)
        
        result = checkout_service.complete_checkout(
            user=current_user,
            shipping_address=checkout_data.shipping_address,
            billing_address=checkout_data.billing_address,
            payment_method=checkout_data.payment_method,
            card_details=checkout_data.card_details,
            notes=checkout_data.notes
        )
        
        if result['success']:
            return result
        else:
            # Return detailed error information for frontend handling
            error_response = {
                'success': False,
                'error': result['error'],
                'error_type': result['error_type'],
                'error_details': {
                    'message': result['error'],
                    'type': result['error_type'],
                    'timestamp': datetime.utcnow().isoformat()
                }
            }
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response
            )
            
    except CheckoutError as e:
        error_response = {
            'success': False,
            'error': str(e),
            'error_type': 'checkout_error',
            'error_details': {
                'message': str(e),
                'type': 'checkout_error',
                'timestamp': datetime.utcnow().isoformat()
            }
        }
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response
        )
    except Exception as e:
        print(f"Checkout error: {e}")
        error_response = {
            'success': False,
            'error': f"Checkout failed: {str(e)}",
            'error_type': 'system_error',
            'error_details': {
                'message': str(e),
                'type': 'system_error',
                'timestamp': datetime.utcnow().isoformat()
            }
        }
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

@app.post("/orders/{order_id}/pay", response_model=PaymentResponse)
async def process_payment(
    order_id: int,
    payment_data: PaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process payment for an existing order
    """
    try:
        checkout_service = get_checkout_service(db)
        order = checkout_service.get_order_details(order_id, current_user.id)
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        if order.payment_status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment already processed"
            )
        
        payment_result = checkout_service.process_payment(
            order=order,
            payment_method=payment_data.payment_method,
            card_details=payment_data.card_details
        )
        
        return payment_result
        
    except CheckoutError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Payment processing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment processing failed: {str(e)}"
        )

@app.get("/orders/{order_id}/payment-status")
async def get_payment_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get payment status for an order
    """
    checkout_service = get_checkout_service(db)
    order = checkout_service.get_order_details(order_id, current_user.id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "payment_status": order.payment_status,
        "payment_method": order.payment_method,
        "transaction_id": order.transaction_id,
        "final_amount": float(order.final_amount),
        "order_status": order.order_status
    }

@app.put("/orders/{order_id}/cancel", response_model=CancelOrderResponse)
async def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel an order and process refund if applicable
    """
    try:
        checkout_service = get_checkout_service(db)
        result = checkout_service.cancel_order(order_id, current_user.id)
        
        return result
        
    except CheckoutError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Order cancellation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Order cancellation failed: {str(e)}"
        )

@app.get("/payment-methods")
async def get_payment_methods():
    """
    Get list of supported payment methods
    """
    return payment_gateway.get_supported_payment_methods()

@app.get("/cart/checkout-preview")
async def get_checkout_preview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get checkout preview with totals and validation
    """
    try:
        checkout_service = get_checkout_service(db)
        cart_validation = checkout_service.validate_cart_items(current_user.id)
        
        if not cart_validation['valid_items']:
            return {
                "has_items": False,
                "message": "No valid items in cart"
            }
        
        totals = checkout_service.calculate_order_totals(
            cart_validation,
            current_user,
            current_user.address or "Default Address",
            current_user.address or "Default Address"
        )
        
        return {
            "has_items": True,
            "item_count": cart_validation['item_count'],
            "valid_items": [
                {
                    "product_name": item['product'].product_name,
                    "quantity": item['cart_item'].quantity,
                    "price": float(item['product'].price),
                    "total": item['item_total']
                }
                for item in cart_validation['valid_items']
            ],
            "totals": totals,
            "user_loyalty": {
                "score": current_user.loyalty_score,
                "discount_rate": totals['discount_rate'],
                "discount_amount": totals['discount_amount']
            }
        }
        
    except Exception as e:
        print(f"Checkout preview error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get checkout preview: {str(e)}"
        )

# Admin endpoints
@app.get("/admin/orders", response_model=List[OrderResponse])
async def get_all_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    status_filter: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    query = db.query(Order)
    
    if status_filter:
        query = query.filter(Order.order_status == status_filter)
    
    orders = query.order_by(desc(Order.created_at)).offset(offset).limit(limit).all()
    return orders

@app.put("/admin/orders/{order_id}")
async def update_order_status(
    order_id: int,
    status: str = Query(..., pattern="^(processing|confirmed|shipped|delivered|cancelled)$"),
    tracking_number: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.order_status = status
    if status == "shipped" and tracking_number:
        order.tracking_number = tracking_number
    
    if status == "delivered":
        order.payment_status = "paid"
    
    db.commit()
    return {"message": "Order status updated successfully"}

@app.get("/admin/dashboard")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    total_orders = db.query(func.count(Order.id)).scalar()
    total_revenue = db.query(func.sum(Order.final_amount)).scalar() or 0
    total_users = db.query(func.count(User.id)).scalar()
    total_products = db.query(func.count(Product.id)).scalar()
    
    recent_orders = db.query(Order).order_by(desc(Order.created_at)).limit(5).all()
    
    return {
        "total_orders": total_orders,
        "total_revenue": float(total_revenue),
        "total_users": total_users,
        "total_products": total_products,
        "recent_orders": recent_orders
    }

# Chatbot endpoints
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Main chat endpoint - Intelligent Sales Agent routes to specialized worker agents"""
    start_time = datetime.now()

    try:
        # Validate request
        if not error_handler.validate_chat_request(request):
            return ChatResponse(
                session_id=request.session_id,
                response="I apologize, but I couldn't process your message. Please ensure your message is clear and try again.",
                agent_type="validation_error",
                suggested_actions=[],
                next_steps=["Please rephrase your message", "Contact support if needed"]
            )

        # Sanitize input
        request.message = error_handler.sanitize_message(request.message)

        # Get or create session
        session = conv_manager.get_session(request.session_id, request.user_id, db)
        conv_manager.add_message(request.session_id, "user", request.message, db=db)

        # Step 1: Enhanced Sales Agent analyzes and routes with full context
        task_id = f"task-{request.session_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        performance_monitor.record_task(task_id, "sales_agent", request.session_id, {"message": request.message}, db)

        try:
            sales_response = sales_agent.process_message(
                request.session_id,
                request.user_id,
                request.message,
                session["context"],
                db
            )
            performance_monitor.update_task_status(task_id, "completed", sales_response, db=db)
        except Exception as e:
            performance_monitor.update_task_status(task_id, "failed", error_message=str(e), db=db)
            return ChatResponse(**error_handler.handle_agent_error("sales_agent", e, request.user_id, request.message))

        primary_agent = sales_response.get("primary_agent", "recommendation")
        response_text = sales_response.get("response_to_user", "I'd be happy to help you!")
        suggested_actions = []

        # Step 2: Route to specialized worker agents with enhanced intelligence
        agent_task_id = f"agent-{primary_agent}-{request.session_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        try:
            performance_monitor.record_task(agent_task_id, primary_agent, request.session_id,
                                          sales_response.get("parameters", {}), db)

            if primary_agent == "sales_agent":
                # Sales agent handles directly, no additional processing needed
                suggested_actions = [
                    {"action": "view_orders", "label": "View All Orders"},
                    {"action": "contact_support", "label": "Get Help"}
                ]

            elif primary_agent == "recommendation":
                rec_params = sales_response.get("parameters", {}).copy()
                rec_params["user_message"] = request.message  # Pass the original user message for filtering
                rec_result = recommendation_agent.get_recommendations(
                    request.user_id,
                    rec_params,
                    db
                )
                response_text = rec_result.get("personalized_message", response_text)
                suggested_actions = [
                    {
                        "action": "view_product",
                        "product_id": rec["product_id"],
                        "label": rec["name"],
                        "name": rec["name"],
                        "price": rec["price"],
                        "category": rec["category"],
                        "image_url": rec["image_url"],
                        "description": rec["description"]
                    }
                    for rec in rec_result.get("recommendations", [])[:4]
                ]

            elif primary_agent == "inventory":
                product_id = sales_response.get("parameters", {}).get("product_id")
                if product_id:
                    inv_result = inventory_agent.check_availability(
                        product_id,
                        sales_response.get("parameters", {}).get("location"),
                        db
                    )
                    response_text = f"Here's the availability information for your item."
                    suggested_actions = [
                        {"action": "select_delivery", "type": opt["type"], "label": opt["title"]}
                        for opt in inv_result.get("delivery_options", [])[:2]
                    ]
                else:
                    response_text = "I'd be happy to check availability for you! Which product are you interested in?"

            elif primary_agent == "payment":
                pay_result = payment_agent.process_payment(
                    sales_response.get("parameters", {}).get("order_id", "ORD-001"),
                    sales_response.get("parameters", {}).get("payment_method", "credit_card"),
                    sales_response.get("parameters", {}).get("amount", 100.00),
                    db=db
                )
                response_text = pay_result.get("confirmation_message", "Payment processed successfully!")
                if pay_result.get("payment_status") == "success":
                    suggested_actions = [
                        {"action": "view_order", "order_id": pay_result.get("order_id"), "label": "View Order Details"},
                        {"action": "track_delivery", "label": "Track Your Order"}
                    ]

            elif primary_agent == "fulfillment":
                fulfill_result = fulfillment_agent.schedule_delivery(
                    sales_response.get("parameters", {}).get("order_id", "ORD-001"),
                    sales_response.get("parameters", {}).get("delivery_type", "home_delivery"),
                    sales_response.get("parameters", {}).get("location", "user_address"),
                    db=db
                )
                response_text = fulfill_result.get("confirmation_message", "Your delivery has been scheduled!")
                suggested_actions = [
                    {"action": "track_order", "tracking_number": fulfill_result.get("logistics_details", {}).get("tracking_number"), "label": "Track Your Order"}
                ]

            elif primary_agent == "loyalty":
                cart_value = sales_response.get("parameters", {}).get("cart_value", 0)
                loyalty_result = loyalty_agent.apply_offers(
                    request.user_id,
                    cart_value,
                    db=db
                )
                response_text = loyalty_result.get("message", "Your loyalty benefits have been applied!")
                suggested_actions = [
                    {"action": "view_loyalty_status", "label": "Check Loyalty Status"},
                    {"action": "apply_offers", "label": "Apply More Offers"}
                ]

            elif primary_agent == "support":
                support_result = support_agent.handle_support(
                    sales_response.get("parameters", {}).get("order_id", ""),
                    sales_response.get("parameters", {}).get("issue_type", "general"),
                    db=db
                )
                response_text = support_result.get("message", "I'm here to help resolve your issue!")
                suggested_actions = [
                    {"action": "create_ticket", "ticket_id": support_result.get("support_ticket_id"), "label": "View Support Ticket"},
                    {"action": "contact_support", "label": "Contact Support Team"}
                ]

            performance_monitor.update_task_status(agent_task_id, "completed", {"response": response_text}, db=db)

        except Exception as e:
            # Handle agent-specific errors
            performance_monitor.update_task_status(agent_task_id, "failed", error_message=str(e), db=db)
            error_response = error_handler.handle_agent_error(primary_agent, e, request.user_id, request.message)
            return ChatResponse(**error_response)

        # Update conversation context with enhanced information
        conv_manager.update_context(request.session_id, {
            "last_agent": primary_agent,
            "last_intent": sales_response.get("user_intent", "general_query"),
            "emotional_state": sales_response.get("emotional_state", "neutral"),
            "urgency_level": sales_response.get("urgency_level", "medium"),
            "query_category": sales_response.get("query_category", "GENERAL_INQUIRY"),
            "last_interaction": datetime.now().isoformat()
        }, db)

        conv_manager.add_message(request.session_id, "assistant", response_text, primary_agent, db)

        return ChatResponse(
            session_id=request.session_id,
            response=response_text,
            agent_type=primary_agent,
            suggested_actions=suggested_actions,
            next_steps=sales_response.get("next_steps", [])
        )

    except Exception as e:
        # Global error handling
        print(f"Critical chatbot error: {str(e)}")
        return ChatResponse(
            session_id=request.session_id,
            response="I apologize, but I'm experiencing technical difficulties. Please try again in a moment or contact our support team for immediate assistance.",
            agent_type="system_error",
            suggested_actions=[
                {"action": "contact_support", "label": "Contact Support"},
                {"action": "retry_later", "label": "Try Again Later"}
            ],
            next_steps=["Please try your request again", "Contact customer support at +91-1800-123-4567"]
        )

@app.post("/agent/task")
async def create_agent_task(task: AgentTaskRequest, db: Session = Depends(get_db)):
    """Create a specific task for a worker agent"""
    # Record the task in database
    db_task = performance_monitor.record_task(
        task.task_id,
        task.agent_type,
        task.session_id,
        task.parameters,
        db
    )

    agents = {
        "recommendation": recommendation_agent,
        "inventory": inventory_agent,
        "payment": payment_agent,
        "fulfillment": fulfillment_agent,
        "loyalty": loyalty_agent,
        "support": support_agent
    }

    if task.agent_type not in agents:
        performance_monitor.update_task_status(task.task_id, "failed", error_message="Invalid agent type", db=db)
        raise HTTPException(status_code=400, detail="Invalid agent type")

    agent = agents[task.agent_type]

    try:
        # Execute agent-specific task
        if task.agent_type == "recommendation":
            result = agent.get_recommendations(task.user_id, task.parameters, db)
        elif task.agent_type == "inventory":
            result = agent.check_availability(
                task.parameters.get("product_id"),
                task.parameters.get("location"),
                db
            )
        elif task.agent_type == "payment":
            result = agent.process_payment(
                task.parameters.get("order_id"),
                task.parameters.get("payment_method"),
                task.parameters.get("amount"),
                db
            )
        elif task.agent_type == "fulfillment":
            result = agent.schedule_delivery(
                task.parameters.get("order_id"),
                task.parameters.get("delivery_type"),
                task.parameters.get("location"),
                db
            )
        elif task.agent_type == "loyalty":
            result = agent.apply_offers(
                task.user_id,
                task.parameters.get("cart_value"),
                db
            )
        elif task.agent_type == "support":
            result = agent.handle_support(
                task.parameters.get("order_id"),
                task.parameters.get("issue_type"),
                db
            )

        # Update task as completed
        performance_monitor.update_task_status(task.task_id, "completed", result, db=db)

        return {
            "task_id": task.task_id,
            "status": "completed",
            "result": result,
            "completed_at": datetime.now()
        }

    except Exception as e:
        # Update task as failed
        performance_monitor.update_task_status(task.task_id, "failed", error_message=str(e), db=db)
        raise HTTPException(status_code=500, detail=f"Agent task failed: {str(e)}")

@app.get("/session/{session_id}")
async def get_session_history(session_id: str, db: Session = Depends(get_db)):
    """Get conversation history for a session"""
    session_history = conv_manager.get_session_history(session_id, db)
    if not session_history:
        raise HTTPException(status_code=404, detail="Session not found")

    return session_history

@app.delete("/session/{session_id}")
async def delete_session(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a chat session and all related data"""
    try:
        # Verify the session belongs to the current user
        session = db.query(ChatSession).filter(
            ChatSession.session_id == session_id,
            ChatSession.user_id == current_user.id
        ).first()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Delete the session and all related data
        conv_manager.delete_session(session_id, db)

        return {"message": "Session deleted successfully"}

    except Exception as e:
        print(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

@app.get("/agents/status")
async def get_agents_status(db: Session = Depends(get_db)):
    """Check status and performance of all agents"""
    performance_report = performance_monitor.get_performance_report(db)

    agent_statuses = {}
    for agent_name in ["sales_agent", "recommendation_agent", "inventory_agent",
                      "payment_agent", "fulfillment_agent", "loyalty_agent", "support_agent"]:
        health_status = performance_monitor.get_agent_health_status(agent_name, db)
        agent_statuses[agent_name] = {
            "status": health_status["status"],
            "health_message": health_status["message"],
            "performance": health_status["metrics"],
            "capabilities": {
                "sales_agent": ["intelligent_routing", "context_analysis", "emotional_intelligence"],
                "recommendation_agent": ["personalized_suggestions", "trend_analysis", "bundle_creation"],
                "inventory_agent": ["real_time_stock", "multi_location_check", "delivery_optimization"],
                "payment_agent": ["secure_processing", "fraud_detection", "multi_gateway_support"],
                "fulfillment_agent": ["smart_scheduling", "logistics_coordination", "tracking_integration"],
                "loyalty_agent": ["tier_management", "personalized_offers", "gamification"],
                "support_agent": ["issue_resolution", "escalation_handling", "customer_satisfaction"]
            }.get(agent_name, [])
        }

    # Get active sessions count from database
    active_sessions_count = db.query(ChatSession).filter(ChatSession.status == "active").count()

    return {
        "agents": agent_statuses,
        "system_performance": performance_report["overall"],
        "last_updated": datetime.now().isoformat(),
        "active_sessions": active_sessions_count
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)