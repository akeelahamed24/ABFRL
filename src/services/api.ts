// API service for communicating with backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ==================== Products ====================

export interface FetchProductsParams {
  category?: string;
}

export const productAPI = {
  // Get all products or filter by category
  async getProducts(params?: FetchProductsParams) {
    try {
      const url = new URL(`${API_BASE}/products`);
      if (params?.category) {
        url.searchParams.append('category', params.category);
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
  async getProduct(productId: number) {
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
      const response = await fetch(`${API_BASE}/products/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.products || [];
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  },
};

// ==================== Orders ====================

export const orderAPI = {
  // Get user's orders
  async getOrders(userId: string) {
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
  async getOrder(orderNumber: string) {
    try {
      const response = await fetch(`${API_BASE}/orders/${orderNumber}`);
      if (!response.ok) throw new Error('Order not found');
      return await response.json();
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  },

  // Create order (checkout)
  async createOrder(data: {
    user_id: string;
    items: any[];
    shipping_address: string;
    billing_address: string;
    payment_method: string;
  }) {
    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
  async addToCart(userId: string, productId: string, quantity: number = 1) {
    try {
      const response = await fetch(`${API_BASE}/user/${userId}/cart/add/${productId}?quantity=${quantity}`, {
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
    totalAmount: number
  ) {
    try {
      const response = await fetch(`${API_BASE}/user/${userId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shipping_address: `${shippingInfo.address}, ${shippingInfo.city}, ${shippingInfo.state} ${shippingInfo.zipCode}`,
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

  async getProfile(userId: string) {
    try {
      const response = await fetch(`${API_BASE}/auth/me/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch profile');
      return await response.json();
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  },

  async updateProfile(userId: string, updates: Record<string, any>) {
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
};
