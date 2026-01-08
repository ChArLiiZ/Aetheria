'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Load session on mount and listen for auth changes
  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'USER_UPDATED' && session?.user) {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        }
      }
    );

    return () => {
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
