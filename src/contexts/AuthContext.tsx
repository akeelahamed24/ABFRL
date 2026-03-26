import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'auth_user';
const TOKEN_KEY = 'auth_token';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    const savedToken = localStorage.getItem(TOKEN_KEY);
    
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        console.error('Login failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      
      if (data.success && data.user) {
        // Convert API response to User type
        const userData: User = {
          id: parseInt(data.user.id) || Date.now(),
          email: data.user.email,
          password_hash: '',
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          phone: data.user.phone || null,
          address: data.user.address || null,
          city: data.user.city || null,
          state: data.user.state || null,
          country: data.user.country || null,
          postal_code: data.user.postal_code || null,
          loyalty_score: data.user.loyalty_score || 0,
          is_active: data.user.is_active || true,
          is_admin: data.user.is_admin || false,
          created_at: data.user.created_at || new Date().toISOString(),
          updated_at: data.user.updated_at || new Date().toISOString(),
        };

        setUser(userData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        localStorage.setItem(TOKEN_KEY, data.token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      if (!response.ok) {
        console.error('Signup failed:', response.statusText);
        return false;
      }

      const data = await response.json();

      if (data.success && data.user) {
        // Convert API response to User type
        const userData: User = {
          id: parseInt(data.user.id) || Date.now(),
          email: data.user.email,
          password_hash: '',
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          phone: data.user.phone || null,
          address: data.user.address || null,
          city: data.user.city || null,
          state: data.user.state || null,
          country: data.user.country || null,
          postal_code: data.user.postal_code || null,
          loyalty_score: data.user.loyalty_score || 0,
          is_active: data.user.is_active || true,
          is_admin: data.user.is_admin || false,
          created_at: data.user.created_at || new Date().toISOString(),
          updated_at: data.user.updated_at || new Date().toISOString(),
        };

        setUser(userData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        localStorage.setItem(TOKEN_KEY, data.token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
