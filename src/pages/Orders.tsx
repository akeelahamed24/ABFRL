import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Package, ArrowLeft, Calendar, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { useOrders } from '../hooks/useApi';
import { Badge } from '../components/ui/badge';
import { Order } from '../types';

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { orders, loading, error } = useOrders(user?.id);

  const getOrderStatus = (order: Order) => order.order_status || order.status || 'pending';
  const getOrderDate = (order: Order) => order.created_at || '';
  const getOrderTotal = (order: Order) =>
  order.final_amount ??
  order.total_amount ??
  order.items?.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0) ??
  0;

  if (!isAuthenticated) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Button>

        <h1 className="text-3xl font-bold mb-8">My Orders</h1>

        {/* Loading State */}
        {loading ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="h-16 w-16 mx-auto mb-4 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <h2 className="text-xl font-semibold mb-2">Loading your orders...</h2>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="h-16 w-16 text-destructive/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Failed to load orders</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: Order) => {
              const status = getOrderStatus(order);
              const orderDate = getOrderDate(order);
              const totalAmount = getOrderTotal(order);

              return (
              <Card key={order.id || order.order_number} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Order #{order.order_number}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(orderDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant={status === 'delivered' ? 'default' : 'secondary'}>
                      {status === 'delivered' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Order Items */}
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Items</h4>
                      <div className="space-y-2">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <div>
                              <p className="font-medium">{item.product_name || `Product #${item.product_id}`}</p>
                              <p className="text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                            <p className="font-medium">${(((item.price || 0) * item.quantity)).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Order Total */}
                    <div className="border-t pt-4 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <span className="font-semibold">Total Amount</span>
                      </div>
                      <span className="text-xl font-bold text-primary">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )})}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
              <p className="text-muted-foreground mb-6">
                You haven't placed any orders yet. Start shopping to see your orders here.
              </p>
              <Button onClick={() => navigate('/products')}>
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Orders;
