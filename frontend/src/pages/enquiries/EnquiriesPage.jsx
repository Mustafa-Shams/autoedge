/**
 * Staff EnquiriesPage — inbox list per spec 9 & 11.5.
 * Status filter, assign to me, pagination, customer + vehicle refs.
 * Only visible to managers and staff with handles_enquiries = true.
 */
import { useState, useEffect, useCallback } from 'react';
import { categoriesFor } from '../../utils/enquiryCategories';
import { useNavigate } from 'react-router-dom';
import { getEnquiries, updateEnquiry } from '../../api/enquiriesApi';
import { apiError } from '../../utils/apiError';
import { hasModuleAccess } from '../../utils/staffAccess';
import { useAuth } from '../../hooks/useAuth';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'Open', label: 'Open' },
  { value: 'Answered', label: 'Answered' },
  { value: 'Closed', label: 'Closed' },
];

const STATUS_BADGE = {
  Open: 'bg-blue-500/20 text-blue-400',
  Answered: 'bg-green-500/20 text-green-400',
  Closed: 'bg-gray-500/20 text-gray-400',
};

export default function EnquiriesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReply = hasModuleAccess(user, "enquiries", true);
  const [error, setError] = useState("");
  const [enquiries, setEnquiries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = { page, page_size: pageSize };
      if (statusFilter) params.status_filter = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (assignedFilter === 'mine') params.assigned_to = user?.user_id;
      const res = await getEnquiries(params);
      if (!Array.isArray(res.data.items)) throw new Error("Invalid enquiry list response");
      setEnquiries(res.data.items);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(apiError(err, "Could not load enquiries."));
      setEnquiries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, assignedFilter, categoryFilter, user?.user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssignToMe = async (enquiryId, e) => {
    e.stopPropagation();
    try {
      await updateEnquiry(enquiryId, { assigned_to: user?.user_id });
      fetchData();
    } catch (err) {
      setError(apiError(err, "Could not assign enquiry."));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <section>
      <h1 className="text-2xl font-bold text-text-primary">Enquiries</h1>
      <p className="mb-5 text-sm text-text-secondary">{total} total enquiries</p>
      {error && <p role="alert" className="mb-4 text-sm text-status-cancelled">{error}</p>}
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === f.value
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-elevated border border-bg-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-bg-elevated border border-bg-border text-text-primary"
          >
            <option value="">All my categories</option>
            {categoriesFor(user).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => { setAssignedFilter(assignedFilter === 'mine' ? '' : 'mine'); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              assignedFilter === 'mine'
                ? 'bg-accent-blue text-white'
                : 'bg-bg-elevated border border-bg-border text-text-secondary hover:text-text-primary'
            }`}
          >
            My Assigned
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-text-muted text-sm">Loading…</div>
      ) : !error && enquiries.length === 0 ? (
        <div className="bg-bg-card border border-bg-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-sm">
            {statusFilter || assignedFilter || categoryFilter ? 'No enquiries match your filters.' : 'No enquiries yet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-bg-card border border-bg-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Vehicle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Assigned</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Messages</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {enquiries.map((enq) => (
                  <tr
                    key={enq.enquiry_id}
                    onClick={() => navigate(`/enquiries/${enq.enquiry_id}`)}
                    className="hover:bg-bg-elevated cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-text-primary font-medium truncate block max-w-[200px]">{enq.subject}</span>
                    </td>
                    <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border border-bg-border text-text-secondary">{enq.category}</span></td>
                    <td className="px-4 py-3 text-text-secondary">
                      {enq.customer?.full_name || `Customer #${enq.customer_id}`}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {enq.vehicle
                        ? `${enq.vehicle.year} ${enq.vehicle.make} ${enq.vehicle.model}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_BADGE[enq.status] || ''}`}>
                        {enq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {enq.assigned_name || (
                        <button
                          onClick={(e) => handleAssignToMe(enq.enquiry_id, e)}
                          className="text-accent-blue hover:text-accent-blue-hover text-xs font-medium"
                        >
                          Assign to me
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{enq.message_count}</td>
                    <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                      {enq.updated_at ? new Date(enq.updated_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {enquiries.map((enq) => (
              <div
                key={enq.enquiry_id}
                onClick={() => navigate(`/enquiries/${enq.enquiry_id}`)}
                className="bg-bg-card border border-bg-border rounded-xl p-4 cursor-pointer hover:border-accent-blue/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-text-primary truncate">{enq.subject}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full shrink-0 ${STATUS_BADGE[enq.status] || ''}`}>
                    {enq.status}
                  </span>
                </div>
                <div className="text-xs text-text-muted space-y-1">
                  <p>Category: {enq.category}</p>
                  <p>Customer: {enq.customer?.full_name || `#${enq.customer_id}`}</p>
                  {enq.vehicle && <p>Vehicle: {enq.vehicle.year} {enq.vehicle.make} {enq.vehicle.model}</p>}
                  <p>{enq.message_count} messages · {enq.assigned_name ? `Assigned to ${enq.assigned_name}` : 'Unassigned'}</p>
                </div>
                {!enq.assigned_name && (
                  <button
                    onClick={(e) => handleAssignToMe(enq.enquiry_id, e)}
                    className="mt-2 text-xs text-accent-blue font-medium"
                  >
                    Assign to me
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs bg-bg-elevated border border-bg-border rounded-lg disabled:opacity-50 text-text-secondary hover:text-text-primary transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs bg-bg-elevated border border-bg-border rounded-lg disabled:opacity-50 text-text-secondary hover:text-text-primary transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
