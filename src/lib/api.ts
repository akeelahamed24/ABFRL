import { User, Product, CartItem, Order, OrderItem } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://abfrl-odbk.onrender.com';

// Create axios-like fetch wrapper
const apiClient = {
  get: async <T>(endpoint: string, token?: string): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  post: async <T>(endpoint: string, data: any, token?: string): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  put: async <T>(endpoint: string, data: any, token?: string): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  delete: async <T>(endpoint: string, token?: string): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};

// Auth endpoints
export const authAPI = {
  login: async (email: string, password: string) => {
    return apiClient.post<{ access_token: string; token_type: string }>('/login', { email, password });
  },

  signup: async (email: string, password: string, firstName: string, lastName: string) => {
    return apiClient.post<{ id: number; email: string; first_name: string; last_name: string; phone: string | null; loyalty_score: number; is_admin: boolean; created_at: string }>('/register', {
      email,
      password,
      first_name: firstName,
      last_name: lastName
    });
  },

  refreshToken: async (token: string) => {
    return apiClient.post<{ access_token: string; token_type: string }>('/auth/refresh', {}, token);
  },

  forgotPassword: async (email: string) => {
    return apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, password: string) => {
    return apiClient.post<{ message: string }>('/auth/reset-password', { token, password });
  },
};

// User endpoints
export const userAPI = {
  getProfile: async (token: string) => {
    return apiClient.get<User>('/me', token);
  },

  updateProfile: async (token: string, data: Partial<User>) => {
    return apiClient.put<User>('/me', data, token);
  },

  getOrders: async (token: string) => {
    return apiClient.get<Order[]>('/orders', token);
  },

  getOrderById: async (token: string, orderId: number) => {
    return apiClient.get<Order>(`/orders/${orderId}`, token);
  },

  getWishlist: async (token: string) => {
    // Wishlist functionality not implemented in backend yet
    // Return empty array for now
    return [];
  },

  addToWishlist: async (token: string, productId: number) => {
    // Wishlist functionality not implemented in backend yet
    // Return success message for now
    return { message: "Added to wishlist (backend not implemented)" };
  },

  removeFromWishlist: async (token: string, productId: number) => {
    // Wishlist functionality not implemented in backend yet
    // Return success message for now
    return { message: "Removed from wishlist (backend not implemented)" };
  },

  cancelOrder: async (token: string, orderId: number, data?: { reason?: string }) => {
    return apiClient.put<{ success: boolean; order_id: number; order_number: string; refund_result?: any }>(`/orders/${orderId}/cancel`, data || {}, token);
  },

  completePayment: async (token: string, orderId: number, paymentData: {
    payment_method: string;
    card_details?: {
      card_number: string;
      expiry_month: string;
      expiry_year: string;
      cvv: string;
    };
  }) => {
    return apiClient.post<{
      success: boolean;
      status: string;
      message: string;
      transaction_id?: string;
      order_id?: number;
      order_number?: string;
    }>(`/orders/${orderId}/pay`, paymentData, token);
  },
};

// Product endpoints
export const productAPI = {
  getAll: async (params?: any) => {
    try {
      const queryParams = new URLSearchParams();

      if (params) {
        Object.keys(params).forEach(key => {
          if (params[key] !== undefined && params[key] !== null) {
            queryParams.append(key, params[key]);
          }
        });
      }

      const url = `${API_BASE_URL}/products${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data; // Backend now returns paginated response
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  getById: async (id: number) => {
    try {
      const url = `${API_BASE_URL}/products/${id}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },

  getFeatured: async () => {
    try {
      const url = `${API_BASE_URL}/products/featured`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching featured products:', error);
      throw error;
    }
  },

  getRelated: async (productId: number) => {
    try {
      const url = `${API_BASE_URL}/products/${productId}/related`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching related products:', error);
      throw error;
    }
  },
};

// Cart endpoints
export const cartAPI = {
  getCart: async (token: string) => {
    return apiClient.get<CartItem[]>('/cart', token);
  },

  addToCart: async (token: string, productId: number, quantity: number, size: string, color: string) => {
    return apiClient.post<CartItem>('/cart', { product_id: productId, quantity }, token);
  },

  updateCartItem: async (token: string, cartItemId: number, quantity: number) => {
    return apiClient.put<CartItem>(`/cart/${cartItemId}`, { quantity }, token);
  },

  removeFromCart: async (token: string, cartItemId: number) => {
    return apiClient.delete<{ message: string }>(`/cart/${cartItemId}`, token);
  },

  clearCart: async (token: string) => {
    return apiClient.delete<{ message: string }>('/cart', token);
  },
};

// Order endpoints
export const orderAPI = {
  createOrder: async (token: string, data: {
    shipping_address: string;
    billing_address: string;
    payment_method: string;
    notes?: string;
  }) => {
    return apiClient.post<Order>('/orders', data, token);
  },

  getOrderById: async (token: string, orderId: number) => {
    return apiClient.get<Order>(`/orders/${orderId}`, token);
  },


  getOrders: async (token: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return apiClient.get<{ orders: Order[]; total: number; page: number; limit: number }>(
      `/orders${queryString ? `?${queryString}` : ''}`, token
    );
  },

  updateOrderStatus: async (token: string, orderId: number, status: string) => {
    return apiClient.put<Order>(`/admin/orders/${orderId}`, { status }, token);
  },

  cancelOrder: async (token: string, orderId: number) => {
    return apiClient.put<Order>(`/orders/${orderId}/cancel`, {}, token);
  },
};

// Checkout endpoints
export const checkoutAPI = {
  checkout: async (token: string, data: {
    shipping_address: string;
    billing_address: string;
    payment_method: string;
    notes?: string;
    card_details?: {
      card_number: string;
      expiry_month: string;
      expiry_year: string;
      cvv: string;
    };
  }) => {
    return apiClient.post<{
      success: boolean;
      order_id?: number;
      order_number?: string;
      final_amount?: number;
      payment_result?: any;
      items?: any[];
      error?: string;
      error_type?: string;
    }>('/checkout', data, token);
  },

  processPayment: async (token: string, orderId: number, data: {
    payment_method: string;
    card_details?: {
      card_number: string;
      expiry_month: string;
      expiry_year: string;
      cvv: string;
    };
  }) => {
    return apiClient.post<{
      success: boolean;
      status: string;
      message: string;
      transaction_id?: string;
      order_id?: number;
      order_number?: string;
    }>(`/orders/${orderId}/pay`, data, token);
  },

  getPaymentStatus: async (token: string, orderId: number) => {
    return apiClient.get<{
      order_id: number;
      order_number: string;
      payment_status: string;
      payment_method: string;
      transaction_id?: string;
      final_amount: number;
      order_status: string;
    }>(`/orders/${orderId}/payment-status`, token);
  },

  getPaymentMethods: async () => {
    return apiClient.get<{
      credit_card: any;
      debit_card: any;
      net_banking: any;
      upi: any;
      wallet: any;
    }>('/payment-methods');
  },

  getCheckoutPreview: async (token: string) => {
    return apiClient.get<{
      has_items: boolean;
      item_count?: number;
      valid_items?: any[];
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
    }>('/cart/checkout-preview', token);
  },

  cancelOrder: async (token: string, orderId: number) => {
    return apiClient.put<{
      success: boolean;
      order_id: number;
      order_number: string;
      refund_result?: {
        status: string;
        message: string;
        amount: number;
      };
    }>(`/orders/${orderId}/cancel`, {}, token);
  },
};

// Chatbot endpoints
export const chatAPI = {
  sendMessage: async (token: string, data: {
    session_id: string;
    user_id: string;
    message: string;
    context?: any;
  }) => {
    return apiClient.post<{
      session_id: string;
      response: string;
      agent_type: string;
      suggested_actions?: any[];
      next_steps?: string[];
    }>('/chat', data, token);
  },

  getSessionHistory: async (token: string, sessionId: string) => {
    return apiClient.get<{
      user_id: string;
      created_at: string;
      messages: any[];
      context: any;
    }>(`/session/${sessionId}`, token);
  },

  getAgentsStatus: async (token: string) => {
    return apiClient.get<{
      sales_agent: any;
      recommendation_agent: any;
      inventory_agent: any;
      payment_agent: any;
      fulfillment_agent: any;
      loyalty_agent: any;
      support_agent: any;
    }>('/agents/status', token);
  },
};

// Categories and filters
export const categoryAPI = {
  getAll: async () => {
    return apiClient.get<{ categories: any[] }>('/categories');
  },

  getOccasions: async () => {
    return apiClient.get<{ occasions: any[] }>('/occasions');
  },

  getSizes: async () => {
    return apiClient.get<{ sizes: string[] }>('/sizes');
  },

  getColors: async () => {
    return apiClient.get<{ colors: string[] }>('/colors');
  },
};

// Export default API base URL for use in components
export { API_BASE_URL };