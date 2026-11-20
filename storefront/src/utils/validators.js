/**
 * Validation utilities for forms.
 * Used by signup, profile, trade-in, and other forms.
 */

/**
 * Validate password strength.
 * Requirements: at least 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char.
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePassword(password) {
  const errors = [];
  if (!password) {
    return { valid: false, errors: ['Password is required'] };
  }
  if (password.length < 8) {
    errors.push('At least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('At least one lowercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('At least one digit');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    errors.push('At least one special character');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate email format.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email) return false;
  // Standard email regex — good enough for client-side validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate phone number (US-style, flexible).
 * Accepts: (123) 456-7890, 123-456-7890, 1234567890, +1 123 456 7890, etc.
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

/**
 * Validate that a string is not empty after trimming.
 * @param {string} value
 * @returns {boolean}
 */
export function isNotEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate full name — at least 2 characters, no pure digits.
 * @param {string} name
 * @returns {boolean}
 */
export function isValidName(name) {
  if (!name) return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && !/^\d+$/.test(trimmed);
}

/**
 * Validate a positive numeric amount for bank/payment forms.
 * @param {string|number} amount
 * @param {number} min
 * @param {number} max
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAmount(amount, min = 0.01, max = Infinity) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num <= 0) return { valid: false, error: 'Enter a valid amount' };
  if (num < min) return { valid: false, error: `Minimum amount is $${min}` };
  if (num > max) return { valid: false, error: `Maximum amount is $${max.toLocaleString()}` };
  return { valid: true };
}

/**
 * Check passwords match (for confirm password field).
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {boolean}
 */
export function passwordsMatch(password, confirmPassword) {
  return password === confirmPassword;
}

/**
 * Validate file for image upload (trade-in photos).
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5 MB

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPG, PNG, and WebP images are allowed' };
  }
  if (file.size > maxSize) {
    return { valid: false, error: 'Image must be under 5 MB' };
  }
  return { valid: true };
}
