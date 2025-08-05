'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  //  Use 'token' instead of 'fieldviz_token' to match api.ts
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await authAPI.getProfile();
      setUser(response.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login with:', email); // Debug log
      // 👈 FIXED: Pass email and password as separate parameters, not as an object
      const response = await authAPI.login(email, password);
      console.log('Login response:', response); // Debug log
      setToken(response.token);
      setUser(response.user);
      // 👈 FIXED: Use consistent token key
      localStorage.setItem('token', response.token); // Changed from 'fieldviz_token' to 'token'
    } catch (error) {
      console.error('Login error:', error); // Debug log
      throw error;
    }
  };

  const logout = () => {
  setUser(null);
  setToken(null);
  // 👈 FIXED: Use 'token' consistently
  localStorage.removeItem('token');
};

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};