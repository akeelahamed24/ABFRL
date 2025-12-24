import React, { createContext, useContext, useState, useCallback } from 'react';
import { User } from '@/types';
import { mockUsers } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, _password: string): Promise<boolean> => {
    // Mock login - find user by email
    const foundUser = mockUsers.find((u) => u.email === email);
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    return false;
  }, []);

  const signup = useCallback(async (
    email: string, 
    _password: string, 
    firstName: string, 
    lastName: string
  ): Promise<boolean> => {
    // Mock signup - create new user
    const newUser: User = {
      id: mockUsers.length + 1,
      email,
      password_hash: 'mock_hash',
      first_name: firstName,
      last_name: lastName,
      phone: null,
      address: null,
      city: null,
      state: null,
      country: null,
      postal_code: null,
      loyalty_score: 0,
      is_active: true,
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setUser(newUser);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
