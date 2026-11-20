/**
 * EmailLogPage — Staff view for the email outbox.
 *
 * Spec 7.9, 9 — manager only.
 * Shows all outgoing emails with status: Queued / Sent / Suppressed / Failed.
 * Status filter tabs, paginated table with customer info and error details.
 */
import { useState, useEffect, useCallback } from 'react';
import { getEmailLog } from '../../api/emailLogApi';
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
} from 'lucide-react';

const STATUS_TABS = [
  { key: null, label: 'All' },
  { key: 'Queued', label: 'Queued' },
  { key: 'Sent', label: 'Sent' },
  { key: 'Suppressed', label: 'Suppressed' },
  { key: 'Failed', label: 'Failed' },
];

const STATUS_ICON_MAP = {
  Queued: Clock,
  Sent: CheckCircle,
  Suppressed: Ban,
  Failed: XCircle,
};

const STATUS_COLORS = {
  Queued: 'bg-status-scheduled/20 text-status-scheduled border-status-scheduled/30',
  Sent: 'bg-status-available/20 text-status-available border-status-available/30',
  Suppressed: 'bg-status-reserved/20 text-status-reserved border-status-reserved/30',
  Failed: 'bg-status-cancelled/20 text-status-cancelled border-status-cancelled/30',
};

export default function EmailLogPage() {
  const [emails, setEmails] = useState([]);
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
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load email log.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    <div className="p-6 max-w-7xl mx-auto">
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
                  const isExpanded = expandedId === e.email_id;

                  return (
                    <>
                      <tr
                        key={e.email_id}
                        className={`hover:bg-bg-elevated/50 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-bg-elevated/30' : ''
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : e.email_id)}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-text-secondary">
                            #{e.email_id}
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
                      {/* Expanded error row */}
                      {isExpanded && e.error_message && (
                        <tr key={`${e.email_id}-error`}>
                          <td colSpan={6} className="px-4 py-3 bg-status-cancelled/5">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-status-cancelled flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-status-cancelled mb-1">
                                  Error Details
                                </p>
                                <p className="text-xs text-text-secondary font-mono whitespace-pre-wrap break-all">
                                  {e.error_message}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && !e.error_message && e.status === 'Suppressed' && (
                        <tr key={`${e.email_id}-info`}>
                          <td colSpan={6} className="px-4 py-3 bg-status-reserved/5">
                            <div className="flex items-start gap-2">
                              <Ban className="w-4 h-4 text-status-reserved flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-text-secondary">
                                This email was suppressed because the recipient address belongs to a
                                demo/test domain. The customer still receives an in-app notification.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
