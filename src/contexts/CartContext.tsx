import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Product } from '@/types';
import { cartAPI, productAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

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
  clearCart: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  totalItems: number;
  subtotal: number;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'cart_items';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const userId = user?.id ?? null;

  // Load cart from localStorage on mount (for offline mode)
  useEffect(() => {
    const savedCart = localStorage.getItem(STORAGE_KEY);
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Failed to parse saved cart:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const syncCart = async () => {
      if (!userId) {
        return;
      }

      try {
        setIsLoading(true);
        const cartItems = await cartAPI.getCart(userId);
        const hydratedItems = await Promise.all(
          cartItems.map(async (item: any, index: number) => {
            const product = await productAPI.getProduct(item.product_id);
            if (!product) {
              return null;
            }

            return {
              id: Number(`${item.product_id}${index}`),
              product,
              quantity: item.quantity,
              size: item.size || 'Standard',
              color: item.color || 'Default',
            };
          })
        );

        setItems(hydratedItems.filter(Boolean) as CartItemWithProduct[]);
      } catch (error) {
        console.error('Failed to sync cart:', error);
      } finally {
        setIsLoading(false);
      }
    };

    syncCart();
  }, [userId]);

  const addItem = useCallback(async (product: Product, quantity: number, size: string, color: string) => {
    try {
      setIsLoading(true);
      
      // Optimistic update
      setItems(prev => {
        const existingIndex = prev.findIndex(
          (item) => item.product.id === product.id && item.size === size && item.color === color
        );
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
          };
          return updated;
        }
        
        return [...prev, {
          id: Date.now(),
          product,
          quantity,
          size,
          color
        }];
      });
      
      setIsOpen(true);

      // Call API if user is logged in
      if (userId) {
        await cartAPI.addToCart(userId, product.id?.toString() || '', quantity, size, color);
      }
    } catch (error) {
      console.error('Failed to add item to cart:', error);
      // Keep the optimistic update even if API fails (offline mode)
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const removeItem = useCallback(async (id: number) => {
    try {
      setIsLoading(true);
      
      // Optimistic update
      const itemToRemove = items.find(item => item.id === id);
      setItems((prev) => prev.filter((item) => item.id !== id));

      // Call API if user is logged in
      if (userId && itemToRemove) {
        await cartAPI.removeFromCart(userId, itemToRemove.product.id?.toString() || '');
      }
    } catch (error) {
      console.error('Failed to remove item from cart:', error);
      // Keep the optimistic update
    } finally {
      setIsLoading(false);
    }
  }, [items, userId]);

  const updateQuantity = useCallback(async (id: number, quantity: number) => {
    try {
      setIsLoading(true);
      
      if (quantity < 1) {
        await removeItem(id);
        return;
      }

      // Optimistic update
      const itemToUpdate = items.find(item => item.id === id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity } : item))
      );

      // Call API if user is logged in
      if (userId && itemToUpdate) {
        await cartAPI.removeFromCart(userId, itemToUpdate.product.id?.toString() || '');
        await cartAPI.addToCart(
          userId,
          itemToUpdate.product.id?.toString() || '',
          quantity,
          itemToUpdate.size,
          itemToUpdate.color
        );
      }
    } catch (error) {
      console.error('Failed to update cart quantity:', error);
      // Keep the optimistic update
    } finally {
      setIsLoading(false);
    }
  }, [items, userId, removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

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
