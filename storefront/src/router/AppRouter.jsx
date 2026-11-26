import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import AccountLayout from '../components/layout/AccountLayout';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * AppRouter — all routes from spec 11.2.
 * Uses lazy-loading for code splitting.
 */

// ── Public pages ────────────────────────────────────────────────────
const HomePage = lazy(() => import('../pages/public/HomePage'));
const InventoryPage = lazy(() => import('../pages/public/InventoryPage'));
const CarDetailPage = lazy(() => import('../pages/public/CarDetailPage'));
const ComparePage = lazy(() => import('../pages/public/ComparePage'));
const EmiPage = lazy(() => import('../pages/public/EmiPage'));
const ServiceInfoPage = lazy(() => import('../pages/public/ServiceInfoPage'));
const TradeInInfoPage = lazy(() => import('../pages/public/TradeInInfoPage'));
const AboutPage = lazy(() => import('../pages/public/AboutPage'));
const ContactPage = lazy(() => import('../pages/public/ContactPage'));

// ── Auth pages ──────────────────────────────────────────────────────
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const SignupPage = lazy(() => import('../pages/auth/SignupPage'));

// ── Account pages (protected) ───────────────────────────────────────
const OverviewPage = lazy(() => import('../pages/account/OverviewPage'));
const ProfilePage = lazy(() => import('../pages/account/ProfilePage'));
const BankPage = lazy(() => import('../pages/account/BankPage'));
const DealsPage = lazy(() => import('../pages/account/DealsPage'));
const ReservationsPage = lazy(() => import('../pages/account/ReservationsPage'));
const PurchasesPage = lazy(() => import('../pages/account/PurchasesPage'));
const PurchaseCheckout = lazy(() => import('../pages/account/PurchaseCheckout'));
const ReceiptPage = lazy(() => import('../pages/account/ReceiptPage'));
const TestDrivesPage = lazy(() => import('../pages/account/TestDrivesPage'));
const EnquiriesPage = lazy(() => import('../pages/account/EnquiriesPage'));
const EnquiryDetailPage = lazy(() => import('../pages/account/EnquiryDetailPage'));
const TradeInsPage = lazy(() => import('../pages/account/TradeInsPage'));
const NewTradeInPage = lazy(() => import('../pages/account/NewTradeInPage'));
const GaragePage = lazy(() => import('../pages/account/GaragePage'));
const ServiceBookingsPage = lazy(() => import('../pages/account/ServiceBookingsPage'));
const NewServiceBookingPage = lazy(() => import('../pages/account/NewServiceBookingPage'));
const WishlistPage = lazy(() => import('../pages/account/WishlistPage'));
const ReviewsPage = lazy(() => import('../pages/account/ReviewsPage'));
const NotificationsPage = lazy(() => import('../pages/account/NotificationsPage'));

// ── 404 ─────────────────────────────────────────────────────────────
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

const PageLoader = () => <LoadingSpinner fullPage text="Loading page…" />;

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/cars" element={<InventoryPage />} />
        <Route path="/cars/:id" element={<CarDetailPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/emi-calculator" element={<EmiPage />} />
        <Route path="/service" element={<ServiceInfoPage />} />
        <Route path="/trade-in" element={<TradeInInfoPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />

        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected account routes */}
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="bank" element={<BankPage />} />
          <Route path="deals/:id?" element={<DealsPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="checkout/:id" element={<PurchaseCheckout />} />
          <Route path="receipts/reservation/:id" element={<ReceiptPage />} />
          <Route path="receipts/service/:id" element={<ReceiptPage />} />
          <Route path="test-drives" element={<TestDrivesPage />} />
          <Route path="enquiries" element={<EnquiriesPage />} />
          <Route path="enquiries/:id" element={<EnquiryDetailPage />} />
          <Route path="trade-ins" element={<TradeInsPage />} />
          <Route path="trade-ins/new" element={<NewTradeInPage />} />
          <Route path="garage" element={<GaragePage />} />
          <Route path="service-bookings" element={<ServiceBookingsPage />} />
          <Route path="service-bookings/new" element={<NewServiceBookingPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
