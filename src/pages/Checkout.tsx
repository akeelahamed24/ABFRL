import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cartAPI } from '../services/api';

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart, isLoading } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [isComplete, setIsComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zipCode: '',
    cardNumber: '',
    cvv: '',
    expiryDate: ''
  });

  if (!isAuthenticated) {
    navigate('/auth');
    return null;
  }

  if (items.length === 0 && !isComplete) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
        <Button onClick={() => navigate('/products')}>Continue Shopping</Button>
      </div>
    );
  }

  const handleCheckout = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User ID not found. Please log in again.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.address || !formData.city || !formData.state || !formData.zipCode) {
      toast({
        title: "Error",
        description: "Please fill in all address fields.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      
      // Call checkout API
      const result = await cartAPI.checkout(
        user.id,
        {
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode
        },
        items.map(item => ({
          product_id: item.product.id,
          product_name: item.product.product_name,
          quantity: item.quantity,
          price: item.product.price,
          size: item.size,
          color: item.color
        })),
        subtotal
      );

      clearCart();
      setIsComplete(true);
      
      toast({
        title: "Order Placed Successfully!",
        description: `Order #${result.order_number} has been created.`,
      });
    } catch (error) {
      console.error('Checkout failed:', error);
      toast({
        title: "Checkout Failed",
        description: error instanceof Error ? error.message : "An error occurred during checkout.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
        <p className="text-muted-foreground mb-8">Thank you for your order. You can track it in your orders page.</p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate('/orders')}>View Orders</Button>
          <Button variant="outline" onClick={() => navigate('/products')}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/cart')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Cart
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>Checkout</CardTitle>
            <CardDescription>Enter your shipping and payment information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Summary */}
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.product.product_name} x{item.quantity}</span>
                    <span>{formatCurrency(item.product.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="space-y-4">
              <h3 className="font-semibold">Shipping Address</h3>
              <div>
                <Label>Street Address</Label>
                <Input 
                  placeholder="123 Main St" 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input 
                    placeholder="New York" 
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input 
                    placeholder="NY" 
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label>ZIP Code</Label>
                <Input 
                  placeholder="10001" 
                  value={formData.zipCode}
                  onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                />
              </div>
            </div>

            {/* Payment Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Payment Information</h3>
              <div>
                <Label>Card Number</Label>
                <Input 
                  placeholder="4111 1111 1111 1111" 
                  value={formData.cardNumber}
                  onChange={(e) => setFormData({...formData, cardNumber: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Expiry Date</Label>
                  <Input 
                    placeholder="MM/YY" 
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                  />
                </div>
                <div>
                  <Label>CVV</Label>
                  <Input 
                    placeholder="123" 
                    value={formData.cvv}
                    onChange={(e) => setFormData({...formData, cvv: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Order Total */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </div>

            <Button 
              onClick={handleCheckout} 
              className="w-full" 
              size="lg"
              disabled={submitting || isLoading}
            >
              {submitting || isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Place Order'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Checkout;
