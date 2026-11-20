/**
 * Formatting utilities for the storefront.
 * All money formatting uses Intl — never floating point arithmetic on money (Article XI).
 */

/**
 * Format a number as USD currency string.
 * @param {number|string} amount
 * @param {boolean} showCents — whether to show cents (default true)
 * @returns {string} e.g. "$45,000.00" or "$45,000"
 */
export function formatPrice(amount, showCents = true) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num == null || isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(num);
}

/**
 * Format a date string or Date object to a readable format.
 * @param {string|Date} dateValue
 * @param {object} opts — Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(dateValue, opts = {}) {
  if (!dateValue) return '—';
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  }).format(date);
}

/**
 * Format date with time.
 */
export function formatDateTime(dateValue) {
  return formatDate(dateValue, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date string to relative time (e.g. "2 hours ago", "in 3 days").
 */
export function formatRelativeTime(dateValue) {
  if (!dateValue) return '—';
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
  return formatDate(dateValue);
}

/**
 * Format phone number for display.
 * @param {string} phone
 * @returns {string}
 */
export function formatPhone(phone) {
  if (!phone) return '—';
  // Clean to digits only
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone; // Return as-is if not standard US
}

/**
 * Capitalize first letter of each word.
 */
export function titleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Truncate a string to maxLen characters with ellipsis.
 */
export function truncate(str, maxLen = 100) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen).trimEnd() + '…';
}

/**
 * Format a countdown from a future date (e.g. reservation hold expiry).
 * @param {string|Date} expiryDate
 * @returns {{ days: number, hours: number, minutes: number, expired: boolean, text: string }}
 */
export function formatCountdown(expiryDate) {
  if (!expiryDate) return { days: 0, hours: 0, minutes: 0, expired: true, text: 'Expired' };
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, expired: true, text: 'Expired' };

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  let text = '';
  if (days > 0) text += `${days}d `;
  if (hours > 0 || days > 0) text += `${hours}h `;
  text += `${minutes}m`;

  return { days, hours, minutes, expired: false, text: text.trim() };
}

/**
 * Format a number with commas.
 */
export function formatNumber(num) {
  if (num == null || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Mask a bank account number — show last 4 digits only.
 */
export function maskAccountNumber(accountNumber) {
  if (!accountNumber) return '****';
  const str = String(accountNumber);
  if (str.length <= 4) return str;
  return '•••• ' + str.slice(-4);
}
