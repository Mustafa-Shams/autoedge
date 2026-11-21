/**
 * ReceiptPage — reads type from URL (/account/receipts/reservation/:id or /account/receipts/service/:id),
 * fetches the receipt data, and shows the full Receipt component with print button.
 * Per spec 8.5-8.6.
 */
import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import * as storeApi from '../../api/storeApi';
import Receipt from '../../components/payment/Receipt';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import BackButton from '../../components/common/BackButton';

export default function ReceiptPage() {
  const { id } = useParams();
  const location = useLocation();

  // Determine type from URL path
  const isService = location.pathname.includes('/receipts/service/');
  const type = isService ? 'service' : 'reservation';

  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        setError('');

        let res;
        if (isService) {
          res = await storeApi.getServiceBookingReceipt(id);
        } else {
          res = await storeApi.getReservationReceipt(id);
        }
        setReceiptData(res.data);
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Receipt not found.');
        } else {
          setError('Failed to load receipt.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchReceipt();
  }, [id, isService]);

  if (loading) return <LoadingSpinner fullPage text="Loading receipt…" />;

  if (error || !receiptData) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Receipt</h1>
        <EmptyState
          title="Receipt Not Found"
          description={error || 'This receipt could not be found.'}
        />
      </div>
    );
  }

  return (
    <div>
      <BackButton fallback="/account/reservations" label="Back" className="mb-4" />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link to="/account" className="hover:text-text-secondary">Account</Link>
        <span>/</span>
        <Link
          to={isService ? '/account/service-bookings' : '/account/reservations'}
          className="hover:text-text-secondary"
        >
          {isService ? 'Service Bookings' : 'Reservations'}
        </Link>
        <span>/</span>
        <span className="text-text-secondary">Receipt</span>
      </nav>

      {/* Print-optimized receipt */}
      <Receipt type={type} receiptData={receiptData} className="max-w-2xl" />

      {/* Navigation back */}
      <div className="mt-6 flex items-center gap-3 print:hidden max-w-2xl">
        <Link
          to={isService ? '/account/service-bookings' : '/account/reservations'}
          className="flex items-center gap-2 text-sm font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to {isService ? 'Service Bookings' : 'Reservations'}
        </Link>
      </div>
    </div>
  );
}
