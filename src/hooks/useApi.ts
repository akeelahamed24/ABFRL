import { useState, useEffect, useCallback } from 'react';
import { FetchProductsParams, productAPI, orderAPI } from '@/services/api';
import { CatalogCategoryMeta, CatalogOccasionMeta } from '@/types';

// ==================== Product Hook ====================

export const useProducts = (params?: FetchProductsParams) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productAPI.getProducts(params);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
};

export const useCatalogMeta = () => {
  const [categories, setCategories] = useState<CatalogCategoryMeta[]>([]);
  const [occasions, setOccasions] = useState<CatalogOccasionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        setLoading(true);
        const data = await productAPI.getCatalogMeta();
        setCategories(data.categories || []);
        setOccasions(data.occasions || []);
      } finally {
        setLoading(false);
      }
    };

    fetchMeta();
  }, []);

  return { categories, occasions, loading };
};

// ==================== Orders Hook ====================

export const useOrders = (userId?: string) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await orderAPI.getOrders(userId);
        setOrders(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [userId]);

  return { orders, loading, error };
};
