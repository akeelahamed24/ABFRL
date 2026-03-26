import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Product } from '@/types';
import { wishlistAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface WishlistContextType {
  items: Product[];
  addItem: (product: Product) => Promise<void>;
  removeItem: (productId: number) => Promise<void>;
  isInWishlist: (productId: number) => boolean;
  toggleItem: (product: Product) => Promise<void>;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const STORAGE_KEY = 'wishlist_items';

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    const loadWishlist = async () => {
      if (userId) {
        setIsLoading(true);
        try {
          const wishlistItems = await wishlistAPI.getWishlist(userId);
          setItems(wishlistItems);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      const savedWishlist = localStorage.getItem(STORAGE_KEY);
      if (savedWishlist) {
        try {
          setItems(JSON.parse(savedWishlist));
        } catch (error) {
          console.error('Failed to parse saved wishlist:', error);
          localStorage.removeItem(STORAGE_KEY);
        }
      } else {
        setItems([]);
      }
    };

    void loadWishlist();
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, userId]);

  const addItem = useCallback(async (product: Product) => {
    setItems(prev => {
      if (prev.some(p => p.id === product.id)) {
        return prev;
      }
      return [...prev, product];
    });

    if (userId) {
      await wishlistAPI.addItem(userId, product.id);
    }
  }, [userId]);

  const removeItem = useCallback(async (productId: number) => {
    setItems((prev) => prev.filter((p) => p.id !== productId));

    if (userId) {
      await wishlistAPI.removeItem(userId, productId);
    }
  }, [userId]);

  const isInWishlist = useCallback((productId: number) => {
    return items.some((p) => p.id === productId);
  }, [items]);

  const toggleItem = useCallback(async (product: Product) => {
    if (isInWishlist(product.id)) {
      await removeItem(product.id);
    } else {
      await addItem(product);
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
