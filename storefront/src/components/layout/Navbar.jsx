import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getUnreadCount } from '../../api/storeApi';
import { getWishlist } from '../../api/storeApi';

/**
 * Navbar — full navigation per spec 11.3.
 *
 * Logged out: Logo, Cars, Compare, EMI Calculator, Service, Trade-In, About, Contact | Log in, Sign up
 * Logged in: same links + wishlist heart (count), notification bell (unread count),
 *            My Account dropdown (Overview, Bank, Reservations, Test Drives, Enquiries,
 *            Trade-ins, Garage, Service Bookings, Reviews, Profile, Log out)
 */

const PUBLIC_LINKS = [
  { to: '/cars', label: 'Cars' },
  { to: '/compare', label: 'Compare' },
  { to: '/emi-calculator', label: 'EMI Calculator' },
  { to: '/service', label: 'Service' },
  { to: '/trade-in', label: 'Trade-In' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const ACCOUNT_LINKS = [
  { to: '/account', label: 'Overview', exact: true },
  { to: '/account/bank', label: 'Bank' },
  { to: '/account/reservations', label: 'Reservations' },
  { to: '/account/test-drives', label: 'Test Drives' },
  { to: '/account/enquiries', label: 'Enquiries' },
  { to: '/account/trade-ins', label: 'Trade-Ins' },
  { to: '/account/garage', label: 'Garage' },
  { to: '/account/service-bookings', label: 'Service Bookings' },
  { to: '/account/reviews', label: 'Reviews' },
  { to: '/account/profile', label: 'Profile' },
];

export default function Navbar() {
  const { customer, loggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  // Fetch unread notifications count when logged in
  useEffect(() => {
    if (!loggedIn) {
      setUnreadCount(0);
      setWishlistCount(0);
      return;
    }

    const fetchCounts = async () => {
      try {
        const [unreadRes, wishlistRes] = await Promise.allSettled([
          getUnreadCount(),
          getWishlist(),
        ]);
        if (unreadRes.status === 'fulfilled') {
          setUnreadCount(unreadRes.value.data.count ?? 0);
        }
        if (wishlistRes.status === 'fulfilled') {
          setWishlistCount(Array.isArray(wishlistRes.value.data) ? wishlistRes.value.data.length : 0);
        }
      } catch {
        // Silently fail — badge just won't show
      }
    };

    fetchCounts();
    // Re-fetch every 30 seconds
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [navigate]);

  const activeClass = 'text-accent-blue';
  const inactiveClass = 'text-text-secondary hover:text-text-primary';

  return (
    <nav className="sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-md border-b border-bg-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0" onClick={() => setMobileOpen(false)}>
            <div className="w-8 h-8 bg-accent-blue rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <span className="text-lg font-bold text-text-primary">AutoEdge</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {PUBLIC_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive ? activeClass : inactiveClass}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {loggedIn ? (
              <>
                {/* Wishlist heart */}
                <Link
                  to="/account/wishlist"
                  className="relative p-2 text-text-secondary hover:text-status-cancelled transition-colors"
                  title="Wishlist"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  {wishlistCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-status-cancelled text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {wishlistCount > 9 ? '9+' : wishlistCount}
                    </span>
                  )}
                </Link>

                {/* Notification bell */}
                <Link
                  to="/account/notifications"
                  className="relative p-2 text-text-secondary hover:text-accent-blue transition-colors"
                  title="Notifications"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-accent-blue text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* My Account dropdown */}
                <div className="relative hidden lg:block" ref={dropdownRef}>
                  <button
                    onClick={() => setAccountOpen(!accountOpen)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg transition-colors"
                  >
                    <div className="w-7 h-7 bg-accent-blue/20 text-accent-blue rounded-full flex items-center justify-center text-xs font-bold">
                      {customer?.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="max-w-[120px] truncate">{customer?.full_name || 'My Account'}</span>
                    <svg className={`w-4 h-4 transition-transform ${accountOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {accountOpen && (
                    <div className="absolute right-0 mt-1 w-56 bg-bg-card border border-bg-border rounded-xl shadow-2xl py-2 z-50">
                      {ACCOUNT_LINKS.map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={() => setAccountOpen(false)}
                          className="block px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                        >
                          {link.label}
                        </Link>
                      ))}
                      <div className="border-t border-bg-border my-1" />
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-status-cancelled hover:bg-bg-elevated transition-colors"
                      >
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden lg:flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 text-sm font-medium text-white bg-accent-blue hover:bg-accent-blue-hover rounded-lg transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-text-secondary hover:text-text-primary"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div ref={mobileMenuRef} className="lg:hidden border-t border-bg-border bg-bg-primary">
          <div className="px-4 py-3 space-y-1">
            {PUBLIC_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive ? activeClass : inactiveClass}`
                }
              >
                {link.label}
              </NavLink>
            ))}

            {loggedIn ? (
              <>
                <div className="border-t border-bg-border my-2" />
                <p className="px-3 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
                  My Account
                </p>
                {ACCOUNT_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.exact}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive ? activeClass : inactiveClass}`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <div className="border-t border-bg-border my-2" />
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="block w-full text-left px-3 py-2 text-sm font-medium text-status-cancelled hover:bg-bg-elevated rounded-lg transition-colors"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <div className="border-t border-bg-border my-2" />
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-white bg-accent-blue hover:bg-accent-blue-hover rounded-lg text-center"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
