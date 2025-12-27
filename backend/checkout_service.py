from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
import uuid
import logging

from db import User, Product, Cart, Order, OrderItem, SessionLocal, get_db_context
from payment_gateway import payment_gateway, PaymentStatus, PaymentMethod
from auth import get_current_user

logger = logging.getLogger(__name__)

class CheckoutError(Exception):
    """Custom exception for checkout-related errors"""
    pass

class CheckoutService:
    """
    Service class for handling the complete checkout flow
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.payment_gateway = payment_gateway
     
    def validate_cart_items(self, user_id: int) -> Dict[str, Any]:
        """
        Validate cart items and calculate totals
        
        Returns:
            Dict containing cart validation result and totals
        """
        cart_items = self.db.query(Cart).filter(Cart.user_id == user_id).all()
        
        if not cart_items:
            raise CheckoutError("Cart is empty")
        
        validation_result = {
            'valid_items': [],
            'invalid_items': [],
            'total_amount': 0,
            'item_count': 0
        }
        
        for cart_item in cart_items:
            product = self.db.query(Product).filter(Product.id == cart_item.product_id).first()
            
            if not product:
                validation_result['invalid_items'].append({
                    'cart_item_id': cart_item.id,
                    'reason': 'Product not found'
                })
                continue
            
            if product.stock < cart_item.quantity:
                validation_result['invalid_items'].append({
                    'cart_item_id': cart_item.id,
                    'product_name': product.product_name,
                    'available_stock': product.stock,
                    'requested_quantity': cart_item.quantity,
                    'reason': 'Insufficient stock'
                })
                continue
            
            item_total = float(product.price) * cart_item.quantity
            validation_result['valid_items'].append({
                'cart_item': cart_item,
                'product': product,
                'item_total': item_total
            })
            validation_result['total_amount'] += item_total
            validation_result['item_count'] += cart_item.quantity
        
        return validation_result
    
    def calculate_order_totals(
        self, 
        cart_validation: Dict[str, Any], 
        user: User, 
        shipping_address: str, 
        billing_address: str
    ) -> Dict[str, float]:
        """
        Calculate order totals including taxes, shipping, and discounts
        
        Returns:
            Dict containing all calculated amounts
        """
        subtotal = cart_validation['total_amount']
        
        # Apply loyalty discount (10% for loyal customers)
        loyalty_score = user.loyalty_score
        discount_rate = 0.10 if loyalty_score > 1000 else 0.05 if loyalty_score > 500 else 0.0
        discount_amount = subtotal * discount_rate
        
        # Calculate tax (8.875% for luxury items)
        tax_rate = 0.08875
        taxable_amount = subtotal - discount_amount
        tax_amount = taxable_amount * tax_rate
        
        # Calculate shipping (free over ₹1000)
        shipping_amount = 0 if taxable_amount > 1000 else 199.00
        
        # Calculate final amount
        final_amount = taxable_amount + tax_amount + shipping_amount
        
        return {
            'subtotal': subtotal,
            'discount_amount': discount_amount,
            'discount_rate': discount_rate,
            'tax_amount': tax_amount,
            'shipping_amount': shipping_amount,
            'final_amount': final_amount
        }
    
    def create_order(
        self,
        user: User,
        cart_validation: Dict[str, Any],
        totals: Dict[str, float],
        shipping_address: str,
        billing_address: str,
        payment_method: str,
        notes: Optional[str] = None
    ) -> Order:
        """
        Create an order with all its items
        
        Returns:
            Created Order object
        """
        # Generate unique order number
        order_number = f"LUX-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Create order
        order = Order(
            order_number=order_number,
            user_id=user.id,
            total_amount=totals['subtotal'],
            tax_amount=totals['tax_amount'],
            shipping_amount=totals['shipping_amount'],
            discount_amount=totals['discount_amount'],
            final_amount=totals['final_amount'],
            payment_status="pending",
            payment_method=payment_method,
            shipping_address=shipping_address,
            billing_address=billing_address,
            order_status="processing",
            notes=notes
        )
        
        self.db.add(order)
        self.db.flush()  # Get order ID before committing
        
        # Create order items and update stock
        for item_data in cart_validation['valid_items']:
            cart_item = item_data['cart_item']
            product = item_data['product']
            item_total = item_data['item_total']

            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.product_name,
                quantity=cart_item.quantity,
                unit_price=float(product.price),
                total_price=item_total
            )

            self.db.add(order_item)

            # Update product stock
            product.stock -= cart_item.quantity

        # Update user loyalty score
        user.loyalty_score += int(totals['final_amount'] / 10)
        
        self.db.commit()
        self.db.refresh(order)
        
        return order
    
    def process_payment(
        self,
        order: Order,
        payment_method: str,
        card_details: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Process payment for an order
        
        Returns:
            Dict containing payment result
        """
        try:
            # Validate payment method
            supported_methods = self.payment_gateway.get_supported_payment_methods()
            if payment_method not in supported_methods:
                raise CheckoutError(f"Unsupported payment method: {payment_method}")
            
            # Validate card details if required
            if payment_method in ['credit_card', 'debit_card'] and not card_details:
                raise CheckoutError("Card details required for card payments")
            
            if card_details:
                is_valid, message = self.payment_gateway.validate_card_details(card_details)
                if not is_valid:
                    raise CheckoutError(f"Invalid card details: {message}")
            
            # Process payment
            payment_status, message, transaction_id = self.payment_gateway.process_payment(
                amount=order.final_amount,
                payment_method=payment_method,
                card_details=card_details
            )
            
            # Update order with payment result
            if payment_status == PaymentStatus.SUCCESS:
                order.payment_status = "paid"
            else:
                order.payment_status = payment_status.value
            if transaction_id:
                order.transaction_id = transaction_id
            
            if payment_status == PaymentStatus.SUCCESS:
                order.order_status = "confirmed"
                result_message = f"Payment successful! Transaction ID: {transaction_id}"
            elif payment_status == PaymentStatus.FAILED:
                # Keep order status as "processing" so user can retry payment
                result_message = f"Payment failed: {message}"
            else:
                result_message = f"Payment {payment_status.value}: {message}"
            
            self.db.commit()
            
            return {
                'success': payment_status == PaymentStatus.SUCCESS,
                'status': payment_status.value,
                'message': result_message,
                'transaction_id': transaction_id,
                'order_id': order.id,
                'order_number': order.order_number
            }
            
        except Exception as e:
            logger.error(f"Payment processing error: {str(e)}")
            raise CheckoutError(f"Payment processing failed: {str(e)}")
    
    def complete_checkout(
        self,
        user: User,
        shipping_address: str,
        billing_address: str,
        payment_method: str,
        card_details: Optional[Dict] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete the entire checkout flow
        
        Returns:
            Dict containing checkout result
        """
        try:
            # Step 1: Validate cart items
            cart_validation = self.validate_cart_items(user.id)
            
            if not cart_validation['valid_items']:
                raise CheckoutError("No valid items in cart")
            
            # Step 2: Calculate totals
            totals = self.calculate_order_totals(cart_validation, user, shipping_address, billing_address)
            
            # Step 3: Create order
            order = self.create_order(
                user=user,
                cart_validation=cart_validation,
                totals=totals,
                shipping_address=shipping_address,
                billing_address=billing_address,
                payment_method=payment_method,
                notes=notes
            )
            
            # Step 4: Process payment
            payment_result = self.process_payment(order, payment_method, card_details)

            # Clear cart only if payment was successful
            if payment_result['success']:
                self.db.query(Cart).filter(Cart.user_id == user.id).delete()
                self.db.commit()

            return {
                'success': payment_result['success'],
                'order_id': order.id,
                'order_number': order.order_number,
                'final_amount': totals['final_amount'],
                'payment_result': payment_result,
                'items': [
                    {
                        'product_name': item['product'].product_name,
                        'quantity': item['cart_item'].quantity,
                        'price': float(item['product'].price),
                        'total': item['item_total']
                    }
                    for item in cart_validation['valid_items']
                ]
            }
            
        except CheckoutError as e:
            self.db.rollback()
            return {
                'success': False,
                'error': str(e),
                'error_type': 'checkout_error'
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"Checkout error: {str(e)}")
            return {
                'success': False,
                'error': f"Checkout failed: {str(e)}",
                'error_type': 'system_error'
            }
    
    def get_order_details(self, order_id: int, user_id: int) -> Optional[Order]:
        """
        Get order details for a specific user
        """
        return self.db.query(Order).filter(
            Order.id == order_id,
            Order.user_id == user_id
        ).first()
    
    def cancel_order(self, order_id: int, user_id: int) -> Dict[str, Any]:
        """
        Cancel an order and process refund if payment was successful
        """
        order = self.get_order_details(order_id, user_id)
        
        if not order:
            raise CheckoutError("Order not found")
        
        if order.order_status not in ["processing", "confirmed"]:
            raise CheckoutError("Cannot cancel order in current status")
        
        # Process refund if payment was successful
        refund_result = None
        if order.payment_status == "success":
            refund_status, refund_message = self.payment_gateway.refund_payment(
                order.transaction_id,
                order.final_amount
            )
            
            refund_result = {
                'status': refund_status.value,
                'message': refund_message,
                'amount': order.final_amount
            }
        
        # Update order status
        order.order_status = "cancelled"
        order.payment_status = "refunded" if refund_result else "cancelled"
        
        # Restore stock
        order_items = self.db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        for item in order_items:
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                product.stock += item.quantity
        
        self.db.commit()
        
        return {
            'success': True,
            'order_id': order.id,
            'order_number': order.order_number,
            'refund_result': refund_result
        }

def get_checkout_service(db: Session) -> CheckoutService:
    """Factory function to create checkout service"""
    return CheckoutService(db)