import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { checkoutAPI, userAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import {
  CreditCard,
  Truck,
  MapPin,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface AddressFormData {
  shipping_address: string;
  billing_address: string;
  notes: string;
}

interface CardFormData {
  card_number: string;
  expiry_month: string;
  expiry_year: string;
  cvv: string;
}

interface CheckoutPreview {
  has_items: boolean;
  item_count?: number;
  valid_items?: Array<{
    product_name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  totals?: {
    subtotal: number;
    discount_amount: number;
    discount_rate: number;
    tax_amount: number;
    shipping_amount: number;
    final_amount: number;
  };
  user_loyalty?: {
    score: number;
    discount_rate: number;
    discount_amount: number;
  };
  message?: string;
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { items, clearCart } = useCart();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'address' | 'payment' | 'review' | 'success' | 'error'>('address');
  const [loading, setLoading] = useState(false);
  const [addressData, setAddressData] = useState<AddressFormData>({
    shipping_address: '',
    billing_address: '',
    notes: ''
  });
  const [paymentMethod, setPaymentMethod] = useState<string>('credit_card');
  const [cardData, setCardData] = useState<CardFormData>({
    card_number: '4111111111111111', // Test card number
    expiry_month: '12',
    expiry_year: '2026',
    cvv: '123'
  });
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    type?: string;
    timestamp?: string;
    suggestion?: string;
  } | null>(null);

  // Load user data and checkout preview on mount
  useEffect(() => {
    const loadCheckoutData = async () => {
      const token = getToken();
      if (!token) {
        navigate('/auth');
        return;
      }

      try {
        // Load user data for default addresses
        const userData = await userAPI.getProfile(token);
        setAddressData(prev => ({
          ...prev,
          shipping_address: userData.address || '',
          billing_address: userData.address || ''
        }));

        // Load checkout preview
        const previewData = await checkoutAPI.getCheckoutPreview(token);
        setPreview(previewData);

        if (!previewData.has_items) {
          toast({
            title: "Empty Cart",
            description: "Your cart is empty. Please add items before checkout.",
            variant: "destructive"
          });
          navigate('/products');
        }
      } catch (err) {
        console.error('Error loading checkout data:', err);
        
        let errorMessage = 'Failed to load checkout data. Please try again.';
        let errorDescription = errorMessage;
        
        if (err instanceof Error) {
          if (err.message.includes('Network Error')) {
            errorMessage = 'Network error. Please check your internet connection.';
            errorDescription = 'Failed to connect to the server. Please check your internet connection and try again.';
          } else if (err.message.includes('401')) {
            errorMessage = 'Authentication failed. Please login again.';
            errorDescription = 'Your session has expired. Please login again to continue.';
          }
        }
        
        toast({
          title: "Error",
          description: errorDescription,
          variant: "destructive"
        });
        navigate('/cart');
      }
    };

    loadCheckoutData();
  }, [getToken, navigate, toast]);

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressData.shipping_address || !addressData.billing_address) {
      toast({
        title: "Error",
        description: "Please fill in both shipping and billing addresses.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate minimum address length (backend requires at least 10 characters)
    if (addressData.shipping_address.length < 10) {
      toast({
        title: "Error",
        description: "Shipping address must be at least 10 characters long.",
        variant: "destructive"
      });
      return;
    }
    
    if (addressData.billing_address.length < 10) {
      toast({
        title: "Error",
        description: "Billing address must be at least 10 characters long.",
        variant: "destructive"
      });
      return;
    }
    
    setStep('payment');
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') {
      const { card_number, expiry_month, expiry_year, cvv } = cardData;
      
      if (!card_number || !expiry_month || !expiry_year || !cvv) {
        toast({
          title: "Error",
          description: "Please fill in all card details.",
          variant: "destructive"
        });
        return;
      }

      // Basic validation
      if (card_number.replace(/\s/g, '').length !== 16) {
        toast({
          title: "Error",
          description: "Card number must be 16 digits.",
          variant: "destructive"
        });
        return;
      }

      if (!/^\d{3,4}$/.test(cvv)) {
        toast({
          title: "Error",
          description: "CVV must be 3 or 4 digits.",
          variant: "destructive"
        });
        return;
      }
    }

    setStep('review');
  };

  const handleCheckout = async () => {
    const token = getToken();
    if (!token || !preview) return;

    setLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const checkoutData = {
        shipping_address: addressData.shipping_address,
        billing_address: addressData.billing_address,
        payment_method: paymentMethod,
        notes: addressData.notes,
        card_details: paymentMethod === 'credit_card' || paymentMethod === 'debit_card' ? cardData : undefined
      };

      const result = await checkoutAPI.checkout(token, checkoutData);

      if (result.success) {
        setStep('success');
        clearCart(); // Clear cart in frontend state immediately
        toast({
          title: "Order Placed Successfully!",
          description: `Order #${result.order_number} has been placed successfully.`,
        });
      } else {
        // Handle different error types
        const errorMessage = result.error || 'Checkout failed';
        const errorType = result.error_type || 'unknown_error';
        
        setError(errorMessage);
        setErrorDetails({
          type: errorType,
          timestamp: new Date().toISOString(),
          suggestion: getErrorSuggestion(errorType)
        });
        setStep('error');
        
        let errorDescription = errorMessage;
        if (errorType === 'checkout_error') {
          errorDescription = `Checkout validation failed: ${errorMessage}`;
        } else if (errorType === 'system_error') {
          errorDescription = `System error: ${errorMessage}. Please try again later.`;
        }
        
        toast({
          title: "Checkout Failed",
          description: errorDescription,
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Checkout error:', err);
      
      // Handle network errors and other exceptions
      let errorMessage = 'An unexpected error occurred. Please try again.';
      let errorDescription = errorMessage;
      let errorType = 'network_error';
      let suggestion = 'Please check your internet connection and try again.';
      
      if (err instanceof Error) {
        if (err.message.includes('Network Error')) {
          errorMessage = 'Network error. Please check your internet connection.';
          errorDescription = 'Failed to connect to the server. Please check your internet connection and try again.';
          errorType = 'network_error';
          suggestion = 'Check your internet connection and try again.';
        } else if (err.message.includes('401')) {
          errorMessage = 'Authentication failed. Please login again.';
          errorDescription = 'Your session has expired. Please login again to continue.';
          errorType = 'authentication_error';
          suggestion = 'Please login again to continue your checkout.';
        } else if (err.message.includes('400')) {
          errorMessage = 'Invalid request data.';
          errorDescription = 'There was an issue with your checkout data. Please review your information.';
          errorType = 'validation_error';
          suggestion = 'Please review your shipping, billing, and payment information.';
        }
      }
      
      setError(errorMessage);
      setErrorDetails({
        type: errorType,
        timestamp: new Date().toISOString(),
        suggestion: suggestion
      });
      setStep('error');
      
      toast({
        title: "Error",
        description: errorDescription,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getErrorSuggestion = (errorType: string): string => {
    switch (errorType) {
      case 'checkout_error':
        return 'Please review your cart items and try again.';
      case 'system_error':
        return 'Please try again later or contact customer support.';
      case 'network_error':
        return 'Please check your internet connection and try again.';
      case 'authentication_error':
        return 'Please login again to continue your checkout.';
      case 'validation_error':
        return 'Please review your shipping, billing, and payment information.';
      default:
        return 'Please try again or contact customer support.';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'credit_card': return <CreditCard className="h-4 w-4" />;
      case 'debit_card': return <CreditCard className="h-4 w-4" />;
      case 'net_banking': return <Truck className="h-4 w-4" />;
      case 'upi': return <Truck className="h-4 w-4" />;
      case 'wallet': return <Truck className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === 'address' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'address' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                1
              </div>
              <span>Address</span>
            </div>
            <div className="w-16 h-px bg-muted" />
            <div className={`flex items-center space-x-2 ${step === 'payment' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'payment' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                2
              </div>
              <span>Payment</span>
            </div>
            <div className="w-16 h-px bg-muted" />
            <div className={`flex items-center space-x-2 ${step === 'review' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'review' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                3
              </div>
              <span>Review</span>
            </div>
          </div>
        </div>

        {/* Address Form */}
        {step === 'address' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Shipping & Billing Address</span>
              </CardTitle>
              <CardDescription>
                Please provide your shipping and billing addresses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddressSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="shipping_address">Shipping Address</Label>
                    <Input
                      id="shipping_address"
                      placeholder="123 Main Street, City, State, PIN"
                      value={addressData.shipping_address}
                      onChange={(e) => setAddressData(prev => ({ ...prev, shipping_address: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_address">Billing Address</Label>
                    <Input
                      id="billing_address"
                      placeholder="123 Main Street, City, State, PIN"
                      value={addressData.billing_address}
                      onChange={(e) => setAddressData(prev => ({ ...prev, billing_address: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (Optional)</Label>
                  <Input
                    id="notes"
                    placeholder="Any special instructions for delivery..."
                    value={addressData.notes}
                    onChange={(e) => setAddressData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => navigate('/cart')}>
                    Back to Cart
                  </Button>
                  <Button type="submit">
                    Continue to Payment
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Payment Form */}
        {step === 'payment' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Payment Method</span>
              </CardTitle>
              <CardDescription>
                Choose your preferred payment method.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                {/* Payment Method Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'credit_card', name: 'Credit Card', icon: <CreditCard className="h-4 w-4" /> },
                    { id: 'debit_card', name: 'Debit Card', icon: <CreditCard className="h-4 w-4" /> },
                    { id: 'upi', name: 'UPI', icon: <Truck className="h-4 w-4" /> },
                    { id: 'wallet', name: 'Digital Wallet', icon: <Truck className="h-4 w-4" /> },
                    { id: 'net_banking', name: 'Net Banking', icon: <Truck className="h-4 w-4" /> }
                  ].map((method) => (
                    <label key={method.id} className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <input
                        type="radio"
                        name="payment_method"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                          {method.icon}
                        </div>
                        <span className="font-medium">{method.name}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Card Details (for card payments) */}
                {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold">Card Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="card_number">Card Number</Label>
                        <Input
                          id="card_number"
                          placeholder="1234 5678 9012 3456"
                          value={cardData.card_number}
                          onChange={(e) => setCardData(prev => ({ ...prev, card_number: e.target.value.replace(/\D/g, '') }))}
                          maxLength={16}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expiry">Expiry Date</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="MM"
                            value={cardData.expiry_month}
                            onChange={(e) => setCardData(prev => ({ ...prev, expiry_month: e.target.value.replace(/\D/g, '') }))}
                            maxLength={2}
                          />
                          <Input
                            placeholder="YYYY"
                            value={cardData.expiry_year}
                            onChange={(e) => setCardData(prev => ({ ...prev, expiry_year: e.target.value.replace(/\D/g, '') }))}
                            maxLength={4}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvv">CVV</Label>
                        <Input
                          id="cvv"
                          placeholder="123"
                          value={cardData.cvv}
                          onChange={(e) => setCardData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep('address')}>
                    Back to Address
                  </Button>
                  <Button type="submit">
                    Continue to Review
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Review Order */}
        {step === 'review' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <span>Review Order</span>
              </CardTitle>
              <CardDescription>
                Please review your order details before placing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Order Summary */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4">Items ({preview.item_count})</h3>
                    <div className="space-y-4">
                      {preview.valid_items?.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                          <p className="font-semibold">{formatCurrency(item.total)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Address Details */}
                  <div>
                    <h3 className="font-semibold mb-4">Delivery Address</h3>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Shipping Address:</p>
                      <p className="mt-1">{addressData.shipping_address}</p>
                      <p className="text-sm text-muted-foreground mt-2">Billing Address:</p>
                      <p className="mt-1">{addressData.billing_address}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4">Payment Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(preview.totals?.subtotal || 0)}</span>
                      </div>
                      {preview.user_loyalty?.discount_amount && preview.user_loyalty.discount_amount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Loyalty Discount ({(preview.user_loyalty.discount_rate * 100).toFixed(0)}%)</span>
                          <span>-{formatCurrency(preview.user_loyalty.discount_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax</span>
                        <span>{formatCurrency(preview.totals?.tax_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>{formatCurrency(preview.totals?.shipping_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-semibold text-lg">
                        <span>Total</span>
                        <span>{formatCurrency(preview.totals?.final_amount || 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-muted-foreground">Payment Method:</span>
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        {getPaymentMethodIcon(paymentMethod)}
                        <span>{paymentMethod.replace('_', ' ').toUpperCase()}</span>
                      </Badge>
                    </div>
                    {addressData.notes && (
                      <div className="mt-2">
                        <span className="text-muted-foreground">Notes:</span>
                        <p className="mt-1 text-sm">{addressData.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep('payment')}>
                      Back to Payment
                    </Button>
                    <Button 
                      onClick={handleCheckout} 
                      disabled={loading}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        `Place Order - ${formatCurrency(preview.totals?.final_amount || 0)}`
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Message */}
        {step === 'success' && (
          <Card className="border-green-500">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Order Placed Successfully!</CardTitle>
              <CardDescription>
                Your order has been placed and is being processed. You will receive a confirmation email shortly.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="text-lg font-semibold">#{preview.totals?.final_amount}</p>
              </div>
              <div className="flex justify-center space-x-4">
                <Button onClick={() => navigate('/orders')}>View Orders</Button>
                <Button variant="outline" onClick={() => navigate('/')}>Continue Shopping</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {step === 'error' && (
          <Card className="border-red-500">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-600">Checkout Failed</CardTitle>
              <CardDescription>
                We encountered an issue while processing your order. Please try again or contact support.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium">Error: {error}</p>
                  {errorDetails && (
                    <div className="mt-2 text-sm text-red-700">
                      {errorDetails.type && (
                        <p className="mb-1">Error Type: {errorDetails.type}</p>
                      )}
                      {errorDetails.suggestion && (
                        <p className="mt-2 p-2 bg-red-100 rounded">Suggestion: {errorDetails.suggestion}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-center space-x-4">
                <Button onClick={() => setStep('review')}>Try Again</Button>
                <Button variant="outline" onClick={() => navigate('/cart')}>Back to Cart</Button>
              </div>
              <div className="text-sm text-muted-foreground mt-4">
                If the problem persists, please contact customer support at support@example.com
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Checkout;
