export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  loyalty_score: number;
  is_active: boolean;
  is_admin: boolean;
  whatsapp_connection?: WhatsAppConnection | null;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'order_placed'
  | 'payment_confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'payment_failed';

export type PaymentStatus = 'initiated' | 'pending' | 'success' | 'failed';

export type EventType =
  | 'order_created'
  | 'payment_initiated'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'order_processing'
  | 'order_shipped'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'product_viewed'
  | 'cart_abandoned'
  | 'whatsapp_connected'
  | 'whatsapp_disconnected';

export type NotificationStatus = 'queued' | 'simulated_sent' | 'failed';

export type CallScenario =
  | 'cart_abandonment'
  | 'product_interest'
  | 'order_update'
  | 'post_delivery_followup';

export type CallWorkflowStatus = 'scheduled' | 'ready' | 'completed';

export interface WhatsAppConnection {
  provider: 'openclaw';
  mode: 'simulated';
  status: 'connected' | 'disconnected';
  phone_number?: string | null;
  opt_in: boolean;
  connected_at?: string | null;
  updated_at?: string | null;
}

export interface OrderTimelineEntry {
  status: string;
  label: string;
  description: string;
  source: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface PaymentRecord {
  payment_id: string;
  order_number: string;
  user_id: string;
  amount: number;
  method: string;
  scenario: 'success' | 'pending' | 'failed';
  status: PaymentStatus;
  attempt_number: number;
  created_at: string;
  updated_at: string;
  timeline: Array<{
    status: string;
    description: string;
    source: string;
    created_at: string;
    metadata?: Record<string, any>;
  }>;
}

export interface NotificationRecord {
  notification_id: string;
  user_id: string;
  order_number?: string | null;
  channel: 'whatsapp';
  provider: 'openclaw';
  mode: 'simulated';
  template_key: string;
  message: string;
  status: NotificationStatus;
  created_at: string;
  sent_at?: string | null;
}

export interface CallWorkflow {
  call_workflow_id: string;
  user_id: string;
  order_number?: string | null;
  scenario: CallScenario;
  tone: string;
  status: CallWorkflowStatus;
  script: string;
  summary?: string;
  scheduled_for: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface Product {
  id: number;
  product_name: string;
  description: string | null;
  dress_category: string;
  occasion: string | null;
  price: number;
  stock: number;
  material: string | null;
  available_sizes: string | null;
  colors: string | null;
  image_url: string | null;
  featured_dress: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: number;
  user_id: string;
  product_id: number;
  quantity: number;
  size: string;
  color: string;
  added_at: string;
  product?: Product;
}

export interface Order {
  id?: string;
  order_number: string;
  user_id: string;
  total_amount?: number;
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
  final_amount?: number;
  payment_status?: PaymentStatus;
  payment_method?: string | null;
  transaction_id?: string | null;
  shipping_address?: string;
  billing_address?: string;
  latest_payment_id?: string | null;
  order_status?: OrderStatus;
  status?: string;
  tracking_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  timeline?: OrderTimelineEntry[];
  payments?: PaymentRecord[];
  fulfillment?: {
    carrier?: string | null;
    tracking_number?: string | null;
    delivery_eta?: string | null;
    delivered_at?: string | null;
  };
  customer_snapshot?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  items?: Array<{
    product_id: number;
    product_name?: string;
    quantity: number;
    price?: number;
    size?: string | null;
    color?: string | null;
  }>;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface CatalogCategoryMeta {
  id: string;
  name: string;
  count: number;
  image_url?: string | null;
}

export interface CatalogOccasionMeta {
  id: string;
  name: string;
  count: number;
}

export interface CategoryOption {
  id: string;
  name: string;
  count?: number;
  image_url?: string | null;
}

export interface CategoryGroup {
  id: string;
  name: string;
  count?: number;
  image_url?: string | null;
  subcategories: CategoryOption[];
}

export type DressCategory = 
  | 'women-dresses' 
  | 'women-tops' 
  | 'women-bottoms' 
  | 'women-outerwear'
  | 'men-shirts' 
  | 'men-pants' 
  | 'men-suits' 
  | 'men-outerwear'
  | 'kids-girls' 
  | 'kids-boys' 
  | 'kids-baby';

export type Occasion = 
  | 'casual' 
  | 'formal' 
  | 'party' 
  | 'wedding' 
  | 'office' 
  | 'vacation' 
  | 'sports';

export interface FilterState {
  category: string | null;
  occasion: string | null;
  priceRange: [number, number];
  sizes: string[];
  colors: string[];
  sortBy: 'newest' | 'price-low' | 'price-high' | 'featured';
}
