// Auth store using sessionStorage (not localStorage per spec)
const STORAGE_KEY = "autoedge_auth";

function getInitialState() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { user: null, token: null, role: null };
  } catch {
    return { user: null, token: null, role: null };
  }
}

let state = getInitialState();
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(state));
}

export const authStore = {
  getState: () => state,

  login(token, user) {
    state = { token, user, role: user.role };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify();
  },

  logout() {
    state = { user: null, token: null, role: null };
    sessionStorage.removeItem(STORAGE_KEY);
    notify();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
