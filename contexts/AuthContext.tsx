'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { User } from '@/types';
import { supabase } from '@/lib/supabase/client';
import {
  login as loginWithSupabase,
  register as registerWithSupabase,
  logout as logoutWithSupabase,
  getCurrentUser,
} from '@/services/supabase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initAttempted = useRef(false);

  // Load session on mount and listen for auth changes
  useEffect(() => {
    // 防止 StrictMode 重複執行
    if (initAttempted.current) return;
    initAttempted.current = true;

    let cancelled = false;

    const refreshUser = async (): Promise<User | null> => {
      try {
        const currentUser = await getCurrentUser();
        if (!cancelled) {
          setUser(currentUser);
        }
        return currentUser;
      } catch (error) {
        console.error('Failed to refresh user:', error);
        return null;
      }
    };

    // Get initial session
    const initAuth = async () => {
      try {
        // 先嘗試從 Supabase 快取取得 session
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          // 有 session，嘗試載入完整用戶資料
          await refreshUser();
        } else {
          // 沒有 session，用戶未登入
          setUser(null);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load user:', error);
        // 錯誤時，假設用戶未登入
        setUser(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // 注意：不要在這個回調中使用 async/await！
        // 這是 Supabase SDK 的已知問題，會導致死鎖。
        // 參考：https://github.com/supabase/supabase-js/issues/762
        if (cancelled) return;

        console.log('Auth state changed:', event);

        if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (
          event === 'SIGNED_IN' ||
          event === 'USER_UPDATED' ||
          event === 'TOKEN_REFRESHED'
        ) {
          if (session?.user) {
            // 使用 setTimeout 延遲執行，避免死鎖
            setTimeout(() => {
              if (!cancelled) {
                refreshUser();
              }
            }, 0);
          }
        }
        // INITIAL_SESSION 不處理，讓 initAuth 處理初始化
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await loginWithSupabase(email, password);

      if (!result.success || !result.user) {
        throw new Error(result.error || '登入失敗');
      }

      setUser(result.user);
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (email: string, displayName: string, password: string) => {
    try {
      const result = await registerWithSupabase(email, password, displayName);

      if (!result.success || !result.user) {
        throw new Error(result.error || '註冊失敗');
      }

      setUser(result.user);
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await logoutWithSupabase();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
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
