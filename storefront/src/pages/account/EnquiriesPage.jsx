/**
 * EnquiriesPage — full customer enquiries list per spec 7.5.
 * Displays all customer enquiries with status filter, vehicle references,
 * message counts, and navigation to individual threads.
 * Includes a "New Enquiry" modal for creating general enquiries.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getEnquiries } from '../../api/storeApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatRelativeTime } from '../../utils/formatters';
import NewEnquiryModal from '../../components/enquiries/NewEnquiryModal';
import CategoryBadge from '../../components/enquiries/CategoryBadge';
import BackButton from '../../components/common/BackButton';

const STATUS_OPTIONS = [
  { value: '', label: 'All Enquiries' },
  { value: 'Open', label: 'Open' },
  { value: 'Answered', label: 'Answered' },
  { value: 'Closed', label: 'Closed' },
];

const STATUS_COLORS = {
  Open: 'bg-accent-blue/20 text-accent-blue',
  Answered: 'bg-status-available/20 text-status-available',
  Closed: 'bg-text-muted/20 text-text-muted',
};

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  const fetchEnquiries = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status_filter = statusFilter;
      const res = await getEnquiries(params);
      setEnquiries(res.data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const handleCreated = () => {
    setShowNewModal(false);
    fetchEnquiries();
  };

  return (
    <div>
      <BackButton fallback="/account" label="Back to Account" className="mb-4" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Enquiries</h1>
          <p className="text-text-secondary text-sm mt-1">
            Ask questions about vehicles, finance, or general enquiries
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Enquiry
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              statusFilter === opt.value
                ? 'bg-accent-blue-strong text-white'
                : 'bg-bg-card border border-bg-border text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner text="Loading enquiries…" />
      ) : enquiries.length === 0 ? (
        <EmptyState
          title={statusFilter ? 'No enquiries match this filter' : 'No enquiries yet'}
          description={
            statusFilter
              ? 'Try selecting a different status filter.'
              : 'Start a conversation about a vehicle or ask a general question.'
          }
          action={statusFilter ? () => setStatusFilter('') : () => setShowNewModal(true)}
          actionLabel={statusFilter ? 'Clear filter' : 'Start an enquiry'}
        />
      ) : (
        <div className="space-y-3">
          {enquiries.map((enq) => (
            <Link
              key={enq.enquiry_id}
              to={`/account/enquiries/${enq.enquiry_id}`}
              className="block bg-bg-card border border-bg-border rounded-xl p-5 hover:border-accent-blue/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Subject + status */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent-blue transition-colors truncate">
                      {enq.subject}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        STATUS_COLORS[enq.status] || 'bg-bg-elevated text-text-muted'
                      }`}
                    >
                      {enq.status}
                    </span>
                    <CategoryBadge category={enq.category} />
                  </div>

                  {/* Vehicle reference */}
                  {enq.vehicle && (
                    <div className="flex items-center gap-2 mb-2">
                      {enq.vehicle.main_image_url && (
                        <img
                          src={enq.vehicle.main_image_url}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      <span className="text-xs text-text-muted">
                        {enq.vehicle.year} {enq.vehicle.make} {enq.vehicle.model}
                      </span>
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                      </svg>
                      {enq.message_count} message{enq.message_count !== 1 ? 's' : ''}
                    </span>
                    {enq.last_message_at && (
                      <span>Last activity {formatRelativeTime(enq.last_message_at)}</span>
                    )}
                    {!enq.last_message_at && enq.created_at && (
                      <span>Created {formatRelativeTime(enq.created_at)}</span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <svg
                  className="w-5 h-5 text-text-muted group-hover:text-accent-blue transition-colors flex-shrink-0 mt-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New enquiry modal */}
      <NewEnquiryModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
