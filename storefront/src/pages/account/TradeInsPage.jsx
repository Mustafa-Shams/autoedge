/**
 * TradeInsPage — account page listing all trade-in requests.
 * Shows status, indicative/offered values, accept/decline actions, cancel.
 * Spec 7.7.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getTradeIns, respondToTradeIn, cancelTradeIn, respondToInspection } from '../../api/storeApi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';
import { formatPrice, formatDate, formatCountdown } from '../../utils/formatters';
import BackButton from '../../components/common/BackButton';

const STATUS_COLORS = {
  Submitted: 'info',
  'Under Review': 'scheduled',
  'Offer Made': 'reserved',
  Accepted: 'available',
  Declined: 'cancelled',
  Expired: 'muted',
  Completed: 'sold',
  Cancelled: 'cancelled',
};

export default function TradeInsPage() {
  const [allRecords, setTradeIns] = useState([]);
  const [params] = useSearchParams();
  const record = params.get('id');
  const tradeIns = record ? allRecords.filter(item => String(item.trade_in_id) === record) : allRecords;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionTarget, setActionTarget] = useState(null); // { trade_in_id, action: 'accept'|'decline'|'cancel' }
  const [acting, setActing] = useState(false);

  const fetchTradeIns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getTradeIns();
      setTradeIns(res.data || []);
    } catch {
      setError('Failed to load your trade-in requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTradeIns();
  }, [fetchTradeIns]);

  const handleAction = async () => {
    if (!actionTarget) return;
    const { trade_in_id, action } = actionTarget;
    try {
      setActing(true);
      if (action === 'accept') {
        await respondToTradeIn(trade_in_id, { accept: true });
      } else if (action === 'decline') {
        await respondToTradeIn(trade_in_id, { accept: false });
      } else if (action === 'cancel') {
        await cancelTradeIn(trade_in_id);
      }
      setActionTarget(null);
      await fetchTradeIns();
    } catch (err) {
      setError(err.response?.data?.detail || 'Action failed.');
      setActionTarget(null);
    } finally {
      setActing(false);
    }
  };

  async function inspection(trade, accept) {
    setActing(true);
    try { await respondToInspection(trade.trade_in_id, trade.acquisition.version, accept); await fetchTradeIns(); }
    catch (err) { setError(err.response?.data?.detail || 'Could not record your decision.'); }
    finally { setActing(false); }
  }

  const getConfirmMessage = () => {
    if (!actionTarget) return '';
    const ti = tradeIns.find((t) => t.trade_in_id === actionTarget.trade_in_id);
    const label = ti ? `${ti.year} ${ti.make} ${ti.model}` : 'this vehicle';
    switch (actionTarget.action) {
      case 'accept':
        return `Accept the offer of ${ti?.offered_value ? formatPrice(ti.offered_value) : 'N/A'} for your ${label}? The showroom will arrange an inspection. Credit becomes available after you agree to the inspected value and staff receive the car.`;
      case 'decline':
        return `Decline the offer for your ${label}? You can submit a new trade-in later.`;
      case 'cancel':
        return `Cancel the trade-in request for your ${label}?`;
      default:
        return '';
    }
  };

  return (
    <div>
      <BackButton fallback="/account" label="Back to Account" className="mb-4" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">My Trade-Ins</h1>
          {record && <Link className="underline" to="/account/trade-ins">View all trade ins</Link>}
          <p className="text-text-secondary text-sm">View and manage your trade-in requests</p>
        </div>
        <Link
          to="/account/trade-ins/new"
          className="px-5 py-2.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white text-sm font-medium rounded-xl transition-colors"
        >
          + New Trade-In
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-status-cancelled/10 border border-status-cancelled/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-status-cancelled">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && tradeIns.length === 0 && (
        <div className="bg-bg-card border border-bg-border rounded-xl p-12 text-center">
          <svg className="w-12 h-12 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          <h3 className="text-lg font-semibold text-text-primary mb-1">No trade-ins yet</h3>
          <p className="text-sm text-text-secondary mb-4">
            Submit your current vehicle for a trade-in valuation.
          </p>
          <Link
            to="/account/trade-ins/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white text-sm font-medium rounded-xl transition-colors"
          >
            Start a Trade-In
          </Link>
        </div>
      )}

      {/* Trade-in list */}
      {!loading && tradeIns.length > 0 && (
        <div className="space-y-4">
          {tradeIns.map((ti) => (
            <div
              key={ti.trade_in_id}
              className="bg-bg-card border border-bg-border rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {ti.year} {ti.make} {ti.model}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                    <span>{ti.mileage_km?.toLocaleString()} km</span>
                    {ti.color && <span>• {ti.color}</span>}
                    <span>• {ti.condition_rating}</span>
                  </div>
                </div>
                <StatusBadge status={ti.status} colorMap={STATUS_COLORS} />
              </div>

              {/* Images preview */}
              {ti.images && ti.images.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {ti.images.slice(0, 4).map((img, idx) => (
                    <div
                      key={img.image_id || idx}
                      className="w-16 h-16 rounded-lg overflow-hidden bg-bg-elevated border border-bg-border flex-shrink-0"
                    >
                      <img
                        src={img.image_url}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  ))}
                  {ti.images.length > 4 && (
                    <div className="w-16 h-16 rounded-lg bg-bg-elevated border border-bg-border flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-text-muted">+{ti.images.length - 4}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Values */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {/* Indicative estimate */}
                {ti.indicative_low && ti.indicative_high && (
                  <div className="bg-bg-elevated rounded-lg p-3">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Estimate</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {formatPrice(ti.indicative_low)} — {formatPrice(ti.indicative_high)}
                    </p>
                  </div>
                )}

                {/* Offered value */}
                {ti.offered_value && (
                  <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-3">
                    <p className="text-[10px] text-accent-blue uppercase tracking-wider mb-0.5">Offer</p>
                    <p className="text-sm font-bold text-accent-blue">
                      {formatPrice(ti.offered_value)}
                    </p>
                    {ti.offer_valid_until && (
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Valid until {formatDate(ti.offer_valid_until)}
                      </p>
                    )}
                  </div>
                )}

                {/* Target vehicle */}
                {ti.deal_id && <Link className="underline" to={`/account/deals/${ti.deal_id}`}>Deal #{ti.deal_id}</Link>}
                {ti.target_vehicle_label && (
                  <div className="bg-bg-elevated rounded-lg p-3">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Trading Towards</p>
                    <Link
                      to={`/cars/${ti.target_vehicle_id}`}
                      className="text-sm font-medium text-accent-blue hover:text-accent-blue-hover"
                    >
                      {ti.target_vehicle_label}
                    </Link>
                  </div>
                )}
              </div>

              {/* Staff notes */}
              {ti.staff_notes && (
                <div className="bg-bg-elevated rounded-lg p-3 mb-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Staff Notes</p>
                  <p className="text-sm text-text-secondary">{ti.staff_notes}</p>
                </div>
              )}

              {/* Date + actions */}
              <div className="flex items-center justify-between pt-2 border-t border-bg-border">
                <span className="text-xs text-text-muted">
                  Submitted {formatDate(ti.created_at)}
                </span>

                <div className="flex items-center gap-2">
                  {/* Accept / Decline buttons for Offer Made */}
                  {ti.acquisition && <div className="space-y-2 text-sm">
                    {ti.acquisition.inspection_at && <p>Inspection appointment · {new Date(ti.acquisition.inspection_at).toLocaleString()}</p>}
                    {ti.acquisition.findings && <p>{ti.acquisition.findings} · Verified value {formatPrice(ti.acquisition.value)}</p>}
                    {Number(ti.acquisition.excess) > 0 && <p>Separate settlement {formatPrice(ti.acquisition.excess)} · {ti.acquisition.settlement}</p>}
                    {ti.status === 'Accepted' && ti.acquisition.version > 0 && ti.acquisition.approved_version !== ti.acquisition.version &&
                      <div className="flex gap-4"><button disabled={acting} onClick={() => inspection(ti, true)} className="text-accent-blue">Agree to inspection terms</button>
                        {!ti.acquisition.received && <button disabled={acting} onClick={() => inspection(ti, false)}>Decline terms</button>}</div>}
                    {ti.acquisition.received && <p>{ti.acquisition.returned ? 'Trade-in returned to you' : 'Physical intake recorded'}</p>}
                    {ti.acquisition.settled_amount != null && <p>Separate payment {formatPrice(ti.acquisition.settled_amount)} · {ti.acquisition.settlement_reference}</p>}
                    {ti.acquisition.listing_id && <Link className="text-accent-blue" to={`/cars/${ti.acquisition.listing_id}`}>View resale listing</Link>}
                  </div>}
                  {ti.status === 'Offer Made' && (
                    <>
                      <button
                        onClick={() => setActionTarget({ trade_in_id: ti.trade_in_id, action: 'accept' })}
                        className="px-3 py-1.5 bg-status-available/10 text-status-available text-xs font-medium rounded-lg hover:bg-status-available/20 transition-colors"
                      >
                        Accept Offer
                      </button>
                      <button
                        onClick={() => setActionTarget({ trade_in_id: ti.trade_in_id, action: 'decline' })}
                        className="px-3 py-1.5 bg-status-cancelled/10 text-status-cancelled text-xs font-medium rounded-lg hover:bg-status-cancelled/20 transition-colors"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {/* Cancel button for Submitted / Under Review */}
                  {(['Submitted', 'Under Review', 'Accepted', 'Offer Made'].includes(ti.status) && !ti.acquisition?.received) && (
                    <button
                      onClick={() => setActionTarget({ trade_in_id: ti.trade_in_id, action: 'cancel' })}
                      className="px-3 py-1.5 text-xs text-status-cancelled hover:text-status-cancelled/80 transition-colors"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={!!actionTarget}
        isLoading={acting}
        cancelLabel="Go back"
        title={
          actionTarget?.action === 'accept' ? 'Accept Offer' :
          actionTarget?.action === 'decline' ? 'Decline Offer' :
          'Cancel Trade-In'
        }
        message={getConfirmMessage()}
        confirmLabel={acting ? 'Processing…' : actionTarget?.action === 'accept' ? 'Accept' : actionTarget?.action === 'decline' ? 'Decline' : 'Cancel'}
        onConfirm={handleAction}
        onClose={() => setActionTarget(null)}
        variant={actionTarget?.action === 'accept' ? 'info' : 'danger'}
      />
    </div>
  );
}
