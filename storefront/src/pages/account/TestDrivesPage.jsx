/**
 * TestDrivesPage — full implementation per spec 7.3 and 11.4.
 * List of test drives with status badges, countdown for Requested,
 * cancel button, vehicle info, scheduled date/time.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as storeApi from '../../api/storeApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

const STATUS_FILTERS = [
  { value: '', label: 'All Test Drives' },
  { value: 'Requested', label: 'Requested' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Expired', label: 'Expired' },
];

export default function TestDrivesPage() {
  const navigate = useNavigate();
  const [testDrives, setTestDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const fetchTestDrives = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (statusFilter) params.status_filter = statusFilter;
      const res = await storeApi.getTestDrives(params);
      setTestDrives(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch {
      setError('Failed to load test drives.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTestDrives();
  }, [fetchTestDrives]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError('');
    try {
      await storeApi.cancelTestDrive(cancelTarget.test_drive_id);
      setCancelTarget(null);
      await fetchTestDrives();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to cancel test drive.';
      setCancelError(detail);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading test drives…" />;

  if (error && testDrives.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">My Test Drives</h1>
        <EmptyState
          title="Unable to load"
          description={error}
          action={fetchTestDrives}
          actionLabel="Try Again"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Test Drives</h1>
          <p className="text-text-secondary text-sm mt-1">
            View and manage your test drive requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button
            onClick={() => navigate('/cars')}
            className="px-4 py-1.5 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            Book New
          </button>
        </div>
      </div>

      {testDrives.length === 0 ? (
        <EmptyState
          title="No test drives"
          description={
            statusFilter
              ? `No ${statusFilter.toLowerCase()} test drives found.`
              : "You haven't requested any test drives yet. Browse our inventory and book a test drive!"
          }
          action={() => navigate('/cars')}
          actionLabel="Browse Cars"
        />
      ) : (
        <div className="space-y-4">
          {testDrives.map((td) => {
            const canCancel = td.status === 'Requested' || td.status === 'Scheduled';
            const vehicleName = td.vehicle
              ? `${td.vehicle.year} ${td.vehicle.make} ${td.vehicle.model}`
              : `Vehicle #${td.vehicle_id}`;

            return (
              <div
                key={td.test_drive_id}
                className="bg-bg-card border border-bg-border rounded-xl overflow-hidden hover:border-bg-border/80 transition-colors"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Vehicle thumbnail */}
                      {td.vehicle?.main_image_url ? (
                        <img
                          src={td.vehicle.main_image_url}
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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-semibold text-text-primary truncate">
                            {vehicleName}
                          </h3>
                          <StatusBadge status={td.status} size="xs" />
                          {td.source === 'Online' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue font-medium">
                              Online
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                          <div>
                            <span className="text-text-muted">Date: </span>
                            <span className="text-text-secondary">{formatDate(td.scheduled_date)}</span>
                          </div>
                          {td.scheduled_time && (
                            <div>
                              <span className="text-text-muted">Time: </span>
                              <span className="text-text-secondary">{td.scheduled_time}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-text-muted">Requested: </span>
                            <span className="text-text-secondary">
                              {td.booking_date ? formatRelativeTime(td.booking_date) : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Expiry info for Requested */}
                        {td.status === 'Requested' && td.expires_at && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-status-reserved/10 rounded-lg">
                            <svg className="w-3.5 h-3.5 text-status-reserved" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs font-medium text-status-reserved">
                              Awaiting confirmation · Expires {formatRelativeTime(td.expires_at)}
                            </span>
                          </div>
                        )}

                        {td.notes && !td.notes.startsWith('[Declined]') && (
                          <p className="mt-2 text-xs text-text-muted italic truncate">
                            {td.notes}
                          </p>
                        )}

                        {td.notes && td.notes.includes('[Declined]') && (
                          <p className="mt-2 text-xs text-status-cancelled">
                            {td.notes.replace('[Declined] ', 'Reason: ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {canCancel && (
                        <button
                          onClick={() => {
                            setCancelTarget(td);
                            setCancelError('');
                          }}
                          className="text-xs font-medium text-status-cancelled hover:text-status-cancelled/80 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      {td.vehicle && (
                        <Link
                          to={`/cars/${td.vehicle_id}`}
                          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                        >
                          View Car →
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

      {/* Cancel confirmation */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelError('');
        }}
        onConfirm={handleCancel}
        title="Cancel Test Drive?"
        message={
          cancelTarget ? (
            <>
              {cancelError && (
                <span className="block mb-2 text-status-cancelled">{cancelError}</span>
              )}
              Are you sure you want to cancel your test drive for{' '}
              <strong>
                {cancelTarget.vehicle
                  ? `${cancelTarget.vehicle.year} ${cancelTarget.vehicle.make} ${cancelTarget.vehicle.model}`
                  : `Vehicle #${cancelTarget.vehicle_id}`}
              </strong>{' '}
              on <strong>{formatDate(cancelTarget.scheduled_date)}</strong>
              {cancelTarget.scheduled_time ? ` at ${cancelTarget.scheduled_time}` : ''}?
            </>
          ) : ''
        }
        confirmLabel="Cancel Test Drive"
        cancelLabel="Keep Test Drive"
        variant="danger"
        isLoading={cancelling}
      />
    </div>
  );
}
