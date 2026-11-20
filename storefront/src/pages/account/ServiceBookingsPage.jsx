import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as storeApi from '../../api/storeApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatPrice, formatDate } from '../../utils/formatters';

const STATUS_FILTERS = ['All', 'Booked', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];

export default function ServiceBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const params = { page, page_size: 20 };
      if (statusFilter !== 'All') params.status_filter = statusFilter;
      const res = await storeApi.getServiceBookings(params);
      setBookings(res.data.items);
      setTotal(res.data.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, [page, statusFilter]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await storeApi.cancelServiceBooking(cancelTarget.booking_id);
      setCancelResult(res.data);
      setCancelTarget(null);
      fetchBookings();
    } catch (err) {
      setCancelTarget(null);
      setCancelResult({
        message: err.response?.data?.detail || 'Failed to cancel booking.',
        refunded: false,
      });
    } finally {
      setCancelling(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Service Bookings</h1>
          <p className="text-sm text-text-secondary mt-1">
            Track and manage your service appointments.
          </p>
        </div>
        <Link
          to="/account/service-bookings/new"
          className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Book a Service
        </Link>
      </div>

      {/* Cancel result toast */}
      {cancelResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm border ${cancelResult.refunded ? 'bg-status-available/10 border-status-available/20 text-status-available' : 'bg-status-reserved/10 border-status-reserved/20 text-status-reserved'}`}>
          <div className="flex items-center justify-between">
            <p>{cancelResult.message}</p>
            <button onClick={() => setCancelResult(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              statusFilter === s
                ? 'bg-accent-blue text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner text="Loading bookings…" />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings found"
          description={statusFilter !== 'All' ? `No ${statusFilter.toLowerCase()} bookings.` : "You haven't booked any services yet."}
          action={() => window.location.href = '/account/service-bookings/new'}
          actionLabel="Book Your First Service"
        />
      ) : (
        <>
          <div className="space-y-3">
            {bookings.map((b) => (
              <div
                key={b.booking_id}
                className="bg-bg-card border border-bg-border rounded-xl p-5 hover:border-accent-blue/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Service type & vehicle */}
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-text-primary truncate">
                        {b.service_type_name}
                      </h3>
                      <StatusBadge status={b.status} size="xs" />
                    </div>
                    <p className="text-xs text-text-secondary">
                      {b.vehicle_label}
                    </p>

                    {/* Date, time, technician */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        {formatDate(b.booking_date)}
                      </span>
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {b.time_slot}
                      </span>
                      {b.technician_name && (
                        <span className="text-xs text-text-secondary flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          {b.technician_name}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {b.notes && (
                      <p className="text-xs text-text-muted mt-2 line-clamp-2">
                        {b.notes}
                      </p>
                    )}
                  </div>

                  {/* Fee + actions */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-accent-blue">
                      {formatPrice(b.fee_amount)}
                    </p>
                    <div className="mt-2 flex flex-col gap-1">
                      {b.reference_code && (
                        <Link
                          to={`/account/receipts/service/${b.booking_id}`}
                          className="text-[11px] text-accent-blue hover:text-accent-blue-hover"
                        >
                          View Receipt
                        </Link>
                      )}
                      {(b.status === 'Booked' || b.status === 'Confirmed') && (
                        <button
                          onClick={() => setCancelTarget(b)}
                          className="text-[11px] text-status-cancelled hover:text-status-cancelled/80"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-elevated rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-elevated rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Cancel confirmation */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel Service Booking"
        message={
          cancelTarget
            ? `Cancel your booking for "${cancelTarget.service_type_name}" on ${formatDate(cancelTarget.booking_date)} at ${cancelTarget.time_slot}?\n\nIf cancellation is ≥24 hours before the slot, you'll receive a full refund. Otherwise, no refund will be issued.`
            : ''
        }
        confirmLabel="Cancel Booking"
        variant="danger"
        isLoading={cancelling}
      />
    </div>
  );
}
