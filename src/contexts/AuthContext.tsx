import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '@/types';
import { authAPI } from '@/services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  updateWhatsAppConnection: (payload: { phone_number?: string | null; connected: boolean; opt_in: boolean }) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'auth_user';
const TOKEN_KEY = 'auth_token';

const mapApiUserToUser = (apiUser: any): User => ({
  id: apiUser.id,
  email: apiUser.email,
  password_hash: '',
  first_name: apiUser.first_name,
  last_name: apiUser.last_name,
  phone: apiUser.phone || null,
  address: apiUser.address || null,
  city: apiUser.city || null,
  state: apiUser.state || null,
  country: apiUser.country || null,
  postal_code: apiUser.postal_code || null,
  loyalty_score: apiUser.loyalty_score || 0,
  is_active: apiUser.is_active ?? true,
  is_admin: apiUser.is_admin ?? false,
  whatsapp_connection: apiUser.whatsapp_connection || null,
  created_at: apiUser.created_at || new Date().toISOString(),
  updated_at: apiUser.updated_at || new Date().toISOString(),
});

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
      const data = await authAPI.login(email, password);
      
      if (data.success && data.user) {
        const userData = mapApiUserToUser(data.user);

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
      const data = await authAPI.register(email, password, firstName, lastName);

      if (data.success && data.user) {
        const userData = mapApiUserToUser(data.user);

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

  const updateProfile = useCallback(async (updates: Partial<User>): Promise<boolean> => {
    if (!user?.id) {
      return false;
    }

    setIsLoading(true);
    try {
      const updatedUser = await authAPI.updateProfile(user.id, updates);
      if (!updatedUser) {
        return false;
      }

      const nextUser = mapApiUserToUser(updatedUser);
      setUser(nextUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      return true;
    } catch (error) {
      console.error('Update profile error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateWhatsAppConnection = useCallback(async (
    payload: { phone_number?: string | null; connected: boolean; opt_in: boolean }
  ): Promise<boolean> => {
    if (!user?.id) {
      return false;
    }

    setIsLoading(true);
    try {
      const updatedUser = await authAPI.updateWhatsApp(user.id, payload);
      if (!updatedUser) {
        return false;
      }

      const nextUser = mapApiUserToUser(updatedUser);
      setUser(nextUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      return true;
    } catch (error) {
      console.error('Update WhatsApp connection error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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
        updateProfile,
        updateWhatsAppConnection,
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
