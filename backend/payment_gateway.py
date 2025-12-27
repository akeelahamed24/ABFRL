from typing import Dict, Optional, Tuple
from datetime import datetime
import random
import uuid
from enum import Enum

class PaymentStatus(Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"

class PaymentMethod(Enum):
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    NET_BANKING = "net_banking"
    UPI = "upi"
    WALLET = "wallet"

class PaymentGateway:
    """
    Simulated payment gateway for processing payments
    """
    
    def __init__(self):
        # Simulated bank response rates
        self.success_rate = 0.85  # 85% success rate
        self.failure_rate = 0.10  # 10% failure rate
        self.timeout_rate = 0.05  # 5% timeout rate
     
    def process_payment(
        self, 
        amount: float, 
        payment_method: str, 
        card_details: Optional[Dict] = None
    ) -> Tuple[PaymentStatus, str, Optional[str]]:
        """
        Process a payment and return status, message, and transaction ID
        
        Args:
            amount: Payment amount
            payment_method: Payment method type
            card_details: Card details for card payments
        
        Returns:
            Tuple of (status, message, transaction_id)
        """
        # Validate amount
        if amount <= 0:
            return PaymentStatus.FAILED, "Invalid payment amount", None
        
        # Validate payment method
        if payment_method not in self.get_supported_payment_methods():
            return PaymentStatus.FAILED, f"Unsupported payment method: {payment_method}", None
        
        # Validate card details for card payments
        if payment_method in ['credit_card', 'debit_card'] and card_details:
            is_valid, message = self.validate_card_details(card_details)
            if not is_valid:
                return PaymentStatus.FAILED, f"Invalid card details: {message}", None
        
        # Simulate processing time
        import time
        time.sleep(1)  # Simulate 1 second processing time
        
        # Generate transaction ID
        transaction_id = f"TXN-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Determine payment outcome based on random probability
        random_value = random.random()
        
        if random_value < self.success_rate:
            # Payment successful
            return PaymentStatus.SUCCESS, "Payment successful", transaction_id
        elif random_value < self.success_rate + self.failure_rate:
            # Payment failed
            failure_reasons = [
                "Insufficient funds",
                "Card declined by bank",
                "Invalid card details",
                "Security verification failed",
                "Bank system temporarily unavailable"
            ]
            return PaymentStatus.FAILED, random.choice(failure_reasons), transaction_id
        else:
            # Payment timeout
            return PaymentStatus.FAILED, "Payment processing timeout", transaction_id
    
    def refund_payment(
        self, 
        transaction_id: str, 
        amount: float
    ) -> Tuple[PaymentStatus, str]:
        """
        Process a refund for a payment
        
        Args:
            transaction_id: Original transaction ID
            amount: Refund amount
        
        Returns:
            Tuple of (status, message)
        """
        # Validate transaction ID
        if not transaction_id or not transaction_id.startswith("TXN-"):
            return PaymentStatus.FAILED, "Invalid transaction ID"
        
        # Validate amount
        if amount <= 0:
            return PaymentStatus.FAILED, "Invalid refund amount"
        
        # Simulate processing time
        import time
        time.sleep(0.5)  # Simulate 0.5 second processing time
        
        # 95% success rate for refunds
        if random.random() < 0.95:
            return PaymentStatus.REFUNDED, f"Refund of ₹{amount:.2f} processed successfully"
        else:
            return PaymentStatus.FAILED, "Refund processing failed"
    
    def validate_card_details(self, card_details: Dict) -> Tuple[bool, str]:
        """
        Validate card details format
        
        Args:
            card_details: Dictionary containing card information
        
        Returns:
            Tuple of (is_valid, message)
        """
        required_fields = ['card_number', 'expiry_month', 'expiry_year', 'cvv']
        
        for field in required_fields:
            if field not in card_details:
                return False, f"Missing required field: {field}"
        
        # Validate card number format (16 digits)
        card_number = str(card_details['card_number'])
        if not card_number.isdigit() or len(card_number) != 16:
            return False, "Invalid card number format"
        
        # Validate expiry date
        try:
            expiry_month = int(card_details['expiry_month'])
            expiry_year = int(card_details['expiry_year'])
            
            if not (1 <= expiry_month <= 12):
                return False, "Invalid expiry month"
            
            current_year = datetime.now().year
            if expiry_year < current_year or (expiry_year == current_year and expiry_month < datetime.now().month):
                return False, "Card has expired"
        except ValueError:
            return False, "Invalid expiry date format"
        
        # Validate CVV (3-4 digits)
        cvv = str(card_details['cvv'])
        if not cvv.isdigit() or not (3 <= len(cvv) <= 4):
            return False, "Invalid CVV format"
        
        return True, "Card details valid"
    
    def get_supported_payment_methods(self) -> Dict[str, Dict]:
        """
        Get list of supported payment methods with their details
        """
        return {
            "credit_card": {
                "name": "Credit Card",
                "description": "Visa, MasterCard, American Express",
                "icon": "credit-card",
                "supported_currencies": ["INR", "USD", "EUR"],
                "min_amount": 10.00,
                "max_amount": 50000.00
            },
            "debit_card": {
                "name": "Debit Card", 
                "description": "Visa, MasterCard, Rupay",
                "icon": "debit-card",
                "supported_currencies": ["INR"],
                "min_amount": 10.00,
                "max_amount": 25000.00
            },
            "net_banking": {
                "name": "Net Banking",
                "description": "Direct bank transfer",
                "icon": "bank",
                "supported_currencies": ["INR"],
                "min_amount": 100.00,
                "max_amount": 100000.00,
                "banks": ["SBI", "HDFC", "ICICI", "Axis", "Kotak"]
            },
            "upi": {
                "name": "UPI",
                "description": "Unified Payments Interface",
                "icon": "upi",
                "supported_currencies": ["INR"],
                "min_amount": 1.00,
                "max_amount": 100000.00
            },
            "wallet": {
                "name": "Digital Wallet",
                "description": "Paytm, PhonePe, Google Pay",
                "icon": "wallet",
                "supported_currencies": ["INR"],
                "min_amount": 1.00,
                "max_amount": 50000.00
            }
        }

# Global payment gateway instance
payment_gateway = PaymentGateway()