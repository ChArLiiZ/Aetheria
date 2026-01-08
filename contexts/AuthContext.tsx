'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types';
import { getSession, saveSession, clearSession } from '@/lib/auth/session';
// 使用 Supabase 服務
import {
  login as loginWithSupabase,
  register as registerWithSupabase,
  getCurrentUser,
} from '@/services/supabase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session on mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session.user);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await loginWithSupabase(email, password);

      if (!result.success || !result.user) {
        throw new Error(result.error || '登入失敗');
      }

      // Save session
      saveSession(result.user);
      setUser(result.user);
    } catch (error: any) {
      console.error('Login failed:', error);

      // 友善的錯誤訊息
      if (error.message?.includes('SUPABASE')) {
        throw new Error('請先設定 Supabase 連接。參考 SUPABASE_SETUP.md');
      }
      throw error;
    }
  };

  const register = async (email: string, displayName: string, password: string) => {
    try {
      const result = await registerWithSupabase(email, password, displayName);

      if (!result.success || !result.user) {
        throw new Error(result.error || '註冊失敗');
      }

      // Save session
      saveSession(result.user);
      setUser(result.user);
    } catch (error: any) {
      console.error('Registration failed:', error);

      // 友善的錯誤訊息
      if (error.message?.includes('SUPABASE')) {
        throw new Error('請先設定 Supabase 連接。參考 SUPABASE_SETUP.md');
      }
      throw error;
    }
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: user !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
