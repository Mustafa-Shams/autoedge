/**
 * OverviewPage — account overview with shortcuts, active reservations, upcoming events, unread count.
 * Spec 11.2.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getUnreadCount } from '../../api/storeApi';

const SHORTCUTS = [
  { to: '/account/bank', label: 'Bank Account', icon: '💳', desc: 'View balance and transactions' },
  { to: '/account/reservations', label: 'Reservations', icon: '🔒', desc: 'Manage your reservations' },
  { to: '/account/test-drives', label: 'Test Drives', icon: '🚗', desc: 'Upcoming test drives' },
  { to: '/account/enquiries', label: 'Enquiries', icon: '💬', desc: 'Your conversations' },
  { to: '/account/trade-ins', label: 'Trade-Ins', icon: '🔄', desc: 'Vehicle trade-in requests' },
  { to: '/account/garage', label: 'Garage', icon: '🏠', desc: 'Your vehicles' },
  { to: '/account/service-bookings', label: 'Service Bookings', icon: '🔧', desc: 'Scheduled services' },
  { to: '/account/wishlist', label: 'Wishlist', icon: '❤️', desc: 'Saved vehicles' },
  { to: '/account/reviews', label: 'Reviews', icon: '⭐', desc: 'Your reviews' },
];

export default function OverviewPage() {
  const { customer } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadCount()
      .then((res) => setUnreadCount(res.data.count || 0))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          Welcome back, {customer?.full_name?.split(' ')[0] || 'there'}!
        </h1>
        <p className="text-text-secondary">Here's your account overview</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link
          to="/account/notifications"
          className="bg-bg-card border border-bg-border rounded-xl p-5 hover:border-accent-blue/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Unread Notifications</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{unreadCount}</p>
            </div>
            <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
          </div>
        </Link>

        <Link
          to="/cars"
          className="bg-bg-card border border-bg-border rounded-xl p-5 hover:border-accent-blue/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Browse Cars</p>
              <p className="text-sm text-text-muted mt-1">Find your next vehicle</p>
            </div>
            <div className="w-10 h-10 bg-status-available/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-status-available" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
          </div>
        </Link>

        <Link
          to="/account/profile"
          className="bg-bg-card border border-bg-border rounded-xl p-5 hover:border-accent-blue/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Profile</p>
              <p className="text-sm text-text-muted mt-1">{customer?.email || ''}</p>
            </div>
            <div className="w-10 h-10 bg-status-sold/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-status-sold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Shortcuts grid */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Quick Links</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SHORTCUTS.map((shortcut) => (
          <Link
            key={shortcut.to}
            to={shortcut.to}
            className="flex items-center gap-3 bg-bg-card border border-bg-border rounded-xl p-4 hover:border-accent-blue/30 hover:bg-bg-elevated/50 transition-colors"
          >
            <span className="text-2xl">{shortcut.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{shortcut.label}</p>
              <p className="text-xs text-text-muted truncate">{shortcut.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
