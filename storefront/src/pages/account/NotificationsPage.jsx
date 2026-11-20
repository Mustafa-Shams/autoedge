/**
 * NotificationsPage — full notification list, mark read/all-read.
 * Spec 10.3, 11.4 — clicking navigates to link_path and marks read.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markRead, markAllRead } from '../../api/storeApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatRelativeTime } from '../../utils/formatters';

const TYPE_ICONS = {
  reservation: '🔒',
  test_drive: '🚗',
  enquiry: '💬',
  trade_in: '🔄',
  restock: '📦',
  service: '🔧',
  review: '⭐',
  welcome: '👋',
  system: 'ℹ️',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const pageSize = 20;

  const fetchNotifications = async (p = 1) => {
    try {
      setLoading(true);
      const res = await getNotifications({ page: p, page_size: pageSize });
      if (p === 1) {
        setNotifications(res.data.items);
      } else {
        setNotifications((prev) => [...prev, ...res.data.items]);
      }
      setTotal(res.data.total);
      setPage(p);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(1); }, []);

  const handleClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await markRead(notification.notification_id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.notification_id === notification.notification_id ? { ...n, is_read: true } : n
          )
        );
      } catch {
        // silently fail
      }
    }
    // Navigate to link_path if present
    if (notification.link_path) {
      navigate(notification.link_path);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // silently fail
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const hasMore = notifications.length < total;

  if (loading && notifications.length === 0) {
    return <LoadingSpinner text="Loading notifications…" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Notifications</h1>
          <p className="text-text-secondary text-sm">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="text-sm text-accent-blue hover:text-accent-blue-hover transition-colors disabled:opacity-50"
          >
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You'll receive notifications about your reservations, test drives, and more."
          icon={
            <svg className="w-16 h-16 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.notification_id}
              onClick={() => handleClick(n)}
              className={`w-full text-left bg-bg-card border rounded-xl p-4 transition-colors hover:bg-bg-elevated/50 ${
                n.is_read ? 'border-bg-border' : 'border-accent-blue/30 bg-accent-blue/5'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <span className="text-xl flex-shrink-0 mt-0.5">
                  {TYPE_ICONS[n.type] || TYPE_ICONS.system}
                </span>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-medium truncate ${n.is_read ? 'text-text-secondary' : 'text-text-primary'}`}>
                      {n.title}
                    </h3>
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-accent-blue rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 line-clamp-2 ${n.is_read ? 'text-text-muted' : 'text-text-secondary'}`}>
                    {n.message}
                  </p>
                  <p className="text-[10px] text-text-muted mt-1">
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>
                {/* Arrow if has link */}
                {n.link_path && (
                  <svg className="w-4 h-4 text-text-muted flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </div>
            </button>
          ))}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => fetchNotifications(page + 1)}
              disabled={loading}
              className="w-full py-3 text-sm font-medium text-accent-blue hover:text-accent-blue-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
