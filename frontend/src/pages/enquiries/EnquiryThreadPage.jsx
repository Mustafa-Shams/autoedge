/**
 * Staff EnquiryThreadPage — thread detail with reply box per spec 11.5.
 * Shows customer info, vehicle reference, messages (customer vs staff styling),
 * "Assign to me" button, status updates, and reply box.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getEnquiry, replyToEnquiry, updateEnquiry } from '../../api/enquiriesApi';
import { hasModuleAccess } from "../../utils/staffAccess";
import { useAuth } from '../../hooks/useAuth';
import BackButton from '../../components/common/BackButton';

const STATUS_BADGE = {
  Open: 'bg-blue-500/20 text-blue-400',
  Answered: 'bg-green-500/20 text-green-400',
  Closed: 'bg-gray-500/20 text-gray-400',
};

export default function EnquiryThreadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReply = hasModuleAccess(user, "enquiries", true);
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState(null);
  const messagesEndRef = useRef(null);

  const fetchThread = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getEnquiry(id);
      setEnquiry(res.data);
    } catch (err) {
      if (err.response?.status === 404) setError('Enquiry not found.');
      else if (err.response?.status === 403) setError('You do not have access to enquiries.');
      else setError('Failed to load enquiry.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (enquiry?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [enquiry?.messages?.length]);

  const handleReply = async (e) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) {
      setReplyError('Reply cannot be empty.');
      return;
    }
    try {
      setSending(true);
      setReplyError(null);
      await replyToEnquiry(id, { body: trimmed });
      setReplyText('');
      await fetchThread();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setReplyError(typeof detail === 'string' ? detail : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleAssignToMe = async () => {
    try {
      await updateEnquiry(id, { assigned_to: user?.user_id });
      await fetchThread();
    } catch {
      // silently handle
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      await updateEnquiry(id, { status: newStatus });
      await fetchThread();
    } catch {
      // silently handle
    }
  };

  if (loading) {
    return (
      <section>
        <div className="text-center py-12 text-text-muted text-sm">Loading…</div>
      </section>
    );
  }

  if (error || !enquiry) {
    return (
      <section>
        <div className="bg-bg-card border border-bg-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-sm mb-4">{error || 'Enquiry not found.'}</p>
          <BackButton fallback="/enquiries" label="Back to enquiries" />
        </div>
      </section>
    );
  }

  return (
    <section>
        <div className="mb-5 flex items-center gap-3 flex-wrap">
          <BackButton fallback="/enquiries" label="Back" />
          <span className="text-text-muted">/</span>
          <h1 className="text-2xl font-bold text-text-primary">{enquiry.subject}</h1>
          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_BADGE[enquiry.status] || ''}`}>
            {enquiry.status}
          </span>
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left column — Thread */}
        <div className="lg:col-span-3 space-y-4">
          {/* Messages */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4 max-h-[500px] overflow-y-auto">
            {(enquiry.messages || []).map((msg) => {
              const isStaff = msg.sender_type === 'staff';
              return (
                <div
                  key={msg.message_id}
                  className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl p-4 ${
                      isStaff
                        ? 'bg-accent-blue text-white rounded-br-md'
                        : 'bg-bg-elevated border border-bg-border text-text-primary rounded-bl-md'
                    }`}
                  >
                    <p className={`text-xs font-semibold mb-1.5 ${isStaff ? 'text-white/70' : 'text-accent-blue'}`}>
                      {isStaff ? `${msg.sender_name || 'Staff'}` : enquiry.customer?.full_name || 'Customer'}
                    </p>
                    <p className={`text-sm leading-relaxed whitespace-pre-line ${
                      isStaff ? 'text-white' : 'text-text-secondary'
                    }`}>
                      {msg.body}
                    </p>
                    <p className={`text-[10px] mt-2 ${isStaff ? 'text-white/50' : 'text-text-muted'}`}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {canReply && <div className="bg-bg-card border border-bg-border rounded-xl p-4">
            <form onSubmit={handleReply} className="space-y-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply to the customer…"
                rows={3}
                className="w-full px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none"
              />
              {replyError && (
                <p className="text-xs text-red-400">{replyError}</p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-text-muted">
                  Your reply will set the status to "Answered" and notify the customer.
                </p>
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="px-5 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending…' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>}
        </div>

        {/* Right column — Info panel */}
        <div className="space-y-4">
          {/* Customer info */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Customer</h3>
            {enquiry.customer ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent-blue flex items-center justify-center text-xs font-bold text-white">
                    {enquiry.customer.full_name?.[0]?.toUpperCase() || 'C'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{enquiry.customer.full_name}</p>
                    <p className="text-xs text-text-muted">{enquiry.customer.email}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Customer #{enquiry.customer_id}</p>
            )}
          </div>

          {/* Vehicle info */}
          {enquiry.vehicle && (
            <div className="bg-bg-card border border-bg-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Vehicle</h3>
              <p className="text-sm font-medium text-text-primary">
                {enquiry.vehicle.year} {enquiry.vehicle.make} {enquiry.vehicle.model}
              </p>
            </div>
          )}

          {/* Assignment */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Assigned To</h3>
            {enquiry.assigned_name ? (
              <p className="text-sm text-text-primary">{enquiry.assigned_name}</p>
            ) : (
              <div>
                <p className="text-xs text-text-muted mb-2">Unassigned</p>
                <button
                  disabled={!canReply}
                  onClick={handleAssignToMe}
                  className="px-3 py-1.5 text-xs font-medium text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 rounded-lg transition-colors"
                >
                  Assign to me
                </button>
              </div>
            )}
          </div>

          {canReply && <div className="bg-bg-card border border-bg-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Actions</h3>
            <div className="space-y-2">
              {enquiry.status !== 'Closed' && (
                <button
                  onClick={() => handleUpdateStatus('Closed')}
                  className="w-full px-3 py-2 text-xs font-medium text-text-secondary bg-bg-elevated hover:bg-bg-border border border-bg-border rounded-lg transition-colors"
                >
                  Close Enquiry
                </button>
              )}
              {enquiry.status === 'Closed' && (
                <button
                  onClick={() => handleUpdateStatus('Open')}
                  className="w-full px-3 py-2 text-xs font-medium text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 rounded-lg transition-colors"
                >
                  Re-open Enquiry
                </button>
              )}
            </div>
          </div>}

          {/* Metadata */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Details</h3>
            <div className="space-y-2 text-xs text-text-muted">
              <div className="flex justify-between">
                <span>Enquiry ID</span>
                <span className="text-text-secondary">#{enquiry.enquiry_id}</span>
              </div>
              <div className="flex justify-between">
                <span>Messages</span>
                <span className="text-text-secondary">{enquiry.message_count}</span>
              </div>
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-text-secondary">
                  {enquiry.created_at ? new Date(enquiry.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span className="text-text-secondary">
                  {enquiry.updated_at ? new Date(enquiry.updated_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
