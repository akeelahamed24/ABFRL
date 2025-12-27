import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Product } from '@/types';
import { cartAPI } from '@/lib/api';
import { useAuth } from './AuthContext';

interface CartItemWithProduct {
  id: number;
  product: Product;
  quantity: number;
  size: string;
  color: string;
}

interface CartContextType {
  items: CartItemWithProduct[];
  addItem: (product: Product, quantity: number, size: string, color: string) => Promise<void>;
  removeItem: (id: number) => Promise<void>;
  updateQuantity: (id: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  totalItems: number;
  subtotal: number;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, getToken } = useAuth();

  const loadCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      const cartItems = await cartAPI.getCart(token);
      
      // Map cart items to expected format with product details
      const itemsWithProducts = cartItems.map((cartItem: any) => {
        try {
          return {
            id: cartItem.id,
            product: {
              id: cartItem.product_id,
              product_name: cartItem.product_name,
              price: cartItem.price,
              dress_category: 'unknown', // Default since not provided
              occasion: null,
              stock: 0, // Default since not provided
              material: null,
              available_sizes: null,
              colors: null,
              image_url: cartItem.image_url,
              featured_dress: false,
              created_at: cartItem.added_at,
              updated_at: cartItem.added_at,
            },
            quantity: cartItem.quantity,
            size: 'M', // Default since backend doesn't store size/color
            color: 'Default',
          };
        } catch (error) {
          console.error('Failed to process cart item:', error);
          return null;
        }
      });

      setItems(itemsWithProducts.filter(item => item !== null) as CartItemWithProduct[]);
    } catch (error) {
      console.error('Failed to load cart:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const addItem = useCallback(async (product: Product, quantity: number, size: string, color: string) => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      const cartItem = await cartAPI.addToCart(token, product.id, quantity, size, color);
      
      // Update local state
      setItems(prev => {
        const existingIndex = prev.findIndex(
          (item) => item.product.id === product.id && item.size === size && item.color === color
        );
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
            id: cartItem.id,
          };
          return updated;
        }
        
        return [...prev, {
          id: cartItem.id,
          product,
          quantity,
          size,
          color
        }];
      });
      
      setIsOpen(true);
    } catch (error) {
      console.error('Failed to add item to cart:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const removeItem = useCallback(async (id: number) => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      await cartAPI.removeFromCart(token, id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Failed to remove item from cart:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const updateQuantity = useCallback(async (id: number, quantity: number) => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      if (quantity < 1) {
        await removeItem(id);
        return;
      }

      await cartAPI.updateCartItem(token, id, quantity);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
    } catch (error) {
      console.error('Failed to update cart item quantity:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, removeItem]);

  const clearCart = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      await cartAPI.clearCart(token);
      setItems([]);
    } catch (error) {
      console.error('Failed to clear cart:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isOpen,
        openCart,
        closeCart,
        totalItems,
        subtotal,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
