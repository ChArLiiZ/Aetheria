/**
 * Password hashing utilities using Web Crypto API
 *
 * Note: In a production app with a backend, password hashing should be done server-side.
 * This is a simplified client-side implementation for the Google Sheets architecture.
 */

/**
 * Hash a password using SHA-256
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('密碼至少需要 8 個字元');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('密碼需要包含至少一個大寫字母');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('密碼需要包含至少一個小寫字母');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('密碼需要包含至少一個數字');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
