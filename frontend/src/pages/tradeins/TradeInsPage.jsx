import ModalOverlay from '../../components/common/ModalOverlay';
import BackButton from "../../components/common/BackButton";
/**
 * TradeInsPage — staff page for managing customer trade-in requests.
 * Lists trade-ins, allows setting Under Review / Offer Made with offered value.
 * Spec 7.7, 10.4.
 */
import { useState, useEffect, useCallback } from 'react';
import { getTradeIn, getTradeIns, updateTradeIn } from '../../api/tradeInsApi';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Filter, AlertTriangle, ArrowRightLeft, Eye, DollarSign, CheckCircle } from 'lucide-react';
import ImageLightbox from '../../components/common/ImageLightbox';
import AcquisitionPanel from './AcquisitionPanel';

const STATUS_OPTIONS = ['', 'Submitted', 'Under Review', 'Offer Made', 'Accepted', 'Declined', 'Expired', 'Completed', 'Cancelled'];

export default function TradeInsPage() {
  const [params] = useSearchParams();
  const openId = params.get("id");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const pageSize = 15;

  // Offer modal
  const [offerTarget, setOfferTarget] = useState(null);
  const [offeredValue, setOfferedValue] = useState('');
  const [staffNotes, setStaffNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Detail modal
  const [detailTarget, setDetailTarget] = useState(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, page_size: pageSize };
      if (statusFilter) params.status = statusFilter;
      const res = await getTradeIns(params);
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load trade-ins.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!openId) return;
    let active = true;
    getTradeIn(openId).then(res => { if (active) setDetailTarget(res.data); })
      .catch(() => { if (active) setError("Could not open this trade-in."); });
    return () => { active = false; };
  }, [openId]);

  const handleSetUnderReview = async (id) => {
    try {
      await updateTradeIn(id, { status: 'Under Review' });
      await fetchData();
      setSuccessMessage('Status updated to Under Review.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const handleOpenOffer = (item) => {
    setOfferTarget(item);
    setOfferedValue('');
    setStaffNotes(item.staff_notes || '');
    setSubmitError(null);
  };

  const handleSubmitOffer = async () => {
    if (!offeredValue || parseFloat(offeredValue) <= 0) {
      setSubmitError('Enter a valid offer amount.');
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError(null);
      await updateTradeIn(offerTarget.trade_in_id, {
        status: 'Offer Made',
        offered_value: parseFloat(offeredValue),
        staff_notes: staffNotes.trim() || null,
      });
      setOfferTarget(null);
      await fetchData();
      setSuccessMessage('Offer submitted successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setSubmitError(err.response?.data?.detail || 'Failed to submit offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const formatPrice = (v) => v != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) : '—';

  const getStatusBadge = (status) => {
    const colors = {
      Submitted: 'bg-status-scheduled/10 text-status-scheduled',
      'Under Review': 'bg-status-reserved/10 text-status-reserved',
      'Offer Made': 'bg-accent-blue/10 text-accent-blue',
      Accepted: 'bg-status-available/10 text-status-available',
      Declined: 'bg-status-cancelled/10 text-status-cancelled',
      Expired: 'bg-bg-elevated text-text-muted',
      Completed: 'bg-status-sold/10 text-status-sold',
      Cancelled: 'bg-status-cancelled/10 text-status-cancelled',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || 'bg-bg-elevated text-text-muted'}`}>
        {status}
      </span>
    );
  };

  return (

    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Trade-In Requests</h1>
            <p className="text-sm text-text-secondary">Review customer trade-in submissions and make offers</p>
          </div>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Toasts */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-status-available/10 border border-status-available/20 rounded-xl">
          <CheckCircle className="w-5 h-5 text-status-available flex-shrink-0" />
          <p className="text-sm text-status-available font-medium">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-status-cancelled/10 border border-status-cancelled/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-status-cancelled flex-shrink-0" />
          <p className="text-sm text-status-cancelled">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-text-muted" />
        <select aria-label="Filter trade-ins by status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-text-muted ml-auto">{total} trade-in{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Loading */}
      {loading && <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" /></div>}

      {/* Empty */}
      {!loading && items.length === 0 && (
        <div className="text-center py-20 bg-bg-card border border-bg-border rounded-xl">
          <ArrowRightLeft className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-1">No Trade-Ins</h3>
          <p className="text-sm text-text-secondary">{statusFilter ? 'No trade-ins match this filter.' : 'No trade-in requests yet.'}</p>
        </div>
      )}

      {/* Table */}
      {!loading && items.length > 0 && (
        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Vehicle</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Customer</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Condition</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Estimate</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {items.map((ti) => (
                  <tr key={ti.trade_in_id} className="hover:bg-bg-elevated/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-text-primary">{ti.year} {ti.make} {ti.model}</span>
                      <span className="text-xs text-text-muted block">{ti.mileage_km?.toLocaleString()} km{ti.color ? ` • ${ti.color}` : ''}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-text-primary block">{ti.customer_name || 'Unknown'}</span>
                      <span className="text-xs text-text-muted">{ti.customer_email || ''}</span>
                    </td>
                    <td className="px-5 py-4"><span className="text-sm text-text-secondary">{ti.condition_rating}</span></td>
                    <td className="px-5 py-4">
                      {ti.offered_value ? (
                        <span className="text-sm font-semibold text-accent-blue">{formatPrice(ti.offered_value)}</span>
                      ) : ti.indicative_low && ti.indicative_high ? (
                        <span className="text-xs text-text-secondary">{formatPrice(ti.indicative_low)}–{formatPrice(ti.indicative_high)}</span>
                      ) : (
                        <span className="text-xs text-text-muted">No estimate</span>
                      )}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(ti.status)}</td>
                    <td className="px-5 py-4"><span className="text-xs text-text-secondary">{formatDate(ti.created_at)}</span></td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setDetailTarget(ti)} className="text-xs text-accent-blue hover:text-accent-blue-hover transition-colors">
                          View
                        </button>
                        {ti.status === 'Submitted' && (
                          <button onClick={() => handleSetUnderReview(ti.trade_in_id)} className="px-2.5 py-1 bg-status-reserved/10 text-status-reserved text-xs font-medium rounded-lg hover:bg-status-reserved/20 transition-colors">
                            Review
                          </button>
                        )}
                        {(ti.status === 'Submitted' || ti.status === 'Under Review') && (
                          <button onClick={() => handleOpenOffer(ti)} className="px-2.5 py-1 bg-accent-blue/10 text-accent-blue text-xs font-medium rounded-lg hover:bg-accent-blue/20 transition-colors">
                            Make Offer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-bg-border">
              <span className="text-xs text-text-muted">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-xs bg-bg-elevated border border-bg-border rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors">Previous</button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 text-xs bg-bg-elevated border border-bg-border rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      {detailTarget && (
        <ModalOverlay onDismiss={() => setDetailTarget(null)} aria-label="Trade-in details" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailTarget(null)} />
          <div  className="relative bg-bg-card border border-bg-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <BackButton onClick={() => setDetailTarget(null)} className="mb-3" />
            <div className="mb-2 text-sm text-text-secondary">Status: {detailTarget.status}</div>
            <AcquisitionPanel trade={detailTarget} refresh={async row => { setDetailTarget(row); await fetchData(); }} />
            <h3 className="text-lg font-bold text-text-primary mb-1">{detailTarget.year} {detailTarget.make} {detailTarget.model}</h3>
            <p className="text-sm text-text-secondary mb-4">{detailTarget.mileage_km?.toLocaleString()} km • {detailTarget.condition_rating}{detailTarget.color ? ` • ${detailTarget.color}` : ''}</p>

            {detailTarget.description && (
              <div className="mb-4">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-text-secondary">{detailTarget.description}</p>
              </div>
            )}

            {detailTarget.images && detailTarget.images.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Photos ({detailTarget.images.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {detailTarget.images.map((img, i) => (
                    <button type="button" aria-label={`Open photo ${i + 1}`} key={img.image_id || i} className="aspect-square rounded-lg overflow-hidden bg-bg-elevated border border-bg-border cursor-pointer hover:ring-2 hover:ring-accent-blue transition-all" onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}>
                      <img src={img.image_url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detailTarget.target_vehicle_label && (
              <div className="mb-4 p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
                <p className="text-xs text-text-muted">Trading towards: <span className="text-accent-blue font-medium">{detailTarget.target_vehicle_label}</span></p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              {detailTarget.expected_price && (
                <div className="bg-bg-elevated rounded-lg p-3">
                  <p className="text-[10px] text-text-muted uppercase">Customer Expects</p>
                  <p className="text-sm font-semibold text-text-primary">{formatPrice(detailTarget.expected_price)}</p>
                </div>
              )}
              {detailTarget.indicative_low && (
                <div className="bg-bg-elevated rounded-lg p-3">
                  <p className="text-[10px] text-text-muted uppercase">Auto Estimate</p>
                  <p className="text-sm font-semibold text-text-primary">{formatPrice(detailTarget.indicative_low)}–{formatPrice(detailTarget.indicative_high)}</p>
                </div>
              )}
              {detailTarget.offered_value && (
                <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-3">
                  <p className="text-[10px] text-accent-blue uppercase">Your Offer</p>
                  <p className="text-sm font-bold text-accent-blue">{formatPrice(detailTarget.offered_value)}</p>
                  {detailTarget.offer_valid_until && (
                    <p className="mt-1 text-xs text-text-secondary">
                      {detailTarget.status === "Expired" ? "Expired " : "Expires "}
                      {new Date(detailTarget.offer_valid_until).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => setDetailTarget(null)} className="w-full px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors">Close</button>
          </div>
        </ModalOverlay>
      )}

      {/* Offer modal */}
      {offerTarget && (
        <ModalOverlay onDismiss={() => setOfferTarget(null)} aria-label="Make offer" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOfferTarget(null)} />
          <div className="relative bg-bg-card border border-bg-border rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-text-primary mb-1">Make Offer</h3>
            <p className="text-sm text-text-secondary mb-4">{offerTarget.year} {offerTarget.make} {offerTarget.model} — {offerTarget.condition_rating}</p>

            {offerTarget.indicative_low && (
              <p className="text-xs text-text-muted mb-4">System estimate: {formatPrice(offerTarget.indicative_low)}–{formatPrice(offerTarget.indicative_high)}</p>
            )}

            <div className="mb-4">
              <label htmlFor="tradeinspage-offered-value" className="block text-sm font-medium text-text-secondary mb-1.5">Offered Value (\$)</label>
              <input id="tradeinspage-offered-value" type="number" min="0" step="0.01" value={offeredValue} onChange={(e) => setOfferedValue(e.target.value)}
                className="w-full px-4 py-2.5 bg-bg-primary border border-bg-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors" autoFocus />
            </div>

            <div className="mb-4">
              <label htmlFor="tradeinspage-staff-notes-optional" className="block text-sm font-medium text-text-secondary mb-1.5">Staff Notes (optional)</label>
              <textarea id="tradeinspage-staff-notes-optional" value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} rows={3}
                className="w-full px-4 py-2.5 bg-bg-primary border border-bg-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors resize-none"
                placeholder="Notes visible to customer..." />
            </div>

            {submitError && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-status-cancelled" />
                <p className="text-xs text-status-cancelled">{submitError}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button onClick={() => setOfferTarget(null)} disabled={submitting} className="flex-1 px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40">Cancel</button>
              <button onClick={handleSubmitOffer} disabled={submitting} className="flex-1 px-4 py-2.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting…</> : <><DollarSign className="w-4 h-4" />Submit Offer</>}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      {/* Image lightbox */}
      {lightboxOpen && detailTarget?.images?.length > 0 && (
        <ImageLightbox
          images={detailTarget.images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>

  );
}
