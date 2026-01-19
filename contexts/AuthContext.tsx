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
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initAttempted = useRef(false);

  // 用於追蹤組件是否已卸載的 ref
  const cancelledRef = useRef(false);

  // 外部可調用的 refreshUser 函式（例如從設定頁面更新頭像後）
  const refreshUser = async (): Promise<void> => {
    try {
      const currentUser = await getCurrentUser();
      // 檢查組件是否已卸載
      if (!cancelledRef.current) {
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  // Load session on mount and listen for auth changes
  useEffect(() => {
    // 防止 StrictMode 重複執行
    if (initAttempted.current) return;
    initAttempted.current = true;

    // 重置 cancelled 狀態（組件重新掛載時）
    cancelledRef.current = false;

    // 內部版本的 refreshUser，直接使用 cancelledRef
    const refreshUserInternal = async (): Promise<void> => {
      try {
        const currentUser = await getCurrentUser();
        if (!cancelledRef.current) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Failed to refresh user:', error);
      }
    };

    // Get initial session
    const initAuth = async () => {
      try {
        // 先嘗試從 Supabase 快取取得 session
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelledRef.current) return;

        if (session?.user) {
          // 有 session，嘗試載入完整用戶資料
          await refreshUserInternal();
        } else {
          // 沒有 session，用戶未登入
          setUser(null);
        }
      } catch (error) {
        if (cancelledRef.current) return;
        console.error('Failed to load user:', error);
        // 錯誤時，假設用戶未登入
        setUser(null);
      } finally {
        if (!cancelledRef.current) {
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
        if (cancelledRef.current) return;

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
              if (!cancelledRef.current) {
                refreshUserInternal();
              }
            }, 0);
          }
        }
        // INITIAL_SESSION 不處理，讓 initAuth 處理初始化
      }
    );

    return () => {
      cancelledRef.current = true;
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
    refreshUser,
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
