import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '@/types';
import { authAPI, userAPI } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveToken = (token: string) => {
    localStorage.setItem('auth_token', token);
  };

  const getToken = () => {
    return localStorage.getItem('auth_token');
  };

  const removeToken = () => {
    localStorage.removeItem('auth_token');
  };

  const fetchUserProfile = useCallback(async (token: string) => {
    try {
      const userData = await userAPI.getProfile(token);
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await authAPI.login(email, password);
      saveToken(response.access_token);
      // For login, we need to fetch the user profile separately
      const userData = await userAPI.getProfile(response.access_token);
      setUser(userData);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
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
    try {
      setIsLoading(true);
      const response = await authAPI.signup(email, password, firstName, lastName);
      // For signup, we need to login to get the token
      const loginResponse = await authAPI.login(email, password);
      saveToken(loginResponse.access_token);
      // Fetch the complete user profile
      const userData = await userAPI.getProfile(loginResponse.access_token);
      setUser(userData);
      return true;
    } catch (error) {
      console.error('Signup failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    removeToken();
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        const response = await authAPI.refreshToken(token);
        saveToken(response.access_token);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  }, [logout]);

  // Check for existing token on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchUserProfile(token);
    }
    setIsLoading(false);
  }, [fetchUserProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !!getToken(),
        isLoading,
        login,
        signup,
        logout,
        refreshToken,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
