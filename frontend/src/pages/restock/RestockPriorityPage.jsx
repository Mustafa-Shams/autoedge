import ModalOverlay from '../../components/common/ModalOverlay';
/**
 * RestockPriorityPage — staff view showing out-of-stock vehicles ranked by
 * number of customer restock requests. Staff can restock a vehicle (add quantity).
 *
 * Spec 7.4, 10.4 — reads v_restock_priority, action "Restock {quantity ≥ 1}".
 */
import { useState, useEffect, useCallback } from 'react';
import { getRestockPriority, restockVehicle } from '../../api/restockApi';
import { Package, RefreshCw, Plus, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

export default function RestockPriorityPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restock modal state
  const [restockTarget, setRestockTarget] = useState(null); // { vehicle_id, make, model, year }
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getRestockPriority();
      setItems(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load restock priority data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenRestock = (item) => {
    setRestockTarget(item);
    setQuantity(1);
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const handleCloseRestock = () => {
    setRestockTarget(null);
    setQuantity(1);
    setSubmitError(null);
  };

  const handleRestock = async () => {
    if (quantity < 1) {
      setSubmitError('Quantity must be at least 1.');
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError(null);
      const res = await restockVehicle(restockTarget.vehicle_id, { quantity });
      setSuccessMessage(
        `Restocked ${res.data.year} ${res.data.make} ${res.data.model} — new stock: ${res.data.new_stock}`
      );
      handleCloseRestock();
      // Refresh the table
      await fetchData();
      // Clear success after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setSubmitError(err.response?.data?.detail || 'Restock failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (

    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Restock Priority</h1>
            <p className="text-sm text-text-secondary">
              Out-of-stock vehicles ranked by customer demand
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

      {/* Success toast */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-status-available/10 border border-status-available/20 rounded-xl">
          <CheckCircle className="w-5 h-5 text-status-available flex-shrink-0" />
          <p className="text-sm text-status-available font-medium">{successMessage}</p>
        </div>
      )}

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
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-20 bg-bg-card border border-bg-border rounded-xl">
          <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-1">No Restock Requests</h3>
          <p className="text-sm text-text-secondary">
            All vehicles are in stock or no customers have requested restocks.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && items.length > 0 && (
        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Open Requests
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Oldest Request
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {items.map((item, index) => (
                  <tr
                    key={item.vehicle_id}
                    className="hover:bg-bg-elevated/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className={`
                        inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                        ${index === 0 ? 'bg-status-reserved/20 text-status-reserved' :
                          index === 1 ? 'bg-accent-blue/10 text-accent-blue' :
                          index === 2 ? 'bg-status-sold/10 text-status-sold' :
                          'bg-bg-elevated text-text-secondary'}
                      `}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-text-primary">
                        {item.year} {item.make} {item.model}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-secondary">
                        {formatPrice(item.price)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-status-reserved/10 border border-status-reserved/20 rounded-full text-xs font-semibold text-status-reserved">
                        <Clock className="w-3 h-3" />
                        {item.open_requests} request{item.open_requests !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-secondary">
                        {formatDate(item.oldest_request_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenRestock(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue hover:bg-accent-blue-hover text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          <div className="px-6 py-3 bg-bg-elevated/50 border-t border-bg-border">
            <p className="text-xs text-text-muted">
              {items.length} out-of-stock vehicle{items.length !== 1 ? 's' : ''} with active requests —{' '}
              {items.reduce((sum, i) => sum + i.open_requests, 0)} total open requests
            </p>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockTarget && (
        <ModalOverlay onDismiss={handleCloseRestock} aria-label="Restock vehicle" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseRestock}
          />

          {/* Modal */}
          <div className="relative bg-bg-card border border-bg-border rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-text-primary mb-1">
              Restock Vehicle
            </h3>
            <p className="text-sm text-text-secondary mb-6">
              {restockTarget.year} {restockTarget.make} {restockTarget.model}
            </p>

            {/* Quantity input */}
            <div className="mb-6">
              <label htmlFor="restockprioritypage-quantity-to-add" className="block text-sm font-medium text-text-secondary mb-2">
                Quantity to add
              </label>
              <input id="restockprioritypage-quantity-to-add"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-2.5 bg-bg-primary border border-bg-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors"
                autoFocus
              />
              <p className="text-xs text-text-muted mt-1.5">
                This will add stock and notify {restockTarget.open_requests} customer{restockTarget.open_requests !== 1 ? 's' : ''} who requested this car.
              </p>
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-status-cancelled flex-shrink-0" />
                <p className="text-xs text-status-cancelled">{submitError}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCloseRestock}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Restocking…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Restock +{quantity}
                  </>
                )}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>

  );
}
