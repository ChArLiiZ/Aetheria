'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types';
import { getSession, saveSession, clearSession } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
// 直接使用 Apps Script 服務（Google Sheets）
import {
  getUserByEmail,
  createUser as createUserInDb,
  updateLastLogin,
} from '@/services/sheets/users-appsscript';

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
      // Get user from database
      const dbUser = await getUserByEmail(email);

      if (!dbUser) {
        throw new Error('帳號或密碼錯誤');
      }

      // Verify password
      const isValid = await verifyPassword(password, dbUser.password_hash);
      if (!isValid) {
        throw new Error('帳號或密碼錯誤');
      }

      // Check if user is active
      if (dbUser.status !== 'active') {
        throw new Error('此帳號已被停用');
      }

      // Update last login
      await updateLastLogin(dbUser.user_id);

      // Save session
      saveSession(dbUser);
      setUser(dbUser);
    } catch (error: any) {
      console.error('Login failed:', error);

      // 友善的錯誤訊息
      if (error.message?.includes('SHEETS_API_URL')) {
        throw new Error('請先設定 Google Apps Script API。參考 APPS_SCRIPT_SETUP.md');
      }
      throw error;
    }
  };

  const register = async (email: string, displayName: string, password: string) => {
    try {
      // Check if email already exists
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        throw new Error('此電子郵件已被註冊');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const newUser = await createUserInDb({
        email,
        display_name: displayName,
        password_hash: passwordHash,
      });

      // Save session
      saveSession(newUser);
      setUser(newUser);
    } catch (error: any) {
      console.error('Registration failed:', error);

      // 友善的錯誤訊息
      if (error.message?.includes('SHEETS_API_URL')) {
        throw new Error('請先設定 Google Apps Script API。參考 APPS_SCRIPT_SETUP.md');
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
