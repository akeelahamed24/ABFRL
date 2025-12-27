import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../lib/api';
import { Order } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Eye,
  RefreshCw,
  MapPin,
  CreditCard,
  FileText,
  Calendar,
  Tag,
  ChevronRight,
  ShoppingBag,
  CreditCard as CreditCardIcon,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  Home
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';

interface TimelineStep {
  status: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  date?: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [cardData, setCardData] = useState({
    card_number: '4111111111111111',
    expiry_month: '12',
    expiry_year: '2026',
    cvv: '123'
  });

  useEffect(() => {
    const loadOrders = async () => {
      const token = getToken();
      if (!token) {
        navigate('/auth');
        return;
      }

      try {
        const ordersData = await userAPI.getOrders(token);
        setOrders(ordersData as Order[]);
        // Select first order by default if available
        if (ordersData.length > 0 && !selectedOrder) {
          setSelectedOrder(ordersData[0]);
        }
      } catch (err) {
        console.error('Error loading orders:', err);
        toast({
          title: "Error",
          description: "Failed to load orders. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [getToken, navigate, toast]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Clock className="h-4 w-4" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'shipped':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <Package className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'returned':
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'shipped':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'returned':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'refunded':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimelineSteps = (order: Order): TimelineStep[] => {
    const orderDate = new Date(order.created_at);
    const timeline: TimelineStep[] = [];
    
    // Calculate dates for each step (simulated for demo)
    const processingDate = new Date(orderDate);
    const confirmedDate = new Date(processingDate);
    confirmedDate.setDate(confirmedDate.getDate() + 1);
    const shippedDate = new Date(confirmedDate);
    shippedDate.setDate(shippedDate.getDate() + 2);
    const deliveredDate = new Date(shippedDate);
    deliveredDate.setDate(deliveredDate.getDate() + 3);
    
    // Determine current status
    const orderStatus = order.order_status;
    const paymentStatus = order.payment_status;
    
    if (orderStatus === 'cancelled') {
      // Cancelled order timeline
      timeline.push(
        {
          status: 'processing',
          title: 'Order Processing',
          description: 'Your order has been received',
          icon: <Clock className="h-5 w-5" />,
          date: formatDate(processingDate.toISOString()),
          isCompleted: true,
          isCurrent: false
        },
        {
          status: 'cancelled',
          title: 'Order Cancelled',
          description: paymentStatus === 'refunded' ? 'Order cancelled & refund initiated' : 'Order has been cancelled',
          icon: <XCircle className="h-5 w-5" />,
          date: formatDate(new Date().toISOString()),
          isCompleted: true,
          isCurrent: true
        }
      );
    } else if (orderStatus === 'returned') {
      // Returned order timeline
      timeline.push(
        {
          status: 'processing',
          title: 'Order Processing',
          description: 'Your order has been received',
          icon: <Clock className="h-5 w-5" />,
          date: formatDate(processingDate.toISOString()),
          isCompleted: true,
          isCurrent: false
        },
        {
          status: 'confirmed',
          title: 'Order Confirmed',
          description: 'Your order has been confirmed',
          icon: <CheckCircle className="h-5 w-5" />,
          date: formatDate(confirmedDate.toISOString()),
          isCompleted: true,
          isCurrent: false
        },
        {
          status: 'shipped',
          title: 'Order Shipped',
          description: 'Your order is on the way',
          icon: <Truck className="h-5 w-5" />,
          date: formatDate(shippedDate.toISOString()),
          isCompleted: true,
          isCurrent: false
        },
        {
          status: 'delivered',
          title: 'Order Delivered',
          description: 'Your order has been delivered',
          icon: <Package className="h-5 w-5" />,
          date: formatDate(deliveredDate.toISOString()),
          isCompleted: true,
          isCurrent: false
        },
        {
          status: 'returned',
          title: 'Return Initiated',
          description: 'Return request has been approved',
          icon: <RotateCcw className="h-5 w-5" />,
          date: formatDate(new Date().toISOString()),
          isCompleted: true,
          isCurrent: true
        }
      );
    } else if (paymentStatus === 'pending' || paymentStatus === 'failed') {
      // Pending/Failed payment timeline
      timeline.push(
        {
          status: 'processing',
          title: 'Order Processing',
          description: 'Your order has been received',
          icon: <Clock className="h-5 w-5" />,
          date: formatDate(processingDate.toISOString()),
          isCompleted: true,
          isCurrent: orderStatus === 'processing'
        },
        {
          status: 'shipped',
          title: 'Ready to Ship',
          description: paymentStatus === 'failed' ? 'Awaiting successful payment' : 'Awaiting payment confirmation',
          icon: <AlertCircle className="h-5 w-5" />,
          date: 'Pending payment',
          isCompleted: false,
          isCurrent: orderStatus !== 'processing'
        },
        {
          status: 'delivered',
          title: 'Delivery',
          description: 'Will be scheduled after payment',
          icon: <Package className="h-5 w-5" />,
          date: 'Pending',
          isCompleted: false,
          isCurrent: false
        }
      );
    } else {
      // Normal order timeline
      const steps = [
        {
          status: 'processing',
          title: 'Order Processing',
          description: 'Your order has been received',
          icon: <Clock className="h-5 w-5" />,
          date: formatDate(processingDate.toISOString()),
          isCompleted: true,
          isCurrent: false
        },
        {
          status: 'confirmed',
          title: 'Order Confirmed',
          description: 'Your order has been confirmed',
          icon: <CheckCircle className="h-5 w-5" />,
          date: formatDate(confirmedDate.toISOString()),
          isCompleted: orderStatus !== 'processing',
          isCurrent: orderStatus === 'confirmed'
        },
        {
          status: 'shipped',
          title: 'Order Shipped',
          description: 'Your order is on the way',
          icon: <Truck className="h-5 w-5" />,
          date: order.tracking_number ? formatDate(shippedDate.toISOString()) : 'Preparing to ship',
          isCompleted: ['shipped', 'delivered'].includes(orderStatus),
          isCurrent: orderStatus === 'shipped'
        },
        {
          status: 'delivered',
          title: 'Order Delivered',
          description: 'Your order has been delivered',
          icon: <Package className="h-5 w-5" />,
          date: orderStatus === 'delivered' ? formatDate(deliveredDate.toISOString()) : 'Expected soon',
          isCompleted: orderStatus === 'delivered',
          isCurrent: orderStatus === 'delivered'
        }
      ];
      
      // Adjust timeline based on actual order status
      timeline.push(...steps);
    }
    
    return timeline;
  };

  const getProgressPercentage = (order: Order): number => {
    const timeline = getTimelineSteps(order);
    const completedSteps = timeline.filter(step => step.isCompleted).length;
    const totalSteps = timeline.length;
    
    if (totalSteps === 0) return 0;
    return Math.round((completedSteps / totalSteps) * 100);
  };

  const canCancelOrder = (order: Order) => {
    return ['processing', 'confirmed'].includes(order.order_status) &&
           order.payment_status !== 'cancelled';
  };

  const canCompletePayment = (order: Order) => {
    return order.payment_status === 'pending';
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!cancelReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for cancellation",
        variant: "destructive"
      });
      return;
    }

    const token = getToken();
    if (!token) {
      navigate('/auth');
      return;
    }

    setCancellingOrderId(orderId);
    try {
      await userAPI.cancelOrder(token, orderId, { reason: cancelReason });

      // Update local state
      const updatedOrders = orders.map(order =>
        order.id === orderId
          ? {
              ...order,
              order_status: 'cancelled' as const,
              payment_status: 'cancelled' as const,
              notes: order.notes
                ? `${order.notes}\n\nCancelled: ${new Date().toLocaleString()}\nReason: ${cancelReason}`
                : `Cancelled: ${new Date().toLocaleString()}\nReason: ${cancelReason}`
            }
          : order
      );

      setOrders(updatedOrders);

      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updatedOrders.find(o => o.id === orderId) || null);
      }

      toast({
        title: "Order cancelled",
        description: "Your order has been cancelled successfully",
      });

      setShowCancelDialog(false);
      setCancelReason('');
    } catch (err) {
      console.error('Error cancelling order:', err);
      toast({
        title: "Error",
        description: "Failed to cancel order. Please try again.",
        variant: "destructive"
      });
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleCompletePayment = async (orderId: number) => {
    const token = getToken();
    if (!token) {
      navigate('/auth');
      return;
    }

    try {
      const paymentData = {
        payment_method: paymentMethod,
        card_details: paymentMethod === 'credit_card' || paymentMethod === 'debit_card' ? cardData : undefined
      };

      const result = await userAPI.completePayment(token, orderId, paymentData);

      if (result.success) {
        // Update local state
        const updatedOrders = orders.map(order =>
          order.id === orderId
            ? {
                ...order,
                payment_status: 'paid' as const,
                order_status: 'confirmed' as const,
                transaction_id: result.transaction_id
              }
            : order
        );

        setOrders(updatedOrders);

        if (selectedOrder?.id === orderId) {
          setSelectedOrder(updatedOrders.find(o => o.id === orderId) || null);
        }

        toast({
          title: "Payment completed",
          description: `Payment for order #${result.order_number} has been processed successfully`,
        });

        setShowPaymentDialog(false);
      } else {
        toast({
          title: "Payment failed",
          description: result.message || "Payment processing failed",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Error completing payment:', err);
      toast({
        title: "Error",
        description: "Failed to complete payment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleRefreshOrders = async () => {
    const token = getToken();
    if (!token) {
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      const ordersData = await userAPI.getOrders(token);
      setOrders(ordersData as Order[]);
      toast({
        title: "Refreshed",
        description: "Orders list has been updated",
      });
    } catch (err) {
      console.error('Error refreshing orders:', err);
      toast({
        title: "Error",
        description: "Failed to refresh orders",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-full"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  My Orders
                </h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {orders.length} order{orders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleRefreshOrders}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => navigate('/products')}>
                Continue Shopping
              </Button>
            </div>
          </div>

          {orders.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="text-center py-16">
                <div className="relative inline-block mb-6">
                  <Package className="h-24 w-24 text-muted-foreground/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Tag className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-3">No orders yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-8">
                  Your order history will appear here. Start exploring our products and make your first purchase!
                </p>
                <Button 
                  onClick={() => navigate('/products')}
                  size="lg"
                  className="px-8"
                >
                  <ShoppingBag className="h-5 w-5 mr-2" />
                  Browse Products
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Orders List Sidebar */}
              <div className="lg:col-span-1 space-y-4">
                <div className="sticky top-24">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Order History
                  </h2>
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <Card
                        key={order.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                          selectedOrder?.id === order.id 
                            ? 'ring-2 ring-primary shadow-lg border-primary/20' 
                            : ''
                        }`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold text-sm">
                                    #{order.order_number}
                                  </span>
                                </div>
                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
                                  selectedOrder?.id === order.id ? 'rotate-90' : ''
                                }`} />
                              </div>
                              
                              <div className="flex items-center gap-2 mb-3">
                                <Badge className={`${getStatusColor(order.order_status)} gap-1`}>
                                  {getStatusIcon(order.order_status)}
                                  <span className="capitalize">{order.order_status}</span>
                                </Badge>
                                <Badge variant="outline" className={getPaymentStatusColor(order.payment_status)}>
                                  {order.payment_status}
                                </Badge>
                              </div>
                              
                              <div className="space-y-1.5 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {formatDate(order.created_at)}
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">
                                    {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
                                  </span>
                                  <span className="font-semibold">
                                    {formatCurrency(order.final_amount)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>

              {/* Order Details Panel */}
              <div className="lg:col-span-2">
                {selectedOrder ? (
                  <Card className="shadow-xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-2xl flex items-center gap-3">
                            <span className="font-mono">#{selectedOrder.order_number}</span>
                            <Badge className={`${getStatusColor(selectedOrder.order_status)} text-sm py-1 px-3`}>
                              {getStatusIcon(selectedOrder.order_status)}
                              <span className="ml-1.5 capitalize">{selectedOrder.order_status}</span>
                            </Badge>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-2">
                            <Calendar className="h-4 w-4" />
                            Placed on {formatDate(selectedOrder.created_at)}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-8">
                      {/* Order Timeline */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5" />
                            Order Tracking
                          </CardTitle>
                          <CardDescription>
                            Track your order status in real-time
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-6">
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">Progress</span>
                              <span className="text-sm font-semibold text-primary">
                                {getProgressPercentage(selectedOrder)}%
                              </span>
                            </div>
                            <Progress value={getProgressPercentage(selectedOrder)} className="h-2" />
                          </div>
                          
                          <div className="relative">
                            {getTimelineSteps(selectedOrder).map((step, index) => (
                              <div key={step.status} className="relative flex items-start mb-6 last:mb-0">
                                {/* Timeline line */}
                                {index < getTimelineSteps(selectedOrder).length - 1 && (
                                  <div className={`absolute left-4 top-8 w-0.5 h-full ${
                                    step.isCompleted ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                                  }`} />
                                )}
                                
                                {/* Icon */}
                                <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${
                                  step.isCurrent
                                    ? 'ring-4 ring-primary/20 bg-primary text-primary-foreground'
                                    : step.isCompleted
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                }`}>
                                  {step.icon}
                                </div>
                                
                                {/* Content */}
                                <div className="ml-4 flex-1">
                                  <div className="flex items-center justify-between">
                                    <h4 className={`font-medium ${
                                      step.isCurrent ? 'text-primary' : step.isCompleted ? 'text-foreground' : 'text-muted-foreground'
                                    }`}>
                                      {step.title}
                                    </h4>
                                    {step.date && (
                                      <span className="text-xs text-muted-foreground">
                                        {step.date}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {step.description}
                                  </p>
                                  
                                  {/* Additional info for specific steps */}
                                  {step.status === 'shipped' && selectedOrder.tracking_number && (
                                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                                      <p className="text-xs font-medium">Tracking Number:</p>
                                      <code className="text-xs font-mono text-primary">
                                        {selectedOrder.tracking_number}
                                      </code>
                                    </div>
                                  )}
                                  
                                  {step.status === 'processing' && selectedOrder.payment_status === 'pending' && (
                                    <div className="mt-2">
                                      <Badge variant="outline" className="border-yellow-200 text-yellow-700 dark:text-yellow-300">
                                        <CreditCardIcon className="h-3 w-3 mr-1" />
                                        Payment Pending
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Current status highlight */}
                          {getTimelineSteps(selectedOrder).find(step => step.isCurrent) && (
                            <Alert className="mt-4 border-primary/20 bg-primary/5">
                              <CheckCircle className="h-4 w-4 text-primary" />
                              <AlertDescription>
                                Current Status: <span className="font-semibold">
                                  {getTimelineSteps(selectedOrder).find(step => step.isCurrent)?.title}
                                </span>
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>

                      {/* Order Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Items */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Package className="h-5 w-5" />
                              Order Items
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {selectedOrder.order_items.map((item) => (
                                <div 
                                  key={item.id} 
                                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium">{item.product_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Quantity: {item.quantity} × {formatCurrency(item.unit_price)}
                                    </p>
                                  </div>
                                  <p className="font-semibold">
                                    {formatCurrency(item.total_price)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Payment & Status */}
                        <div className="space-y-6">
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Payment Details
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Payment Status</span>
                                  <Badge className={getPaymentStatusColor(selectedOrder.payment_status)}>
                                    {selectedOrder.payment_status}
                                  </Badge>
                                </div>
                                {selectedOrder.payment_method && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Method</span>
                                    <span className="font-medium capitalize">
                                      {selectedOrder.payment_method}
                                    </span>
                                  </div>
                                )}
                                {selectedOrder.transaction_id && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Transaction ID</span>
                                    <span className="font-mono text-sm">
                                      {selectedOrder.transaction_id.slice(0, 12)}...
                                    </span>
                                  </div>
                                )}
                                {selectedOrder.payment_status === 'paid' && (
                                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                                    <ShieldCheck className="h-3 w-3" />
                                    Payment secured and verified
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Shipping Info */}
                          {selectedOrder.tracking_number && (
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                  <Truck className="h-5 w-5" />
                                  Shipping Info
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Tracking Number</span>
                                    <code className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                      {selectedOrder.tracking_number}
                                    </code>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>

                      {/* Addresses */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <MapPin className="h-5 w-5" />
                              Shipping Address
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                <Home className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <p className="text-sm whitespace-pre-line leading-relaxed">
                                {selectedOrder.shipping_address}
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <CreditCard className="h-5 w-5" />
                              Billing Address
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <p className="text-sm whitespace-pre-line leading-relaxed">
                                {selectedOrder.billing_address}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Totals */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span>{formatCurrency(selectedOrder.total_amount)}</span>
                            </div>
                            {selectedOrder.discount_amount > 0 && (
                              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                                <span>Discount</span>
                                <span>-{formatCurrency(selectedOrder.discount_amount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Tax</span>
                              <span>{formatCurrency(selectedOrder.tax_amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Shipping</span>
                              <span>{formatCurrency(selectedOrder.shipping_amount)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-lg font-bold">
                              <span>Total</span>
                              <span className="text-primary">
                                {formatCurrency(selectedOrder.final_amount)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Notes */}
                      {selectedOrder.notes && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <FileText className="h-5 w-5" />
                              Additional Notes
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-line">
                              {selectedOrder.notes}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </CardContent>
                    
                    <CardFooter className="border-t pt-6">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                        <div className="text-sm text-muted-foreground">
                          Need help with this order?{' '}
                          <Button variant="link" className="p-0 h-auto">
                            Contact Support
                          </Button>
                        </div>
                        <div className="flex gap-3">
                          {canCompletePayment(selectedOrder) && (
                            <Button
                              onClick={() => setShowPaymentDialog(true)}
                              className="gap-2"
                            >
                              <CreditCard className="h-4 w-4" />
                              Complete Payment
                            </Button>
                          )}
                          {canCancelOrder(selectedOrder) && (
                            <Button
                              variant="destructive"
                              onClick={() => setShowCancelDialog(true)}
                              className="gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              Cancel Order
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => navigate('/products')}
                          >
                            Shop More
                          </Button>
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                ) : (
                  <Card className="h-full flex items-center justify-center py-16">
                    <CardContent className="text-center">
                      <div className="relative inline-block mb-6">
                        <Eye className="h-24 w-24 text-muted-foreground/20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-primary" />
                          </div>
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold mb-3">Select an Order</h3>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        Choose an order from the list to view detailed information, 
                        track shipping, and manage your purchase.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cancel Order #{selectedOrder?.order_number}
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. Please provide a reason for cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertDescription>
                You can only cancel orders that are in "processing" or "confirmed" status.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">
                Cancellation Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cancel-reason"
                placeholder="Please provide your reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setCancelReason('');
              }}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedOrder && handleCancelOrder(selectedOrder.id)}
              disabled={cancellingOrderId !== null}
              className="gap-2"
            >
              {cancellingOrderId !== null ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Cancel Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Complete Payment for Order #{selectedOrder?.order_number}
            </DialogTitle>
            <DialogDescription>
              Please provide your payment details to complete this order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="wallet">Digital Wallet</SelectItem>
                  <SelectItem value="net_banking">Net Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-semibold">Card Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment-card-number">Card Number</Label>
                    <Input
                      id="payment-card-number"
                      placeholder="1234 5678 9012 3456"
                      value={cardData.card_number}
                      onChange={(e) => setCardData(prev => ({ ...prev, card_number: e.target.value.replace(/\D/g, '') }))}
                      maxLength={16}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
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
                    <Label htmlFor="payment-cvv">CVV</Label>
                    <Input
                      id="payment-cvv"
                      placeholder="123"
                      value={cardData.cvv}
                      onChange={(e) => setCardData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedOrder && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Amount:</span>
                  <span className="text-lg font-bold">{formatCurrency(selectedOrder.final_amount)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedOrder && handleCompletePayment(selectedOrder.id)}
              className="gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Complete Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;