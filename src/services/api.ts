// API service for communicating with backend
import {
  CallWorkflow,
  CatalogCategoryMeta,
  CatalogOccasionMeta,
  NotificationRecord,
  Order,
  OrderTimelineEntry,
  User,
} from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ==================== Products ====================

export interface FetchProductsParams {
  category?: string;
  occasion?: string;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
}

export interface SalesChatRequest {
  message: string;
  prompt?: string;
  user_id?: string;
  session_id?: string;
  channel?: 'web' | 'mobile' | 'whatsapp' | 'telegram' | 'kiosk' | 'voice';
}

export interface SalesChatResponse {
  reply: string;
  session_id?: string | null;
  requires_action: boolean;
  action_type?: string | null;
  action_data?: Record<string, any> | null;
}

export type VoiceAgentStage = 'intro' | 'qualification' | 'closing';

export interface VoiceAgentRequest {
  message: string;
  stage: VoiceAgentStage;
}

export interface VoiceAgentResponse {
  reply: string;
  next_stage: VoiceAgentStage;
}

export interface CatalogMetaResponse {
  categories: CatalogCategoryMeta[];
  occasions: CatalogOccasionMeta[];
}

export interface ChatHistoryMessage {
  session_id: string;
  message_type: string;
  content: string;
  agent_type?: string | null;
  created_at: string;
}

export interface ChatSessionSummary {
  session_id: string;
  channel: string;
  status: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  title: string;
  last_message_preview: string;
}

export interface ActivitySummaryResponse {
  last_activity_at?: string | null;
  recent_activities: Array<Record<string, any>>;
  abandoned_cart: boolean;
  cart_item_count: number;
  top_product_views: Array<{ product_id: number; view_count: number }>;
}

export interface CommunicationsResponse {
  notifications: NotificationRecord[];
  call_workflows: CallWorkflow[];
}

export const productAPI = {
  // Get all products or filter by category
  async getProducts(params?: FetchProductsParams) {
    try {
      const url = new URL(`${API_BASE}/products`);
      if (params?.category) {
        url.searchParams.append('category', params.category);
      }
      if (params?.occasion) {
        url.searchParams.append('occasion', params.occasion);
      }
      if (params?.minPrice !== undefined) {
        url.searchParams.append('min_price', String(params.minPrice));
      }
      if (params?.maxPrice !== undefined) {
        url.searchParams.append('max_price', String(params.maxPrice));
      }
      if (params?.q) {
        url.searchParams.append('q', params.q);
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch products');
      
      const data = await response.json();
      return data.products || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  },

  // Get single product by ID
  async getProduct(productId: number | string) {
    try {
      const response = await fetch(`${API_BASE}/products/${productId}`);
      if (!response.ok) throw new Error('Product not found');
      return await response.json();
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  },

  // Search products
  async searchProducts(query: string) {
    try {
      return this.getProducts({ q: query });
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  },

  async getCatalogMeta(): Promise<CatalogMetaResponse> {
    try {
      const response = await fetch(`${API_BASE}/products/meta`);
      if (!response.ok) throw new Error('Failed to fetch catalog metadata');
      return await response.json();
    } catch (error) {
      console.error('Error fetching catalog metadata:', error);
      return { categories: [], occasions: [] };
    }
  },
};

// ==================== Orders ====================

export const orderAPI = {
  // Get user's orders
  async getOrders(userId: string): Promise<Order[]> {
    try {
      const response = await fetch(`${API_BASE}/user/${userId}/orders`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      return data.orders || [];
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  },

  // Get single order
  async getOrder(orderNumber: string): Promise<Order | null> {
    try {
      const response = await fetch(`${API_BASE}/orders/${orderNumber}`);
      if (!response.ok) throw new Error('Order not found');
      return await response.json();
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  },

  async getTimeline(orderNumber: string): Promise<OrderTimelineEntry[]> {
    try {
      const response = await fetch(`${API_BASE}/orders/${orderNumber}/timeline`);
      if (!response.ok) throw new Error('Failed to fetch order timeline');
      const data = await response.json();
      return data.timeline || [];
    } catch (error) {
      console.error('Error fetching order timeline:', error);
      return [];
    }
  },

  async advanceOrder(orderNumber: string, targetStatus: string, note?: string) {
    const response = await fetch(`${API_BASE}/orders/${orderNumber}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_status: targetStatus, note }),
    });
    if (!response.ok) {
      throw new Error('Failed to advance order');
    }
    return response.json();
  },

  async retryPayment(orderNumber: string, paymentId: string, scenario: 'success' | 'pending' | 'failed' = 'success') {
    const response = await fetch(`${API_BASE}/orders/${orderNumber}/payments/${paymentId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (!response.ok) {
      throw new Error('Failed to retry payment');
    }
    return response.json();
  },

  async createOrder(data: {
    user_id: string;
    items: any[];
    shipping_address: string;
    billing_address: string;
    payment_method: string;
    payment_scenario?: 'success' | 'pending' | 'failed';
  }) {
    try {
      const response = await fetch(`${API_BASE}/user/${data.user_id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_address: data.shipping_address,
          billing_address: data.billing_address,
          payment_method: data.payment_method,
          payment_scenario: data.payment_scenario || 'success',
          items: data.items,
        }),
      });
      if (!response.ok) throw new Error('Failed to create order');
      return await response.json();
    } catch (error) {
      console.error('Error creating order:', error);
      return null;
    }
  },
};

// ==================== Cart ====================

export const cartAPI = {
  // Get user's cart
  async getCart(userId: string) {
    try {
      const response = await fetch(`${API_BASE}/user/${userId}/cart`);
      if (!response.ok) throw new Error('Failed to fetch cart');
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error fetching cart:', error);
      return [];
    }
  },

  // Add item to cart
  async addToCart(
    userId: string,
    productId: string,
    quantity: number = 1,
    size?: string,
    color?: string
  ) {
    try {
      const params = new URLSearchParams({ quantity: String(quantity) });
      if (size) params.set('size', size);
      if (color) params.set('color', color);
      const response = await fetch(`${API_BASE}/user/${userId}/cart/add/${productId}?${params.toString()}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to add to cart');
      return await response.json();
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  },

  // Remove item from cart
  async removeFromCart(userId: string, productId: string) {
    try {
      const response = await fetch(`${API_BASE}/user/${userId}/cart/remove/${productId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove from cart');
      return await response.json();
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  },

  // Checkout
  async checkout(
    userId: string,
    shippingInfo: {
      address: string;
      city: string;
      state: string;
      zipCode: string;
    },
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      price: number;
      size: string;
      color: string;
    }>,
    totalAmount: number,
    options?: {
      paymentMethod?: string;
      paymentScenario?: 'success' | 'pending' | 'failed';
    }
  ) {
    try {
      const shippingAddress = `${shippingInfo.address}, ${shippingInfo.city}, ${shippingInfo.state} ${shippingInfo.zipCode}`;
      const response = await fetch(`${API_BASE}/user/${userId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_address: shippingAddress,
          billing_address: shippingAddress,
          payment_method: options?.paymentMethod || 'card',
          payment_scenario: options?.paymentScenario || 'success',
          items,
          total_amount: totalAmount,
        }),
      });
      if (!response.ok) throw new Error('Checkout failed');
      return await response.json();
    } catch (error) {
      console.error('Error during checkout:', error);
      throw error;
    }
  },
};

// ==================== Auth (already using real API) ====================

export const authAPI = {
  async register(email: string, password: string, firstName: string, lastName: string) {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        }),
      });
      if (!response.ok) throw new Error('Registration failed');
      return await response.json();
    } catch (error) {
      console.error('Error registering:', error);
      return null;
    }
  },

  async login(email: string, password: string) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error('Login failed');
      return await response.json();
    } catch (error) {
      console.error('Error logging in:', error);
      return null;
    }
  },

  async getProfile(userId: string): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/me/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch profile');
      return await response.json();
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  },

  async updateProfile(userId: string, updates: Record<string, any>): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/me/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return await response.json();
    } catch (error) {
      console.error('Error updating profile:', error);
      return null;
    }
  },

  async updateWhatsApp(
    userId: string,
    payload: { phone_number?: string | null; connected: boolean; opt_in: boolean }
  ): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/me/${userId}/whatsapp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to update WhatsApp connection');
      return await response.json();
    } catch (error) {
      console.error('Error updating WhatsApp connection:', error);
      return null;
    }
  },
};

export const wishlistAPI = {
  async getWishlist(userId: string) {
    try {
      const response = await fetch(`${API_BASE}/user/${userId}/wishlist`);
      if (!response.ok) throw new Error('Failed to fetch wishlist');
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      return [];
    }
  },

  async addItem(userId: string, productId: number) {
    const response = await fetch(`${API_BASE}/user/${userId}/wishlist/${productId}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to add wishlist item');
    }
    return response.json();
  },

  async removeItem(userId: string, productId: number) {
    const response = await fetch(`${API_BASE}/user/${userId}/wishlist/${productId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to remove wishlist item');
    }
    return response.json();
  },
};

export const chatAPI = {
  async getSessionMessages(sessionId: string): Promise<ChatHistoryMessage[]> {
    try {
      const response = await fetch(`${API_BASE}/chat/${sessionId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch chat history');
      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Error fetching chat history:', error);
      return [];
    }
  },

  async getUserSessions(userId: string): Promise<ChatSessionSummary[]> {
    try {
      const response = await fetch(`${API_BASE}/user/${userId}/chat/sessions`);
      if (!response.ok) throw new Error('Failed to fetch chat sessions');
      const data = await response.json();
      return data.sessions || [];
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      return [];
    }
  },
};

export const activityAPI = {
  async record(
    userId: string,
    payload: {
      activity_type: string;
      product_id?: number;
      order_number?: string;
      metadata?: Record<string, any>;
    }
  ) {
    const response = await fetch(`${API_BASE}/user/${userId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Failed to record activity');
    }
    return response.json();
  },

  async getSummary(userId: string): Promise<ActivitySummaryResponse> {
    try {
      const response = await fetch(`${API_BASE}/user/${userId}/activity/summary`);
      if (!response.ok) throw new Error('Failed to fetch activity summary');
      return await response.json();
    } catch (error) {
      console.error('Error fetching activity summary:', error);
      return {
        last_activity_at: null,
        recent_activities: [],
        abandoned_cart: false,
        cart_item_count: 0,
        top_product_views: [],
      };
    }
  },
};

export const communicationsAPI = {
  async getUserCommunications(userId: string): Promise<CommunicationsResponse> {
    try {
      const response = await fetch(`${API_BASE}/user/${userId}/communications`);
      if (!response.ok) throw new Error('Failed to fetch communications');
      return await response.json();
    } catch (error) {
      console.error('Error fetching communications:', error);
      return { notifications: [], call_workflows: [] };
    }
  },
};

export const adminAPI = {
  async getSimulationOrders(): Promise<{ orders: Order[] }> {
    try {
      const response = await fetch(`${API_BASE}/admin/simulation/orders`);
      if (!response.ok) throw new Error('Failed to fetch simulation orders');
      return await response.json();
    } catch (error) {
      console.error('Error fetching simulation orders:', error);
      return { orders: [] };
    }
  },
};

export const salesAPI = {
  async sendMessage(payload: SalesChatRequest): Promise<SalesChatResponse> {
    const requestBody = {
      channel: 'web',
      prompt: payload.message,
      ...payload,
    };

    let response = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 422) {
      response = await fetch(`${API_BASE}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: requestBody.channel,
          message: requestBody.message,
          prompt: requestBody.prompt,
        }),
      });
    }

    if (!response.ok) {
      throw new Error('Failed to reach sales assistant');
    }

    return response.json();
  },
};

export const voiceAgentAPI = {
  async sendMessage(payload: VoiceAgentRequest): Promise<VoiceAgentResponse> {
    const response = await fetch(`${API_BASE}/voice-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to reach voice agent');
    }

    return response.json();
  },
};
