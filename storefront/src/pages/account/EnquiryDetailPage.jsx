/**
 * EnquiryDetailPage — full thread view per spec 7.5.
 * Shows messages (customer vs staff with different alignment/styling),
 * reply text area, close/re-open button, vehicle reference card.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import CategoryBadge from '../../components/enquiries/CategoryBadge';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getEnquiry, replyToEnquiry, closeEnquiry } from '../../api/storeApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import BackButton from '../../components/common/BackButton';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

const STATUS_COLORS = {
  Open: 'bg-accent-blue/20 text-accent-blue',
  Answered: 'bg-status-available/20 text-status-available',
  Closed: 'bg-text-muted/20 text-text-muted',
};

export default function EnquiryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchThread = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getEnquiry(id);
      setEnquiry(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Enquiry not found.');
      } else {
        setError('Failed to load enquiry.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (enquiry?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [enquiry?.messages?.length]);

  const handleReply = async (e) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (trimmed.length < 1) {
      setReplyError('Reply cannot be empty.');
      return;
    }

    try {
      setSending(true);
      setReplyError(null);
      await replyToEnquiry(id, { body: trimmed });
      setReplyText('');
      // Re-fetch the entire thread to get updated status and messages
      await fetchThread();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setReplyError(typeof detail === 'string' ? detail : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    try {
      setClosing(true);
      await closeEnquiry(id);
      setShowCloseConfirm(false);
      await fetchThread();
    } catch {
      // silently handle
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading enquiry…" />;

  if (error || !enquiry) {
    return (
      <EmptyState
        title={error || 'Enquiry not found'}
        description="This enquiry may have been removed."
        action={() => navigate('/account/enquiries')}
        actionLabel="Back to enquiries"
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <BackButton fallback="/account/enquiries" label="Back to Enquiries" className="mb-4" />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-text-muted mb-4">
        <Link to="/account/enquiries" className="hover:text-text-secondary">
          Enquiries
        </Link>
        <span>/</span>
        <span className="text-text-secondary truncate max-w-[200px]">{enquiry.subject}</span>
      </nav>

      {/* Header */}
      <div className="bg-bg-card border border-bg-border rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="text-lg font-bold text-text-primary">{enquiry.subject}</h1>
              {enquiry.deal_id && <Link className="block underline" to={`/account/deals/${enquiry.deal_id}`}>Deal #{enquiry.deal_id}</Link>}
              {enquiry.sale_id && <Link className="text-accent-blue" to={`/account/purchases#sale-${enquiry.sale_id}`}>View purchase receipt</Link>}
              <span
                className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                  STATUS_COLORS[enquiry.status] || 'bg-bg-elevated text-text-muted'
                }`}
              >
                {enquiry.status}
              </span>
              <CategoryBadge category={enquiry.category} />
            </div>
            <p className="text-xs text-text-muted">
              Started {formatRelativeTime(enquiry.created_at)} · {enquiry.message_count} message{enquiry.message_count !== 1 ? 's' : ''}
            </p>
          </div>
          {enquiry.status !== 'Closed' && (
            <button
              onClick={() => setShowCloseConfirm(true)}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-elevated hover:bg-bg-border border border-bg-border rounded-lg transition-colors"
            >
              Close Enquiry
            </button>
          )}
        </div>

        {/* Vehicle reference card */}
        {enquiry.vehicle && (
          <div className="mt-4 pt-4 border-t border-bg-border">
            <Link
              to={`/cars/${enquiry.vehicle.vehicle_id}`}
              className="flex items-center gap-3 group"
            >
              {enquiry.vehicle.main_image_url && (
                <img
                  src={enquiry.vehicle.main_image_url}
                  alt=""
                  className="w-14 h-10 rounded object-cover"
                />
              )}
              <div>
                <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                  {enquiry.vehicle.year} {enquiry.vehicle.make} {enquiry.vehicle.model}
                </p>
                <p className="text-xs text-text-muted">View vehicle →</p>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Messages thread */}
      <div className="space-y-3 mb-4">
        {(enquiry.messages || []).map((msg) => {
          const isCustomer = msg.sender_type === 'customer';
          return (
            <div
              key={msg.message_id}
              className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 ${
                  isCustomer
                    ? 'bg-accent-blue text-white rounded-br-md'
                    : 'bg-bg-card border border-bg-border text-text-primary rounded-bl-md'
                }`}
              >
                {/* Sender name for staff messages */}
                {!isCustomer && msg.sender_name && (
                  <p className="text-xs font-semibold text-accent-blue mb-1.5 flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    {msg.sender_name} (Staff)
                  </p>
                )}
                {isCustomer && (
                  <p className="text-xs font-medium text-white/70 mb-1.5">You</p>
                )}

                {/* Message body */}
                <p className={`text-sm leading-relaxed whitespace-pre-line ${
                  isCustomer ? 'text-white' : 'text-text-secondary'
                }`}>
                  {msg.body}
                </p>

                {/* Timestamp */}
                <p className={`text-[10px] mt-2 ${
                  isCustomer ? 'text-white/50' : 'text-text-muted'
                }`}>
                  {formatDateTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box */}
      <div className="bg-bg-card border border-bg-border rounded-xl p-4">
        {enquiry.status === 'Closed' ? (
          <div className="text-center py-4">
            <p className="text-sm text-text-muted mb-2">This enquiry is closed.</p>
            <p className="text-xs text-text-muted">Send a reply to re-open it.</p>
          </div>
        ) : null}
        <form onSubmit={handleReply} className="space-y-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={enquiry.status === 'Closed' ? 'Type a message to re-open this enquiry…' : 'Type your reply…'}
            rows={3}
            className="w-full px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none"
          />
          {replyError && (
            <p className="text-xs text-status-cancelled">{replyError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="px-5 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Send Reply
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Close confirm dialog */}
      <ConfirmDialog
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleClose}
        title="Close this enquiry?"
        message="You can re-open it later by sending a new reply."
        confirmLabel={closing ? 'Closing…' : 'Close Enquiry'}
        confirmVariant="danger"
      />
    </div>
  );
}
