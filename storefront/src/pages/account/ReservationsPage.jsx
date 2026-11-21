/**
 * ReservationsPage — full implementation per spec 8.
 * List with status badges (Active/Converted/Cancelled/Expired),
 * countdown timer for Active ones, cancel button with ConfirmDialog,
 * links to receipt.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as storeApi from '../../api/storeApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatPrice, formatDate, formatDateTime, formatCountdown } from '../../utils/formatters';
import BackButton from '../../components/common/BackButton';

const STATUS_FILTERS = [
  { value: '', label: 'All Reservations' },
  { value: 'Active', label: 'Active' },
  { value: 'Converted', label: 'Converted' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Expired', label: 'Expired' },
];

export default function ReservationsPage() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Countdown timer
  const [now, setNow] = useState(Date.now());

  // Tick the countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await storeApi.getReservations(params);
      setReservations(res.data.items || res.data.reservations || res.data || []);
    } catch {
      setError('Failed to load reservations.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError('');

    try {
      await storeApi.cancelReservation(cancelTarget.reservation_id);
      setCancelTarget(null);
      await fetchReservations();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to cancel reservation.';
      setCancelError(detail);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading reservations…" />;

  if (error && reservations.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">My Reservations</h1>
        <EmptyState
          title="Unable to load"
          description={error}
          action={fetchReservations}
          actionLabel="Try Again"
        />
      </div>
    );
  }

  return (
    <div>
      <BackButton fallback="/account" label="Back to Account" className="mb-4" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Reservations</h1>
          <p className="text-text-secondary text-sm mt-1">
            View and manage your vehicle reservations
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          title="No reservations"
          description={statusFilter
            ? `No ${statusFilter.toLowerCase()} reservations found.`
            : "You haven't reserved any vehicles yet. Browse our inventory to find your dream car!"}
          action={() => navigate('/cars')}
          actionLabel="Browse Cars"
        />
      ) : (
        <div className="space-y-4">
          {reservations.map((res) => {
            const isActive = res.status === 'Active';
            const countdown = isActive ? formatCountdown(res.expires_at) : null;
            const vehicleName = res.vehicle
              ? `${res.vehicle.year} ${res.vehicle.make} ${res.vehicle.model}`
              : `Vehicle #${res.vehicle_id}`;
            const refund = isActive
              ? parseFloat(res.deposit_amount) * 0.9  // 90% refund per spec
              : 0;

            return (
              <div
                key={res.reservation_id}
                className="bg-bg-card border border-bg-border rounded-xl overflow-hidden hover:border-bg-border/80 transition-colors"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: vehicle info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Vehicle thumbnail */}
                      {res.vehicle?.main_image_url ? (
                        <img
                          src={res.vehicle.main_image_url}
                          alt={vehicleName}
                          className="w-20 h-14 object-cover rounded-lg flex-shrink-0 hidden sm:block"
                        />
                      ) : (
                        <div className="w-20 h-14 bg-bg-elevated rounded-lg flex items-center justify-center flex-shrink-0 hidden sm:block">
                          <svg className="w-8 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125M3.375 14.25h10.5" />
                          </svg>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-text-primary truncate">
                            {vehicleName}
                          </h3>
                          <StatusBadge status={res.status} size="xs" />
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                          <div>
                            <span className="text-text-muted">Deposit: </span>
                            <span className="text-accent-blue font-medium">{formatPrice(res.deposit_amount)}</span>
                          </div>
                          {res.vehicle?.price && (
                            <div>
                              <span className="text-text-muted">Car Price: </span>
                              <span className="text-text-secondary">{formatPrice(res.vehicle.price)}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-text-muted">Reserved: </span>
                            <span className="text-text-secondary">{formatDate(res.created_at)}</span>
                          </div>
                          {res.hold_days && (
                            <div>
                              <span className="text-text-muted">Hold: </span>
                              <span className="text-text-secondary">{res.hold_days} days</span>
                            </div>
                          )}
                          {res.expires_at && (
                            <div>
                              <span className="text-text-muted">Expires: </span>
                              <span className="text-text-secondary">{formatDate(res.expires_at)}</span>
                            </div>
                          )}
                        </div>

                        {/* Active countdown */}
                        {isActive && countdown && !countdown.expired && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-status-reserved/10 rounded-lg">
                            <svg className="w-3.5 h-3.5 text-status-reserved" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs font-medium text-status-reserved">
                              {countdown.text} remaining
                            </span>
                          </div>
                        )}
                        {isActive && countdown && countdown.expired && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-status-cancelled/10 rounded-lg">
                            <span className="text-xs font-medium text-status-cancelled">
                              Expiring soon…
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Link
                        to={`/account/receipts/reservation/${res.reservation_id}`}
                        className="text-xs font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
                      >
                        View Receipt →
                      </Link>

                      {isActive && (
                        <button
                          onClick={() => {
                            setCancelTarget(res);
                            setCancelError('');
                          }}
                          className="text-xs font-medium text-status-cancelled hover:text-status-cancelled/80 transition-colors"
                        >
                          Cancel Reservation
                        </button>
                      )}

                      {res.vehicle && (
                        <Link
                          to={`/cars/${res.vehicle_id}`}
                          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                        >
                          View Car
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelError('');
        }}
        onConfirm={handleCancel}
        title="Cancel Reservation?"
        message={
          cancelTarget ? (
            <>
              {cancelError && (
                <span className="block mb-2 text-status-cancelled">{cancelError}</span>
              )}
              Are you sure you want to cancel your reservation for{' '}
              <strong>
                {cancelTarget.vehicle
                  ? `${cancelTarget.vehicle.year} ${cancelTarget.vehicle.make} ${cancelTarget.vehicle.model}`
                  : `Vehicle #${cancelTarget.vehicle_id}`}
              </strong>?
              {' '}A 10% cancellation fee applies. You'll receive approximately{' '}
              <strong>{formatPrice(parseFloat(cancelTarget.deposit_amount) * 0.9)}</strong>{' '}
              back to your AutoEdge Demo Bank account.
            </>
          ) : ''
        }
        confirmLabel="Cancel Reservation"
        cancelLabel="Keep Reservation"
        variant="danger"
        isLoading={cancelling}
      />
    </div>
  );
}
