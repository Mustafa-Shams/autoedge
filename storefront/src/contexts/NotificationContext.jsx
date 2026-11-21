/**
 * NotificationContext — single source of truth for unread notification count.
 * Both Navbar and OverviewPage (and any other component) consume this context
 * instead of calling getUnreadCount() independently.
 * Polls every 30s when logged in.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUnreadCount } from '../api/storeApi';
import useAuth from '../hooks/useAuth';

const NotificationContext = createContext({
  unreadCount: 0,
  refreshUnread: () => {},
});

export function NotificationProvider({ children }) {
  const { loggedIn } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!loggedIn) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await getUnreadCount();
      setUnreadCount(res.data.count ?? 0);
    } catch {
      // silently fail — badge just won't update
    }
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) {
      setUnreadCount(0);
      return;
    }
    refreshUnread();
    const interval = setInterval(refreshUnread, 30000);
    return () => clearInterval(interval);
  }, [loggedIn, refreshUnread]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

export default NotificationContext;
