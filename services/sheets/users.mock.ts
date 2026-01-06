/**
 * Mock Users Service (localStorage-based)
 *
 * This is a temporary implementation for development/testing.
 * Data is stored in localStorage instead of Google Sheets.
 *
 * TODO: Switch to real Sheets implementation when OAuth/Service Account is set up.
 */

import type { User } from '@/types';
import { now, generateId } from '@/lib/db/sheets-client';

const USERS_STORAGE_KEY = 'aetheria_mock_users';

/**
 * Get all users from localStorage
 */
function getMockUsers(): User[] {
  if (typeof window === 'undefined') return [];

  const data = localStorage.getItem(USERS_STORAGE_KEY);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save users to localStorage
 */
function saveMockUsers(users: User[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const users = getMockUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const users = getMockUsers();
  return users.find((u) => u.user_id === userId) || null;
}

/**
 * Create new user
 */
export async function createUser(data: {
  email: string;
  display_name: string;
  password_hash: string;
}): Promise<User> {
  const users = getMockUsers();

  const timestamp = now();
  const user: User = {
    user_id: generateId(),
    email: data.email.toLowerCase(),
    display_name: data.display_name,
    password_hash: data.password_hash,
    created_at: timestamp,
    updated_at: timestamp,
    status: 'active',
  };

  users.push(user);
  saveMockUsers(users);

  return user;
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  const users = getMockUsers();
  const userIndex = users.findIndex((u) => u.user_id === userId);

  if (userIndex !== -1) {
    users[userIndex].last_login_at = now();
    users[userIndex].updated_at = now();
    saveMockUsers(users);
  }
}

/**
 * Check if email exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const user = await getUserByEmail(email);
  return user !== null;
}

/**
 * Get all users (for admin/debugging)
 */
export async function getAllUsers(): Promise<User[]> {
  return getMockUsers();
}
