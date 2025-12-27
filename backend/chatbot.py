# chatbot.py - Fixed Version
import os
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, Depends
from pydantic import BaseModel, Field
import requests
from datetime import datetime
import json
import re
from sqlalchemy.orm import Session
import uuid
from datetime import timedelta
from sqlalchemy import desc, func

# Import from db
from db import get_db, User, Product, Cart, Order, OrderItem, ChatSession, ChatMessage, AgentTask

# OpenRouter configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "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")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_NAME = "mistralai/devstral-2512:free"

def call_openrouter(prompt: str) -> str:
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": MODEL_NAME,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7
    }
    response = requests.post(OPENROUTER_URL, headers=headers, json=data)
    if response.status_code == 200:
        return response.json()["choices"][0]["message"]["content"].strip()
    else:
        raise Exception(f"OpenRouter API error: {response.status_code} - {response.text}")

# Pydantic Models
class ChatRequest(BaseModel):
    session_id: str
    user_id: str
    message: str
    context: Optional[Dict[str, Any]] = {}

class ChatResponse(BaseModel):
    session_id: str
    response: str
    agent_type: str
    suggested_actions: Optional[List[Dict[str, Any]]] = []
    next_steps: Optional[List[str]] = []

class AgentTaskRequest(BaseModel):  # Renamed to avoid conflict with SQLAlchemy model
    task_id: str
    agent_type: str
    user_id: str
    session_id: str
    parameters: Dict[str, Any]
    status: str = "pending"

# Core Agent Classes - FIXED VERSION
class SalesAgent:
    def __init__(self):
        self.name = "Sales Agent"
        self.agent_type = "sales_agent"

    def process_message(self, session_id: str, user_id: str, message: str, context: Dict, db: Session) -> Dict:
        try:
            # Get user profile from database
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                print(f"User not found: {user_id}")
                return self._get_fallback_response()

            # Get user's order history
            user_orders = db.query(Order).filter(Order.user_id == int(user_id)).order_by(desc(Order.created_at)).limit(10).all()
            
            order_history = []
            preferred_categories = set()
            total_spent = 0

            for order in user_orders:
                total_spent += float(order.final_amount)
                for item in order.order_items:
                    if hasattr(item, 'product'):
                        product_info = {
                            "product_name": item.product_name,
                            "category": item.product.dress_category if item.product else "Unknown",
                            "occasion": item.product.occasion if item.product else "Unknown",
                            "price": float(item.unit_price),
                            "date": order.created_at.isoformat() if order.created_at else datetime.now().isoformat()
                        }
                        order_history.append(product_info)
                        if item.product and item.product.dress_category:
                            preferred_categories.add(item.product.dress_category)

            user_profile = {
                "loyalty_score": user.loyalty_score,
                "preferred_categories": list(preferred_categories),
                "location": f"{user.city}, {user.state}" if user.city else "Not specified",
                "total_orders": len(user_orders),
                "total_spent": total_spent,
                "last_order_date": user_orders[0].created_at.isoformat() if user_orders else None,
                "avg_order_value": total_spent / len(user_orders) if user_orders else 0
            }

            # Check if this is a recommendation request
            is_recommendation = any(keyword in message.lower() for keyword in [
                'recommend', 'suggest', 'show me', 'what should i', 'looking for', 'need', 'want',
                'summer', 'party', 'casual', 'formal', 'wedding', 'dress', 'outfit', 'clothes'
            ])

            # Check if this is a general support query
            is_general_support = any(keyword in message.lower() for keyword in [
                'size guide', 'size', 'measurement', 'fit', 'contact', 'help', 'support',
                'return policy', 'exchange', 'refund'
            ])

            if is_recommendation:
                return {
                    "primary_agent": "recommendation",
                    "secondary_agents": [],
                    "user_intent": "product recommendation request",
                    "emotional_state": "neutral",
                    "urgency_level": "medium",
                    "query_category": "RECOMMENDATION",
                    "parameters": {"user_id": user_id, "user_message": message},
                    "personalization_notes": [],
                    "response_to_user": "I'd be happy to recommend some products for you!",
                    "next_steps": ["Show product recommendations"],
                    "suggested_questions": []
                }

            if is_general_support:
                issue_type = "size_guide" if "size" in message.lower() else "general"
                return {
                    "primary_agent": "support",
                    "secondary_agents": [],
                    "user_intent": "general support inquiry",
                    "emotional_state": "neutral",
                    "urgency_level": "low",
                    "query_category": "SUPPORT",
                    "parameters": {"user_id": user_id, "issue_type": issue_type},
                    "personalization_notes": [],
                    "response_to_user": "I'll help you with that!",
                    "next_steps": ["Provide support information"],
                    "suggested_questions": []
                }

            # Check if this is an order tracking request
            is_order_tracking = any(keyword in message.lower() for keyword in ['track', 'status', 'where is', 'delivery', 'shipping'])

            if is_order_tracking and user_orders:
                # Handle order tracking directly
                recent_order = user_orders[0]  # Most recent order
                response_text = f"I can see your most recent order #{recent_order.order_number} from {recent_order.created_at.strftime('%B %d, %Y')}. It's currently {recent_order.order_status}. "
                if recent_order.tracking_number:
                    response_text += f"Your tracking number is {recent_order.tracking_number}."
                else:
                    response_text += "We'll provide a tracking number once it's shipped."

                if len(user_orders) > 1:
                    response_text += f" You have {len(user_orders)} total orders. Would you like details on a specific order?"

                return {
                    "primary_agent": "sales_agent",
                    "secondary_agents": [],
                    "user_intent": "order tracking inquiry",
                    "emotional_state": "neutral",
                    "urgency_level": "medium",
                    "query_category": "ORDER_TRACKING",
                    "parameters": {"user_id": user_id, "order_id": recent_order.id},
                    "personalization_notes": [],
                    "response_to_user": response_text,
                    "next_steps": ["Check order status", "Provide tracking info"],
                    "suggested_questions": ["Need details on another order?", "Want to check delivery status?"]
                }

            # Enhanced intent analysis with simpler prompt
            prompt = f"""You are a Sales Agent for a fashion e-commerce store.

USER MESSAGE: "{message}"

USER PROFILE DATA (use this exact data, do not make up or assume anything):
- User ID: {user_id}
- Loyalty Score: {user_profile['loyalty_score']}
- Preferred Categories: {', '.join(user_profile['preferred_categories']) if user_profile['preferred_categories'] else 'None'}
- Location: {user_profile['location']}
- Total Orders: {user_profile['total_orders']}
- Total Spent: ₹{user_profile['total_spent']:.2f}
- Last Order Date: {user_profile['last_order_date'] or 'None'}

IMPORTANT: Use ONLY the data provided above. Do not invent user IDs, categories, or any other information.

ANALYZE the user's message and determine the best agent to handle it.

Available agents:
1. recommendation - For product suggestions and styling advice
2. inventory - For stock availability and delivery options
3. payment - For payment processing and transactions
4. fulfillment - For scheduling new deliveries (not for tracking existing orders)
5. loyalty - For discounts, coupons, and rewards
6. support - For returns, exchanges, and general customer service (NOT for order tracking)

Return ONLY valid JSON with no comments, no extra text. Format:
{{
    "primary_agent": "recommendation|inventory|payment|fulfillment|loyalty|support",
    "user_intent": "brief description",
    "emotional_state": "neutral|happy|frustrated|urgent",
    "parameters": {{"user_id": "{user_id}"}},
    "response_to_user": "Helpful initial response",
    "next_steps": ["step1", "step2"]
}}"""

            try:
                response_text = call_openrouter(prompt)
                
                # Clean the response to ensure valid JSON
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                
                result = json.loads(response_text)
                
                # Ensure required fields exist
                if 'primary_agent' not in result:
                    result['primary_agent'] = 'recommendation'
                if 'response_to_user' not in result:
                    result['response_to_user'] = "I'd be happy to help you with that!"
                    
                return {
                    "primary_agent": result["primary_agent"],
                    "secondary_agents": [],
                    "user_intent": result.get("user_intent", "general inquiry"),
                    "emotional_state": result.get("emotional_state", "neutral"),
                    "urgency_level": "medium",
                    "query_category": "GENERAL_INQUIRY",
                    "parameters": result.get("parameters", {}),
                    "personalization_notes": [],
                    "response_to_user": result["response_to_user"],
                    "next_steps": result.get("next_steps", ["I'll help you find what you need"]),
                    "suggested_questions": []
                }
                
            except json.JSONDecodeError as e:
                print(f"JSON parse error: {e}, Response: {response_text}")
                return self._get_fallback_response()
                
        except Exception as e:
            print(f"Sales Agent error: {e}")
            return self._get_fallback_response()

    def _get_fallback_response(self) -> Dict:
        return {
            "primary_agent": "recommendation",
            "secondary_agents": [],
            "user_intent": "general shopping assistance",
            "emotional_state": "neutral",
            "urgency_level": "medium",
            "query_category": "GENERAL_INQUIRY",
            "parameters": {},
            "personalization_notes": [],
            "response_to_user": "I'm here to help you find the perfect items. What are you looking for today?",
            "next_steps": ["Gather more details", "Provide recommendations"],
            "suggested_questions": ["What type of clothing interests you?", "Do you have a specific occasion in mind?"]
        }


class RecommendationAgent:
    def __init__(self):
        self.name = "Recommendation Agent"
        self.agent_type = "recommendation_agent"

    def get_recommendations(self, user_id: str, parameters: Dict, db: Session) -> Dict:
        try:
            # Get user data
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                return {"error": "User not found"}

            # Get user preferences from order history
            user_orders = db.query(Order).filter(Order.user_id == int(user_id)).order_by(desc(Order.created_at)).limit(5).all()
            preferred_categories = set()
            for order in user_orders:
                for item in order.order_items:
                    if item.product:
                        preferred_categories.add(item.product.dress_category)

            # Smart product selection based on query and preferences
            query = db.query(Product).filter(Product.stock > 0)

            # Filter by user message keywords
            user_message = parameters.get('user_message', '').lower()
            if 'summer' in user_message or 'beach' in user_message:
                query = query.filter(Product.occasion.ilike('%summer%'))
            elif 'party' in user_message or 'evening' in user_message:
                query = query.filter(Product.occasion.ilike('%party%'))
            elif 'casual' in user_message or 'daily' in user_message:
                query = query.filter(Product.occasion.ilike('%casual%'))
            elif 'wedding' in user_message or 'formal' in user_message:
                query = query.filter(Product.occasion.ilike('%wedding%'))

            # Prioritize preferred categories
            if preferred_categories:
                preferred_products = query.filter(Product.dress_category.in_(list(preferred_categories))).limit(10).all()
                other_products = query.filter(~Product.dress_category.in_(list(preferred_categories))).limit(10).all()
                available_products = preferred_products + other_products
            else:
                available_products = query.order_by(func.random()).limit(20).all()

            if not available_products:
                return {
                    "recommendations": [],
                    "bundles": [],
                    "styling_advice": ["Check back soon for new arrivals!"],
                    "alternative_options": {},
                    "personalized_message": "We're currently updating our collection. Please check back soon!",
                    "next_best_actions": ["Browse categories", "Check new arrivals"]
                }

            # Ensure we have diverse products (not just the first few)
            import random
            selected_products = random.sample(available_products, min(15, len(available_products)))

            product_catalog = []
            for product in selected_products:
                product_catalog.append({
                    "id": product.id,
                    "name": product.product_name,
                    "category": product.dress_category,
                    "occasion": product.occasion,
                    "price": float(product.price),
                    "description": product.description[:100] if product.description else "No description",
                    "colors": product.colors,
                    "sizes": product.available_sizes,
                    "stock": product.stock,
                    "image_url": product.image_url or "/placeholder.svg"
                })

            # Simple prompt for recommendations
            prompt = f"""Suggest 3-4 fashion products from this catalog:

PRODUCT CATALOG:
{json.dumps(product_catalog, indent=2)}

USER REQUEST PARAMETERS:
{json.dumps(parameters, indent=2)}

IMPORTANT: Use ONLY product IDs and data from the PRODUCT CATALOG above. Do not invent products.

Return ONLY valid JSON with no comments, no extra text. Format:
{{
    "recommendations": [
        {{
            "product_id": "123",
            "name": "Product Name",
            "description": "Why this is a good choice",
            "price": 1999.00,
            "reason": "Matches user preferences",
            "styling_suggestion": "How to wear it",
            "availability": "in_stock"
        }}
    ],
    "personalized_message": "Here are some great options for you!",
    "next_best_actions": ["View details", "Add to cart"]
}}"""

            response_text = call_openrouter(prompt)

            # Clean JSON response
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]

            # Try to parse JSON, with fallback
            try:
                result = json.loads(response_text.strip())
            except json.JSONDecodeError:
                # Clean the response: remove comments and fix common issues
                cleaned_text = re.sub(r'//.*', '', response_text)  # Remove // comments
                cleaned_text = re.sub(r'/\*.*?\*/', '', cleaned_text, flags=re.DOTALL)  # Remove /* */ comments
                cleaned_text = cleaned_text.strip()

                try:
                    result = json.loads(cleaned_text)
                except json.JSONDecodeError:
                    # If still fails, try to extract JSON from the response
                    json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
                    if json_match:
                        try:
                            result = json.loads(json_match.group())
                        except json.JSONDecodeError:
                            result = {}
                    else:
                        result = {}
            
            # Ensure recommendations exist
            if 'recommendations' not in result:
                result['recommendations'] = []

            # Process recommendations and add full product details
            processed_recommendations = []
            for rec in result.get("recommendations", [])[:4]:
                product_id = rec.get('product_id')
                if product_id:
                    # Find the full product details
                    product_details = next((p for p in product_catalog if str(p['id']) == str(product_id)), None)
                    if product_details:
                        processed_recommendations.append({
                            "product_id": str(product_details['id']),
                            "name": product_details['name'],
                            "description": rec.get('description', product_details['description']),
                            "price": product_details['price'],
                            "category": product_details['category'],
                            "image_url": product_details['image_url'],
                            "reason": rec.get('reason', 'Great choice for you'),
                            "styling_suggestion": rec.get('styling_suggestion', 'Versatile and stylish'),
                            "availability": "in_stock"
                        })

            # If AI didn't return good recommendations, use the first 4 products
            if len(processed_recommendations) < 3:
                for product in product_catalog[:4]:
                    if not any(r['product_id'] == str(product['id']) for r in processed_recommendations):
                        processed_recommendations.append({
                            "product_id": str(product['id']),
                            "name": product['name'],
                            "description": product['description'],
                            "price": product['price'],
                            "category": product['category'],
                            "image_url": product['image_url'],
                            "reason": "Popular choice",
                            "styling_suggestion": "Perfect for any occasion",
                            "availability": "in_stock"
                        })

            return {
                "recommendations": processed_recommendations[:4],
                "bundles": result.get("bundles", []),
                "styling_advice": result.get("styling_advice", ["Mix and match with your existing wardrobe"]),
                "alternative_options": result.get("alternative_options", {}),
                "personalized_message": result.get("personalized_message", "Here are some items you might like!"),
                "next_best_actions": result.get("next_best_actions", ["Browse more", "Check sizing"])
            }
            
        except Exception as e:
            print(f"Recommendation Agent error: {e}")
            # Fallback to random available products
            available_products = db.query(Product).filter(Product.stock > 0).order_by(func.random()).limit(4).all()
            fallback_recommendations = []

            for product in available_products:
                fallback_recommendations.append({
                    "product_id": str(product.id),
                    "name": product.product_name,
                    "description": product.description[:100] if product.description else "Popular choice",
                    "price": float(product.price),
                    "category": product.dress_category,
                    "image_url": product.image_url or "/placeholder.svg",
                    "reason": "Popular among customers",
                    "styling_suggestion": "Versatile piece for any occasion",
                    "availability": "in_stock"
                })
            
            return {
                "recommendations": fallback_recommendations,
                "bundles": [],
                "styling_advice": ["These items work well with most wardrobes"],
                "alternative_options": {},
                "personalized_message": "Here are some popular items from our collection!",
                "next_best_actions": ["View product details", "Add to cart"]
            }


class InventoryAgent:
    def __init__(self):
        self.name = "Inventory Agent"
        self.agent_type = "inventory_agent"

    def check_availability(self, product_id: str, location: str = None, db: Session = None) -> Dict:
        try:
            product = db.query(Product).filter(Product.id == int(product_id)).first()
            if not product:
                return {"error": "Product not found"}

            # Simple availability response
            delivery_options = [
                {
                    "type": "standard_delivery",
                    "title": "Standard Delivery",
                    "description": "3-5 business days",
                    "estimated_time": "3-5 days",
                    "cost": "Free (on orders above ₹999)",
                    "recommended": True
                },
                {
                    "type": "express_delivery",
                    "title": "Express Delivery",
                    "description": "1-2 business days",
                    "estimated_time": "1-2 days",
                    "cost": "₹100",
                    "recommended": False
                }
            ]

            return {
                "product_id": product_id,
                "product_name": product.product_name,
                "total_stock": product.stock,
                "availability_status": "in_stock" if product.stock > 0 else "out_of_stock",
                "warehouse_stock": product.stock,
                "store_availability": [],
                "size_availability": {"S": "in_stock", "M": "in_stock", "L": "in_stock", "XL": "in_stock"},
                "color_availability": {"Black": "in_stock", "White": "in_stock"},
                "delivery_options": delivery_options,
                "alternative_products": [],
                "recommendation": {
                    "best_option": "standard_delivery",
                    "reason": "Most cost-effective option",
                    "urgency_note": "Product is available"
                },
                "last_updated": datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Inventory Agent error: {e}")
            return {
                "product_id": product_id,
                "error": "Could not check availability",
                "availability_status": "unknown",
                "last_updated": datetime.now().isoformat()
            }


class PaymentAgent:
    def __init__(self):
        self.name = "Payment Agent"
        self.agent_type = "payment_agent"

    def process_payment(self, order_id: str, payment_method: str, amount: float, db: Session = None) -> Dict:
        try:
            order = db.query(Order).filter(Order.id == int(order_id)).first()
            if not order:
                return {"error": "Order not found"}

            # Simulate payment processing
            transaction_id = f"TXN-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
            
            return {
                "order_id": order_id,
                "order_number": order.order_number,
                "payment_status": "success",
                "transaction_id": transaction_id,
                "method": payment_method,
                "amount_processed": amount,
                "processing_fee": 0.00,
                "total_charged": amount,
                "failure_reason": None,
                "retry_options": [],
                "security_checks": {
                    "risk_score": "low",
                    "fraud_detected": False,
                    "verification_required": False
                },
                "confirmation_message": f"Payment of ₹{amount:.2f} processed successfully! Order #{order.order_number} is confirmed.",
                "next_steps": [
                    "Order confirmation email sent",
                    "Tracking information will be shared soon"
                ],
                "receipt_details": {
                    "transaction_date": datetime.now().isoformat(),
                    "payment_method_details": "Transaction completed",
                    "merchant_reference": order.order_number
                },
                "processed_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Payment Agent error: {e}")
            return {
                "order_id": order_id,
                "payment_status": "failed",
                "error": str(e),
                "confirmation_message": "Payment processing failed. Please try again.",
                "retry_options": ["Try again", "Use different payment method"]
            }


class FulfillmentAgent:
    def __init__(self):
        self.name = "Fulfillment Agent"
        self.agent_type = "fulfillment_agent"

    def schedule_delivery(self, order_id: str, delivery_type: str, location: str, db: Session = None) -> Dict:
        try:
            order = db.query(Order).filter(Order.id == int(order_id)).first()
            if not order:
                return {"error": "Order not found"}

            # Generate time slots
            time_slots = []
            for day in range(1, 8):
                date = datetime.now() + timedelta(days=day)
                time_slots.append({
                    "date": date.strftime('%Y-%m-%d'),
                    "time": "10:00-18:00",
                    "available": True,
                    "recommended": day == 2,  # Recommend 2 days from now
                    "cost": "Free"
                })

            tracking_number = f"DLV{order_id}{datetime.now().strftime('%Y%m%d')}"

            return {
                "order_id": order_id,
                "order_number": order.order_number,
                "delivery_type": delivery_type,
                "fulfillment_status": "scheduled",
                "scheduled_slots": time_slots[:3],
                "selected_slot": time_slots[1] if len(time_slots) > 1 else time_slots[0],
                "logistics_details": {
                    "carrier": "Delhivery",
                    "tracking_number": tracking_number,
                    "estimated_weight": 0.5,
                    "packaging_type": "premium_box",
                    "insurance_covered": True
                },
                "delivery_options": [
                    {
                        "type": "standard_delivery",
                        "title": "Standard Delivery",
                        "description": "3-5 business days",
                        "estimated_delivery": (datetime.now() + timedelta(days=5)).strftime('%B %d, %Y'),
                        "cost": "Free",
                        "recommended": True
                    }
                ],
                "confirmation_message": f"Delivery scheduled for order #{order.order_number}! Tracking number: {tracking_number}",
                "next_steps": ["Tracking info will be shared", "Delivery partner will contact you"],
                "scheduled_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Fulfillment Agent error: {e}")
            return {
                "order_id": order_id,
                "error": "Could not schedule delivery",
                "confirmation_message": "Delivery scheduling is temporarily unavailable."
            }


class LoyaltyAgent:
    def __init__(self):
        self.name = "Loyalty Agent"
        self.agent_type = "loyalty_agent"

    def apply_offers(self, user_id: str, cart_value: float, db: Session = None) -> Dict:
        try:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                return {"error": "User not found"}

            # Calculate loyalty benefits
            loyalty_score = user.loyalty_score
            discount_rate = min(loyalty_score / 5000, 0.2)  # Max 20% discount
            discount_amount = cart_value * discount_rate
            final_price = cart_value - discount_amount

            return {
                "user_id": user_id,
                "loyalty_tier": self._calculate_tier(loyalty_score),
                "loyalty_score": loyalty_score,
                "points_earned": int(cart_value / 100),
                "points_used": 0,
                "coupons_applied": [],
                "loyalty_discount": {
                    "type": "percentage",
                    "value": discount_rate * 100,
                    "reason": f"Loyalty discount",
                    "applied_amount": discount_amount
                },
                "final_price": final_price,
                "total_savings": discount_amount,
                "savings_breakdown": {
                    "loyalty_discount": discount_amount,
                    "seasonal_discount": 0,
                    "coupon_discount": 0,
                    "bundle_savings": 0
                },
                "message": f"As a loyal customer, you save ₹{discount_amount:.0f}! Final price: ₹{final_price:.0f}",
                "urgency_elements": ["Offer valid today"]
            }
            
        except Exception as e:
            print(f"Loyalty Agent error: {e}")
            return {
                "user_id": user_id,
                "error": "Could not apply offers",
                "message": "Loyalty benefits are temporarily unavailable."
            }

    def _calculate_tier(self, score: int) -> str:
        if score >= 10000:
            return "Platinum"
        elif score >= 5000:
            return "Gold"
        elif score >= 1000:
            return "Silver"
        else:
            return "Bronze"


class SupportAgent:
    def __init__(self):
        self.name = "Support Agent"
        self.agent_type = "support_agent"

    def handle_support(self, order_id: str, issue_type: str, db: Session = None) -> Dict:
        try:
            # Handle general support queries that don't require an order
            if issue_type in ["size_guide", "general", "contact", "help"] or not order_id or order_id == "ORD-001":
                return self._handle_general_support(issue_type)

            # Handle order-specific support
            try:
                order = db.query(Order).filter(Order.id == int(order_id)).first()
            except ValueError:
                # order_id is not a valid integer, treat as general support
                return self._handle_general_support(issue_type)

            if not order:
                return self._handle_general_support(issue_type)

            ticket_id = f"SUP-{order_id}-{datetime.now().strftime('%Y%m%d%H%M')}"

            return {
                "order_id": order_id,
                "order_number": order.order_number,
                "issue_type": issue_type,
                "priority": "medium",
                "support_ticket_id": ticket_id,
                "resolution_status": "investigating",
                "resolution_steps": [
                    {
                        "step": 1,
                        "action": "Issue logged",
                        "status": "completed",
                        "completed_at": datetime.now().isoformat()
                    }
                ],
                "return_options": {
                    "eligible": True,
                    "timeframe": "30 days",
                    "free_return": True
                },
                "tracking_info": {
                    "current_status": order.order_status,
                    "tracking_number": order.tracking_number
                },
                "contact_options": {
                    "phone": "+91-1800-123-4567",
                    "email": "support@stylish.com"
                },
                "message": f"Support ticket #{ticket_id} created. We're investigating your issue with order #{order.order_number}.",
                "next_actions": ["Check email for updates", "Contact support if urgent"],
                "created_at": datetime.now().isoformat(),
                "agent": "AI Support Assistant"
            }

        except Exception as e:
            print(f"Support Agent error: {e}")
            return self._handle_general_support(issue_type)

    def _handle_general_support(self, issue_type: str) -> Dict:
        """Handle general support queries that don't require an order"""
        responses = {
            "size_guide": {
                "message": "Here's our size guide to help you find the perfect fit! 📏\n\n• XS: Bust 32-33\", Waist 24-25\", Hips 34-35\"\n• S: Bust 34-35\", Waist 26-27\", Hips 36-37\"\n• M: Bust 36-37\", Waist 28-29\", Hips 38-39\"\n• L: Bust 38-39\", Waist 30-31\", Hips 40-41\"\n• XL: Bust 40-41\", Waist 32-33\", Hips 42-43\"\n\nFor more detailed measurements, visit our website or contact support.",
                "next_actions": ["Visit website for detailed guide", "Contact support for specific sizing help"]
            },
            "contact": {
                "message": "You can reach our customer support team:\n\n📞 Phone: +91-1800-123-4567\n📧 Email: support@stylish.com\n💬 Live Chat: Available 9 AM - 9 PM IST\n\nWe're here to help!",
                "next_actions": ["Call support", "Send email", "Use live chat"]
            },
            "general": {
                "message": "I'm here to help! How can I assist you today? You can ask me about:\n\n• Product recommendations\n• Order tracking\n• Size guide\n• Returns & exchanges\n• Payment issues\n• General support",
                "next_actions": ["Ask about products", "Track order", "Get size help"]
            }
        }

        response = responses.get(issue_type, responses["general"])
        return {
            "issue_type": issue_type,
            "priority": "low",
            "resolution_status": "completed",
            "message": response["message"],
            "next_actions": response["next_actions"],
            "contact_options": {
                "phone": "+91-1800-123-4567",
                "email": "support@stylish.com"
            },
            "created_at": datetime.now().isoformat(),
            "agent": "AI Support Assistant"
        }


# Initialize agents
sales_agent = SalesAgent()
recommendation_agent = RecommendationAgent()
inventory_agent = InventoryAgent()
payment_agent = PaymentAgent()
fulfillment_agent = FulfillmentAgent()
loyalty_agent = LoyaltyAgent()
support_agent = SupportAgent()


class ChatbotErrorHandler:
    @staticmethod
    def handle_agent_error(agent_name: str, error: Exception, user_id: str, message: str) -> Dict:
        error_responses = {
            "sales_agent": {
                "response": "I'm having trouble understanding your request. Could you please rephrase?",
                "agent_type": "general_support",
                "suggested_actions": [
                    {"action": "view_products", "label": "Browse Products"},
                    {"action": "contact_support", "label": "Contact Support"}
                ]
            },
            "recommendation_agent": {
                "response": "I'd love to help you find items! Could you tell me what you're looking for?",
                "agent_type": "recommendation",
                "suggested_actions": [
                    {"action": "browse_categories", "label": "Browse Categories"},
                    {"action": "view_trending", "label": "See Trending"}
                ]
            },
            "inventory_agent": {
                "response": "I'm checking inventory. Would you like me to show you available items?",
                "agent_type": "inventory",
                "suggested_actions": [
                    {"action": "view_available", "label": "See Available Items"},
                    {"action": "check_another", "label": "Check Another Item"}
                ]
            },
            "payment_agent": {
                "response": "Payment processing issue. Please try again or contact support.",
                "agent_type": "payment_support",
                "suggested_actions": [
                    {"action": "retry_payment", "label": "Retry Payment"},
                    {"action": "contact_support", "label": "Get Help"}
                ]
            },
            "fulfillment_agent": {
                "response": "Delivery scheduling issue. Your order is being processed.",
                "agent_type": "fulfillment",
                "suggested_actions": [
                    {"action": "check_status", "label": "Check Order Status"}
                ]
            },
            "loyalty_agent": {
                "response": "Loyalty benefits are being calculated. You'll receive your discounts.",
                "agent_type": "loyalty",
                "suggested_actions": [
                    {"action": "view_loyalty", "label": "Check Loyalty Status"}
                ]
            },
            "support_agent": {
                "response": "Support system issue. Please contact our team directly.",
                "agent_type": "support",
                "suggested_actions": [
                    {"action": "call_support", "label": "Call Support"},
                    {"action": "email_support", "label": "Email Support"}
                ]
            }
        }

        fallback = error_responses.get(agent_name, {
            "response": "I'm experiencing technical issues. Please try again.",
            "agent_type": "general_support",
            "suggested_actions": []
        })

        print(f"Chatbot Error in {agent_name}: {str(error)}")

        return {
            "session_id": f"error-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "response": fallback["response"],
            "agent_type": fallback["agent_type"],
            "suggested_actions": fallback["suggested_actions"],
            "next_steps": ["Please try again", "Contact support if issue persists"],
            "error_occurred": True
        }

    @staticmethod
    def validate_chat_request(request: ChatRequest) -> bool:
        if not request.session_id or not request.user_id or not request.message:
            return False
        if len(request.message.strip()) < 1 or len(request.message.strip()) > 1000:
            return False
        return True

    @staticmethod
    def sanitize_message(message: str) -> str:
        sanitized = message.strip()
        sanitized = ' '.join(sanitized.split())
        if len(sanitized) > 500:
            sanitized = sanitized[:500] + "..."
        return sanitized


class DatabaseConversationManager:
    def __init__(self):
        self.max_sessions_per_user = 10
        self.session_timeout_hours = 24

    def get_session(self, session_id: str, user_id: str, db: Session = None) -> Dict:
        if not db:
            raise ValueError("Database session required")

        # Clean up expired sessions
        self._cleanup_expired_sessions(db)

        # Try to find existing session
        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()

        if not session:
            # Check session count
            active_count = db.query(ChatSession).filter(
                ChatSession.user_id == int(user_id),
                ChatSession.status == "active"
            ).count()

            if active_count >= self.max_sessions_per_user:
                # Remove oldest
                oldest = db.query(ChatSession).filter(
                    ChatSession.user_id == int(user_id),
                    ChatSession.status == "active"
                ).order_by(ChatSession.created_at).first()
                if oldest:
                    oldest.status = "expired"
                    db.commit()

            # Create new session
            session = ChatSession(
                session_id=session_id,
                user_id=int(user_id),
                status="active",
                context={
                    "user_profile": {},
                    "current_task": None,
                    "conversation_state": "initial"
                },
                session_metadata={
                    "total_messages": 0,
                    "agent_usage": {},
                    "topics_discussed": []
                }
            )
            db.add(session)
            db.commit()
            db.refresh(session)

        # Update activity
        session.updated_at = datetime.now()
        db.commit()

        return self._session_to_dict(session)

    def add_message(self, session_id: str, role: str, content: str, agent: str = None, db: Session = None):
        if not db:
            raise ValueError("Database session required")

        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Create message
        message = ChatMessage(
            session_id=session_id,
            message_type=role,
            agent_type=agent,
            content=content,
            message_metadata={}  # Fixed: changed from metadata to message_metadata
        )
        db.add(message)

        # Update session metadata
        session.updated_at = datetime.now()
        metadata = session.session_metadata or {}
        metadata["total_messages"] = metadata.get("total_messages", 0) + 1
        
        if agent:
            agent_usage = metadata.get("agent_usage", {})
            agent_usage[agent] = agent_usage.get(agent, 0) + 1
            metadata["agent_usage"] = agent_usage
        
        session.session_metadata = metadata
        db.commit()

    def update_context(self, session_id: str, updates: Dict, db: Session = None):
        if not db:
            raise ValueError("Database session required")

        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        context = session.context or {}
        context.update(updates)
        session.context = context
        session.updated_at = datetime.now()
        db.commit()

    def get_session_history(self, session_id: str, db: Session = None) -> Dict:
        if not db:
            raise ValueError("Database session required")

        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not session:
            return {}

        messages = db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id
        ).order_by(ChatMessage.created_at).all()

        return {
            "session": self._session_to_dict(session),
            "messages": [
                {
                    "id": msg.id,
                    "type": msg.message_type,
                    "agent": msg.agent_type,
                    "content": msg.content,
                    "timestamp": msg.created_at.isoformat(),
                    "metadata": msg.message_metadata
                } for msg in messages
            ]
        }

    def end_session(self, session_id: str, db: Session = None):
        if not db:
            raise ValueError("Database session required")

        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if session:
            session.status = "completed"
            session.updated_at = datetime.now()
            db.commit()

    def delete_session(self, session_id: str, db: Session = None):
        if not db:
            raise ValueError("Database session required")

        # Delete agent tasks first (due to foreign key constraints)
        db.query(AgentTask).filter(AgentTask.session_id == session_id).delete()

        # Delete messages
        db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()

        # Delete the session itself
        db.query(ChatSession).filter(ChatSession.session_id == session_id).delete()

        db.commit()

    def _session_to_dict(self, session: ChatSession) -> Dict:
        return {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "status": session.status,
            "current_agent": session.current_agent,
            "context": session.context or {},
            "metadata": session.session_metadata or {}
        }

    def _cleanup_expired_sessions(self, db: Session):
        cutoff_time = datetime.now() - timedelta(hours=self.session_timeout_hours)
        
        expired_sessions = db.query(ChatSession).filter(
            ChatSession.status == "active",
            ChatSession.updated_at < cutoff_time
        ).all()

        for session in expired_sessions:
            session.status = "expired"

        if expired_sessions:
            db.commit()


class DatabaseAgentPerformanceMonitor:
    def record_task(self, task_id: str, agent_name: str, session_id: str, parameters: Dict, db: Session = None):
        if not db:
            raise ValueError("Database session required")

        task = AgentTask(
            task_id=task_id,
            session_id=session_id,
            agent_type=agent_name,
            status="pending",
            parameters=parameters
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    def update_task_status(self, task_id: str, status: str, result: Dict = None, error_message: str = None, db: Session = None):
        if not db:
            raise ValueError("Database session required")

        task = db.query(AgentTask).filter(AgentTask.task_id == task_id).first()
        if not task:
            return

        task.status = status
        if result:
            task.result = result
        if error_message:
            task.error_message = error_message

        if status in ["completed", "failed"]:
            task.completed_at = datetime.now()
            if task.created_at:
                task.processing_time = int((task.completed_at - task.created_at).total_seconds())

        db.commit()

    def get_performance_report(self, db: Session = None) -> Dict:
        if not db:
            raise ValueError("Database session required")

        from sqlalchemy import func
        
        total_tasks = db.query(AgentTask).count()
        completed_tasks = db.query(AgentTask).filter(AgentTask.status == "completed").count()
        failed_tasks = db.query(AgentTask).filter(AgentTask.status == "failed").count()

        agent_stats = db.query(
            AgentTask.agent_type,
            func.count(AgentTask.id).label('total'),
            func.avg(AgentTask.processing_time).label('avg_time')
        ).group_by(AgentTask.agent_type).all()

        agent_metrics = {}
        for stat in agent_stats:
            agent_name = stat.agent_type
            total = stat.total
            completed = db.query(AgentTask).filter(
                AgentTask.agent_type == agent_name,
                AgentTask.status == "completed"
            ).count()

            agent_metrics[agent_name] = {
                "requests": total,
                "successes": completed,
                "errors": total - completed,
                "avg_response_time": float(stat.avg_time) if stat.avg_time else 0
            }

        return {
            "overall": {
                "total_requests": total_tasks,
                "success_rate": (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0,
                "error_rate": (failed_tasks / total_tasks * 100) if total_tasks > 0 else 0,
                "avg_response_time": db.query(func.avg(AgentTask.processing_time)).scalar() or 0
            },
            "agents": agent_metrics,
            "generated_at": datetime.now().isoformat()
        }


# Initialize managers
error_handler = ChatbotErrorHandler()
conv_manager = DatabaseConversationManager()
performance_monitor = DatabaseAgentPerformanceMonitor()