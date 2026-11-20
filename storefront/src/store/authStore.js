/**
 * Customer auth store — uses sessionStorage (NOT localStorage, per spec).
 * Provides login/logout/register functions and reactive state via custom events.
 */

const TOKEN_KEY = 'customer_token';
const CUSTOMER_KEY = 'customer';
const AUTH_EVENT = 'autoedge-auth-change';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getCustomer() {
  const raw = sessionStorage.getItem(CUSTOMER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!getToken();
}

export function setAuth(token, customer) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(CUSTOMER_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export { AUTH_EVENT };
