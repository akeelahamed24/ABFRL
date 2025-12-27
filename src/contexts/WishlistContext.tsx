import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Product } from '@/types';
import { userAPI } from '@/lib/api';
import { useAuth } from './AuthContext';

interface WishlistContextType {
  items: Product[];
  addItem: (productId: number) => Promise<void>;
  removeItem: (productId: number) => Promise<void>;
  isInWishlist: (productId: number) => boolean;
  toggleItem: (productId: number) => Promise<void>;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user, getToken } = useAuth();

  const loadWishlist = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      const wishlistItems = await userAPI.getWishlist(token);
      setItems(wishlistItems);
    } catch (error) {
      console.error('Failed to load wishlist:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const addItem = useCallback(async (productId: number) => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      await userAPI.addToWishlist(token, productId);
      // Refetch wishlist to get updated list
      await loadWishlist();
    } catch (error) {
      console.error('Failed to add item to wishlist:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, loadWishlist]);

  const removeItem = useCallback(async (productId: number) => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      await userAPI.removeFromWishlist(token, productId);
      setItems((prev) => prev.filter((p) => p.id !== productId));
    } catch (error) {
      console.error('Failed to remove item from wishlist:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const isInWishlist = useCallback((productId: number) => {
    return items.some((p) => p.id === productId);
  }, [items]);

  const toggleItem = useCallback(async (productId: number) => {
    if (isInWishlist(productId)) {
      await removeItem(productId);
    } else {
      await addItem(productId);
    }
  }, [isInWishlist, removeItem, addItem]);

  return (
    <WishlistContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        isInWishlist,
        toggleItem,
        isLoading,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
