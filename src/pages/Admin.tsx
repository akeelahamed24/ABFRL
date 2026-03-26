import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminAPI, orderAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Order } from '@/types';

const ADVANCE_OPTIONS = [
  'payment_confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'payment_failed',
];

const Admin = () => {
  const { user, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getSimulationOrders();
      setOrders(data.orders || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  const handleAdvance = async (orderNumber: string, targetStatus: string) => {
    try {
      await orderAPI.advanceOrder(orderNumber, targetStatus, 'Advanced from admin simulation panel.');
      toast({ title: 'Order advanced', description: `${orderNumber} moved to ${targetStatus}.` });
      await loadOrders();
    } catch (error) {
      toast({ title: 'Advance failed', description: 'Unable to update order status.', variant: 'destructive' });
    }
  };

  const handleRetryPayment = async (order: Order) => {
    const paymentId = order.latest_payment_id || order.payments?.[order.payments.length - 1]?.payment_id;
    if (!paymentId) {
      toast({ title: 'No payment found', description: 'This order has no retryable payment record.', variant: 'destructive' });
      return;
    }

    try {
      await orderAPI.retryPayment(order.order_number, paymentId, 'success');
      toast({ title: 'Payment retried', description: `A new payment simulation has been created for ${order.order_number}.` });
      await loadOrders();
    } catch (error) {
      toast({ title: 'Retry failed', description: 'Unable to retry payment.', variant: 'destructive' });
    }
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12 space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Admin</p>
          <h1 className="font-serif text-4xl">Simulation Control Panel</h1>
          <p className="text-muted-foreground mt-2">
            Inspect lifecycle progression, force status changes, retry failed payments, and review omnichannel jobs created for each order.
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">Loading simulation orders...</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const latestPayment = order.payments?.[order.payments.length - 1];
              const notifications = (order as any).notifications || [];
              const callWorkflows = (order as any).call_workflows || [];

              return (
                <Card key={order.order_number}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle>{order.order_number}</CardTitle>
                        <CardDescription>
                          {order.customer_snapshot?.name || 'Customer'} • {new Date(order.created_at).toLocaleString()}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{order.order_status}</Badge>
                        <Badge variant={latestPayment?.status === 'failed' ? 'destructive' : 'default'}>
                          payment: {latestPayment?.status || order.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-md border border-border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Notifications</p>
                        <p className="text-2xl font-semibold mt-2">{notifications.length}</p>
                      </div>
                      <div className="rounded-md border border-border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Call Workflows</p>
                        <p className="text-2xl font-semibold mt-2">{callWorkflows.length}</p>
                      </div>
                      <div className="rounded-md border border-border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment Attempts</p>
                        <p className="text-2xl font-semibold mt-2">{order.payments?.length || 0}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {ADVANCE_OPTIONS.map((status) => (
                        <Button
                          key={status}
                          variant="outline"
                          size="sm"
                          onClick={() => void handleAdvance(order.order_number, status)}
                        >
                          Advance to {status}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        onClick={() => void handleRetryPayment(order)}
                        disabled={latestPayment?.status !== 'failed'}
                      >
                        Retry Payment
                      </Button>
                    </div>

                    {!!order.timeline?.length && (
                      <div className="space-y-2">
                        <p className="font-medium">Timeline</p>
                        {order.timeline.map((entry, index) => (
                          <div key={`${order.order_number}-${index}`} className="rounded-md bg-muted/40 p-3 text-sm">
                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                              <span className="font-medium">{entry.label}</span>
                              <span className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-muted-foreground mt-1">{entry.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Admin;
