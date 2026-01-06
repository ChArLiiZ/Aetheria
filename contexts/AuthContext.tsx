'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types';
import { getSession, saveSession, clearSession } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
// 動態匯入服務 - 根據是否設定 Apps Script URL 來決定
import {
  getUserByEmail as getUserByEmailMock,
  createUser as createUserMock,
  updateLastLogin as updateLastLoginMock,
} from '@/services/sheets/users.mock';

import {
  getUserByEmail as getUserByEmailAppsScript,
  createUser as createUserAppsScript,
  updateLastLogin as updateLastLoginAppsScript,
} from '@/services/sheets/users-appsscript';

// 執行時檢查環境變數
function getService() {
  const hasAppsScript = !!process.env.NEXT_PUBLIC_SHEETS_API_URL;

  if (hasAppsScript) {
    return {
      getUserByEmail: getUserByEmailAppsScript,
      createUser: createUserAppsScript,
      updateLastLogin: updateLastLoginAppsScript,
    };
  } else {
    return {
      getUserByEmail: getUserByEmailMock,
      createUser: createUserMock,
      updateLastLogin: updateLastLoginMock,
    };
  }
}

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
      const service = getService();

      // Get user from database
      const dbUser = await service.getUserByEmail(email);

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
      await service.updateLastLogin(dbUser.user_id);

      // Save session
      saveSession(dbUser);
      setUser(dbUser);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (email: string, displayName: string, password: string) => {
    try {
      const service = getService();

      // Check if email already exists
      const existingUser = await service.getUserByEmail(email);
      if (existingUser) {
        throw new Error('此電子郵件已被註冊');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const newUser = await service.createUser({
        email,
        display_name: displayName,
        password_hash: passwordHash,
      });

      // Save session
      saveSession(newUser);
      setUser(newUser);
    } catch (error: any) {
      console.error('Registration failed:', error);

      // 提供更友善的錯誤訊息
      if (error.message?.includes('fetch')) {
        throw new Error('無法連接到資料庫。請確認 Apps Script API 已正確設定。');
      } else if (error.message?.includes('SHEETS_API_URL')) {
        throw new Error('Apps Script URL 未設定。目前使用本地儲存模式。');
      } else {
        throw error;
      }
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
