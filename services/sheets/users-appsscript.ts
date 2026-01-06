/**
 * Users Service (Google Apps Script version)
 */

import { User, UserStatus } from '@/types';
import {
  readSheet,
  appendToSheet,
  updateSheet,
  rowsToObjects,
  objectToRow,
  findRowIndex,
  now,
  generateId,
  SHEETS,
} from '@/lib/db/sheets-client-appsscript';

const HEADERS = [
  'user_id',
  'email',
  'display_name',
  'password_hash',
  'created_at',
  'updated_at',
  'status',
  'last_login_at',
];

/**
 * Get all users (admin only - not filtered by user_id)
 */
export async function getAllUsers(): Promise<User[]> {
  const rows = await readSheet(SHEETS.USERS);
  return rowsToObjects<User>(rows);
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const users = await getAllUsers();
  return users.find((u) => u.user_id === userId) || null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await getAllUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Create new user
 */
export async function createUser(data: {
  email: string;
  display_name: string;
  password_hash: string;
}): Promise<User> {
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

  const row = objectToRow(user, HEADERS);
  await appendToSheet(SHEETS.USERS, [row]);

  return user;
}

/**
 * Update user
 */
export async function updateUser(
  userId: string,
  updates: Partial<Pick<User, 'display_name' | 'status' | 'last_login_at'>>
): Promise<void> {
  const users = await getAllUsers();
  const rowIndex = findRowIndex(users, (u) => u.user_id === userId);

  if (rowIndex === -1) {
    throw new Error('User not found');
  }

  const user = users[rowIndex - 2]; // Adjust for header
  const updatedUser = {
    ...user,
    ...updates,
    updated_at: now(),
  };

  const row = objectToRow(updatedUser, HEADERS);
  await updateSheet(SHEETS.USERS, `A${rowIndex}:H${rowIndex}`, [row]);
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await updateUser(userId, { last_login_at: now() });
}

/**
 * Check if email exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const user = await getUserByEmail(email);
  return user !== null;
}
