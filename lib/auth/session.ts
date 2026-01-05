/**
 * Session management utilities
 * Uses localStorage to persist user session
 */

import type { User } from '@/types';

const SESSION_KEY = 'aetheria_session';
const SESSION_EXPIRY_DAYS = 7;

export interface SessionData {
  user: User;
  expiresAt: string;
}

/**
 * Save session to localStorage
 */
export function saveSession(user: User): void {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  const sessionData: SessionData = {
    user,
    expiresAt: expiresAt.toISOString(),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  }
}

/**
 * Get current session from localStorage
 */
export function getSession(): SessionData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const sessionJson = localStorage.getItem(SESSION_KEY);
  if (!sessionJson) {
    return null;
  }

  try {
    const sessionData: SessionData = JSON.parse(sessionJson);

    // Check if session is expired
    const expiresAt = new Date(sessionData.expiresAt);
    if (expiresAt < new Date()) {
      clearSession();
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error('Failed to parse session data:', error);
    clearSession();
    return null;
  }
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getSession() !== null;
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  const session = getSession();
  return session?.user || null;
}
