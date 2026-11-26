/**
 * EmailLogPage — Staff view for the email outbox.
 *
 * Spec 7.9, 9 — manager only.
 * Shows all outgoing emails with status: Queued / Sent / Suppressed / Failed.
 * Status filter tabs, paginated table with customer info and error details.
 */
import { Link } from "react-router-dom";
import { Fragment, useState, useEffect, useCallback } from 'react';
import { getEmailLog, retryEmail, sendTestEmail } from '../../api/emailLogApi';
import { apiError } from '../../utils/apiError';
import {
  Mail,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  ChevronLeft,
  ChevronRight,
  Send,
  SkipForward,
} from 'lucide-react';

const STATUS_TABS = [
  { key: null, label: 'All' },
  { key: 'Queued', label: 'Queued' },
  { key: 'Sent', label: 'Sent' },
  { key: 'Suppressed', label: 'Suppressed' },
  { key: 'Skipped', label: 'Skipped' },
  { key: 'Failed', label: 'Failed' },
];

const STATUS_ICON_MAP = {
  Queued: Clock,
  Sent: CheckCircle,
  Suppressed: Ban,
  Skipped: SkipForward,
  Failed: XCircle,
};

const STATUS_COLORS = {
  Queued: 'bg-status-scheduled/20 text-status-scheduled border-status-scheduled/30',
  Sent: 'bg-status-available/20 text-status-available border-status-available/30',
  Suppressed: 'bg-status-reserved/20 text-status-reserved border-status-reserved/30',
  Skipped: 'bg-yellow-900/20 text-yellow-400 border-yellow-400/30',
  Failed: 'bg-status-cancelled/20 text-status-cancelled border-status-cancelled/30',
};

export default function EmailLogPage() {
  const [emails, setEmails] = useState([]);
  const [configured, setConfigured] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [retryError, setRetryError] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Detail expansion
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, page_size: pageSize };
      if (statusFilter) params.status = statusFilter;
      const res = await getEmailLog(params);
      setEmails(res.data.items || []);
      setTotal(res.data.total || 0);
      setConfigured(res.data.provider_configured);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load email log.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRetry(id) {
    setRetrying(id);
    setRetryError(null);
    try {
      await retryEmail(id);
      await fetchData();
    } catch (err) {
      setRetryError(err.response?.data?.detail || 'Email retry failed.');
    } finally {
      setRetrying(null);
    }
  }

  async function handleTest(event) {
    event.preventDefault();
    setSending(true);
    setTestResult(null);
    try {
      const response = await sendTestEmail(recipient.trim());
      setTestResult(response.data);
    } catch (err) {
      const result = err.response?.data;
      setTestResult(result?.status ? result : { detail: apiError(err, 'Could not run the email test.') });
    } finally {
      setSending(false);
      await fetchData();
    }
  }

  const handleFilterChange = (key) => {
    setStatusFilter(key);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

  // Count summaries
  const statusCounts = emails.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  return (

    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Email Log</h1>
            <p className="text-sm text-text-secondary">
              All outgoing email notifications and their delivery status
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {configured === false && (
        <p role="status" className="mb-5 rounded-lg border border-status-pending/30 bg-status-pending/10 p-3 text-status-pending">
          Email delivery is not configured
        </p>
      )}
      {retryError && <p role="alert" className="mb-4 text-status-cancelled">{retryError}</p>}

      <form onSubmit={handleTest} className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm text-text-secondary">
          Test recipient
          <input type="email" required maxLength={150} value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            className="input mt-1 block" autoComplete="email" />
        </label>
        <button type="submit" disabled={sending}
          className="flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm text-white disabled:opacity-50">
          <Send size={16} /> {sending ? 'Sending…' : 'Send test email'}
        </button>
      </form>
      {testResult && (
        <div role="status" className="mb-5 rounded-lg border border-bg-border bg-bg-card p-3 text-sm text-text-primary">
          {testResult.provider_status != null ? (
            <>
              <p>Provider response · HTTP {testResult.provider_status}</p>
              <pre className="mt-2 whitespace-pre-wrap break-all">{testResult.provider_body || '(empty body)'}</pre>
            </>
          ) : <p>{testResult.detail}</p>}
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
      {!loading && !error && emails.length === 0 && (
        <div className="text-center py-20 bg-bg-card border border-bg-border rounded-xl">
          <Mail className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-1">No Emails</h3>
          <p className="text-sm text-text-secondary">
            {statusFilter
              ? `No emails with status "${statusFilter}" found.`
              : 'No outgoing emails have been queued yet.'}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && emails.length > 0 && (
        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    To
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Sent
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {emails.map((e) => {
                  const StatusIcon = STATUS_ICON_MAP[e.status] || Clock;
                  const canRetry = ["Failed", "Skipped"].includes(e.status);
                  const isExpanded = expandedId === e.email_id;

                  return (
                    <Fragment key={e.email_id}>
                      <tr
                        key={e.email_id}
                        className={`hover:bg-bg-elevated/50 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-bg-elevated/30' : ''
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : e.email_id)}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-text-secondary">
                            <button type="button" aria-expanded={isExpanded} onClick={(event) => {
                              event.stopPropagation();
                              setExpandedId(isExpanded ? null : e.email_id);
                            }}>#{e.email_id}</button>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary truncate max-w-[200px]">
                              {e.to_email}
                            </p>
                            {e.customer_name && (
                              <p className="text-xs text-text-muted">{e.customer_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-text-primary truncate max-w-[250px]">
                            {e.subject}
                            {e.deal_id && <Link className="ml-2 underline" onClick={event => event.stopPropagation()} to={`/deals/${e.deal_id}`}>Deal #{e.deal_id}</Link>}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              STATUS_COLORS[e.status] || 'bg-bg-elevated text-text-secondary border-bg-border'
                            }`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary">
                            {formatDateTime(e.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary">
                            {e.sent_at ? formatDateTime(e.sent_at) : '—'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 bg-bg-elevated/50">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-text-secondary whitespace-pre-wrap break-all">
                                {e.error_message || (e.status === "Suppressed"
                                  ? "Email suppressed for a demo or test address."
                                  : e.status)}
                              </p>
                              {canRetry && (
                                <button type="button" disabled={retrying !== null}
                                  className="rounded border border-bg-border px-3 py-1.5 text-sm text-text-primary disabled:opacity-50"
                                  onClick={() => handleRetry(e.email_id)}>
                                  {retrying === e.email_id ? "Retrying…" : "Retry"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-bg-elevated/50 border-t border-bg-border">
            <p className="text-xs text-text-muted">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of{' '}
              {total} email{total !== 1 ? 's' : ''}
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
    </div>

  );
}
