/**
 * ServiceBookingsStaffPage — Staff view for online service bookings.
 *
 * Spec 7.8, 9.1:
 * - Manager & receptionist see all bookings
 * - Technicians see only bookings assigned to them
 * - "Booked" bookings can be confirmed (assign technician → creates ServiceJob)
 * - Status filter tabs: All / Booked / Confirmed / In Progress / Completed / Cancelled
 * - Paginated table with booking details
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getServiceBookings,
  confirmServiceBooking,
} from '../../api/serviceBookingsApi';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../hooks/useAuth';
import {
  CalendarCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  User,
  Car,
  Wrench,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
} from 'lucide-react';

const STATUS_TABS = [
  { key: null, label: 'All' },
  { key: 'Booked', label: 'Booked' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Cancelled', label: 'Cancelled' },
];

const STATUS_COLORS = {
  Booked: 'bg-status-reserved/20 text-status-reserved border-status-reserved/30',
  Confirmed: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  'In Progress': 'bg-status-scheduled/20 text-status-scheduled border-status-scheduled/30',
  Completed: 'bg-status-available/20 text-status-available border-status-available/30',
  Cancelled: 'bg-status-cancelled/20 text-status-cancelled border-status-cancelled/30',
};

export default function ServiceBookingsStaffPage() {
  const { role } = useAuth();

  // Data state
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & pagination
  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Confirm modal state
  const [confirmTarget, setConfirmTarget] = useState(null); // booking object
  const [technicians, setTechnicians] = useState([]);
  const [techLoading, setTechLoading] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // Success toast
  const [successMessage, setSuccessMessage] = useState(null);

  // Detail drawer state
  const [detailBooking, setDetailBooking] = useState(null);

  // ── Fetch bookings ──────────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, page_size: pageSize };
      if (statusFilter) params.status_filter = statusFilter;
      const res = await getServiceBookings(params);
      setBookings(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load service bookings.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Reset to page 1 on filter change
  const handleFilterChange = (key) => {
    setStatusFilter(key);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Confirm modal ───────────────────────────────────────────────
  const openConfirmModal = async (booking) => {
    setConfirmTarget(booking);
    setSelectedTechId('');
    setConfirmError(null);
    setTechLoading(true);

    try {
      // Fetch technicians — filter by required specialty if present
      const params = { role: 'technician', limit: 100 };
      const res = await axiosInstance.get('/api/v1/users/', { params });
      let techs = res.data || [];

      // If service type has a required_specialty, filter to matching technicians
      if (booking.required_specialty) {
        // Also need technician profiles for specialty matching
        // The technician_profiles may be available via public API
        // For now, show all technicians — the backend will validate on confirm
        // Note: We show the required_specialty in the modal so staff can pick correctly
      }

      setTechnicians(techs);
    } catch (err) {
      setConfirmError('Failed to load technicians.');
    } finally {
      setTechLoading(false);
    }
  };

  const closeConfirmModal = () => {
    setConfirmTarget(null);
    setSelectedTechId('');
    setConfirmError(null);
  };

  const handleConfirm = async () => {
    if (!selectedTechId) {
      setConfirmError('Please select a technician.');
      return;
    }

    try {
      setConfirming(true);
      setConfirmError(null);
      await confirmServiceBooking(confirmTarget.booking_id, {
        technician_id: parseInt(selectedTechId),
      });
      setSuccessMessage(
        `Booking #${confirmTarget.booking_id} confirmed — technician assigned, service job created.`
      );
      closeConfirmModal();
      await fetchBookings();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setConfirmError(err.response?.data?.detail || 'Failed to confirm booking.');
    } finally {
      setConfirming(false);
    }
  };

  // ── Formatters ──────────────────────────────────────────────────
  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  const formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Service Bookings</h1>
            <p className="text-sm text-text-secondary">
              {role === 'technician'
                ? 'Your assigned service bookings'
                : 'Manage online service bookings from customers'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchBookings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Success toast */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-status-available/10 border border-status-available/20 rounded-xl">
          <CheckCircle className="w-5 h-5 text-status-available flex-shrink-0" />
          <p className="text-sm text-status-available font-medium">{successMessage}</p>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => handleFilterChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              statusFilter === tab.key
                ? 'bg-accent-blue text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-status-cancelled/10 border border-status-cancelled/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-status-cancelled flex-shrink-0" />
          <p className="text-sm text-status-cancelled">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && bookings.length === 0 && (
        <div className="text-center py-20 bg-bg-card border border-bg-border rounded-xl">
          <CalendarCheck className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-1">No Service Bookings</h3>
          <p className="text-sm text-text-secondary">
            {statusFilter
              ? `No bookings with status "${statusFilter}" found.`
              : role === 'technician'
              ? 'No bookings have been assigned to you yet.'
              : 'No online service bookings have been made yet.'}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && bookings.length > 0 && (
        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Service
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Technician
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Fee
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {bookings.map((b) => (
                  <tr
                    key={b.booking_id}
                    className="hover:bg-bg-elevated/50 transition-colors cursor-pointer"
                    onClick={() => setDetailBooking(b)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-text-secondary">
                        #{b.booking_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-accent-blue" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate max-w-[140px]">
                            {b.customer_name}
                          </p>
                          {b.customer_phone && (
                            <p className="text-xs text-text-muted truncate max-w-[140px]">
                              {b.customer_phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                        <span className="text-sm text-text-primary truncate max-w-[140px]">
                          {b.vehicle_label}
                        </span>
                      </div>
                      {b.vehicle_plate && (
                        <p className="text-xs text-text-muted mt-0.5 ml-5">{b.vehicle_plate}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                        <span className="text-sm text-text-primary truncate max-w-[120px]">
                          {b.service_type_name}
                        </span>
                      </div>
                      {b.required_specialty && (
                        <p className="text-xs text-text-muted mt-0.5 ml-5">
                          Requires: {b.required_specialty}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-text-primary">{formatDate(b.booking_date)}</p>
                      <p className="text-xs text-text-muted">{formatTime(b.time_slot)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {b.technician_name ? (
                        <span className="text-sm text-text-primary">{b.technician_name}</span>
                      ) : (
                        <span className="text-xs text-text-muted italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-text-primary">
                        {formatPrice(b.fee_amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          STATUS_COLORS[b.status] || 'bg-bg-elevated text-text-secondary border-bg-border'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.status === 'Booked' && ['manager', 'receptionist'].includes(role) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openConfirmModal(b);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue hover:bg-accent-blue-hover text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Confirm
                        </button>
                      )}
                      {b.service_job_id && (
                        <span className="text-xs text-text-muted ml-2">
                          Job #{b.service_job_id}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-bg-elevated/50 border-t border-bg-border">
            <p className="text-xs text-text-muted">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of{' '}
              {total} booking{total !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-text-secondary">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Drawer ─────────────────────────────────────────── */}
      {detailBooking && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDetailBooking(null)}
          />

          {/* Drawer */}
          <div className="relative bg-bg-card border-l border-bg-border w-full max-w-md shadow-2xl overflow-y-auto">
            {/* Drawer header */}
            <div className="sticky top-0 bg-bg-card border-b border-bg-border px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-text-primary">
                Booking #{detailBooking.booking_id}
              </h3>
              <button
                onClick={() => setDetailBooking(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Status
                </p>
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${
                    STATUS_COLORS[detailBooking.status] || 'bg-bg-elevated text-text-secondary border-bg-border'
                  }`}
                >
                  {detailBooking.status}
                </span>
              </div>

              {/* Customer */}
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Customer
                </p>
                <div className="bg-bg-elevated rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-accent-blue" />
                    <span className="text-sm font-medium text-text-primary">
                      {detailBooking.customer_name}
                    </span>
                  </div>
                  {detailBooking.customer_email && (
                    <p className="text-xs text-text-secondary ml-6">{detailBooking.customer_email}</p>
                  )}
                  {detailBooking.customer_phone && (
                    <p className="text-xs text-text-secondary ml-6">{detailBooking.customer_phone}</p>
                  )}
                </div>
              </div>

              {/* Vehicle */}
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Vehicle
                </p>
                <div className="bg-bg-elevated rounded-xl p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-accent-blue" />
                    <span className="text-sm font-medium text-text-primary">
                      {detailBooking.vehicle_label}
                    </span>
                  </div>
                  {detailBooking.vehicle_color && (
                    <p className="text-xs text-text-secondary ml-6">
                      Color: {detailBooking.vehicle_color}
                    </p>
                  )}
                  {detailBooking.vehicle_plate && (
                    <p className="text-xs text-text-secondary ml-6">
                      Plate: {detailBooking.vehicle_plate}
                    </p>
                  )}
                </div>
              </div>

              {/* Service Details */}
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Service Details
                </p>
                <div className="bg-bg-elevated rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-accent-blue" />
                    <span className="text-sm font-medium text-text-primary">
                      {detailBooking.service_type_name}
                    </span>
                  </div>
                  {detailBooking.required_specialty && (
                    <p className="text-xs text-text-muted ml-6">
                      Required specialty: <span className="text-text-secondary">{detailBooking.required_specialty}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 ml-6">
                    <Clock className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-sm text-text-primary">
                      {formatDate(detailBooking.booking_date)} at {formatTime(detailBooking.time_slot)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technician */}
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Technician
                </p>
                {detailBooking.technician_name ? (
                  <div className="bg-bg-elevated rounded-xl p-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-status-available/10 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-status-available" />
                    </div>
                    <span className="text-sm font-medium text-text-primary">
                      {detailBooking.technician_name}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted italic">Not yet assigned</p>
                )}
              </div>

              {/* Fee */}
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Booking Fee
                </p>
                <p className="text-lg font-bold text-text-primary">
                  {formatPrice(detailBooking.fee_amount)}
                </p>
              </div>

              {/* Notes */}
              {detailBooking.notes && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                    Customer Notes
                  </p>
                  <div className="bg-bg-elevated rounded-xl p-4">
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">
                      {detailBooking.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Service Job link */}
              {detailBooking.service_job_id && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                    Service Job
                  </p>
                  <a
                    href={`/service/${detailBooking.service_job_id}/edit`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-accent-blue hover:bg-accent-blue/5 transition-colors"
                  >
                    <Wrench className="w-4 h-4" />
                    View Job #{detailBooking.service_job_id}
                  </a>
                </div>
              )}

              {/* Timestamps */}
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                  Timestamps
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary">
                    Created: {formatDateTime(detailBooking.created_at)}
                  </p>
                  {detailBooking.updated_at && (
                    <p className="text-xs text-text-secondary">
                      Updated: {formatDateTime(detailBooking.updated_at)}
                    </p>
                  )}
                </div>
              </div>

              {/* Confirm action in drawer */}
              {detailBooking.status === 'Booked' && ['manager', 'receptionist'].includes(role) && (
                <button
                  onClick={() => {
                    setDetailBooking(null);
                    openConfirmModal(detailBooking);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-blue hover:bg-accent-blue-hover text-white font-medium rounded-xl transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Confirm This Booking
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ─────────────────────────────────────────── */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeConfirmModal}
          />

          {/* Modal */}
          <div className="relative bg-bg-card border border-bg-border rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-text-primary mb-1">
              Confirm Service Booking
            </h3>
            <p className="text-sm text-text-secondary mb-6">
              Assign a technician to booking #{confirmTarget.booking_id}. This will create
              a service job and update the booking status to Confirmed.
            </p>

            {/* Booking summary */}
            <div className="bg-bg-elevated rounded-xl p-4 mb-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Customer</span>
                <span className="text-sm text-text-primary font-medium">
                  {confirmTarget.customer_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Vehicle</span>
                <span className="text-sm text-text-primary">{confirmTarget.vehicle_label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Service</span>
                <span className="text-sm text-text-primary">{confirmTarget.service_type_name}</span>
              </div>
              {confirmTarget.required_specialty && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Required Specialty</span>
                  <span className="text-sm text-status-reserved font-medium">
                    {confirmTarget.required_specialty}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Date & Time</span>
                <span className="text-sm text-text-primary">
                  {formatDate(confirmTarget.booking_date)} at {formatTime(confirmTarget.time_slot)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Fee</span>
                <span className="text-sm text-text-primary font-semibold">
                  {formatPrice(confirmTarget.fee_amount)}
                </span>
              </div>
            </div>

            {/* Technician select */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Assign Technician
                {confirmTarget.required_specialty && (
                  <span className="text-xs text-status-reserved ml-2">
                    (Must have "{confirmTarget.required_specialty}" specialty)
                  </span>
                )}
              </label>
              {techLoading ? (
                <div className="flex items-center gap-2 py-3">
                  <div className="w-4 h-4 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
                  <span className="text-sm text-text-muted">Loading technicians…</span>
                </div>
              ) : (
                <select
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-bg-primary border border-bg-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
                >
                  <option value="">Select a technician…</option>
                  {technicians.map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Customer notes if present */}
            {confirmTarget.notes && (
              <div className="mb-6">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                  Customer Notes
                </p>
                <p className="text-sm text-text-secondary bg-bg-elevated rounded-lg p-3">
                  {confirmTarget.notes}
                </p>
              </div>
            )}

            {/* Error */}
            {confirmError && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-status-cancelled flex-shrink-0" />
                <p className="text-xs text-status-cancelled">{confirmError}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={closeConfirmModal}
                disabled={confirming}
                className="flex-1 px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || !selectedTechId}
                className="flex-1 px-4 py-2.5 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {confirming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Confirming…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm Booking
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
