/**
 * WishlistPage — list wishlist items with remove button, linked to vehicle cards.
 * Spec 10.3, 11.4.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWishlist, removeFromWishlist } from '../../api/storeApi';
import ImageWithFallback from '../../components/common/ImageWithFallback';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StockBadge from '../../components/cars/StockBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatPrice } from '../../utils/formatters';
import BackButton from '../../components/common/BackButton';

export default function WishlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getWishlist();
      setItems(res.data);
    } catch {
      setError('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWishlist(); }, []);

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      setRemoving(true);
      await removeFromWishlist(removeTarget);
      setItems((prev) => prev.filter((i) => i.vehicle_id !== removeTarget));
    } catch {
      setError('Could not remove this vehicle. Try again.');
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  };

  if (loading) return <LoadingSpinner text="Loading wishlist…" />;

  return (
    <div>
      <BackButton fallback="/account" label="Back to Account" className="mb-4" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">My Wishlist</h1>
          <p className="text-text-secondary text-sm">
            {items.length} vehicle{items.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Link
          to="/cars"
          className="text-sm text-accent-blue hover:text-accent-blue-hover transition-colors"
        >
          Browse more cars →
        </Link>
      </div>

      {error && (
        <div className="bg-status-cancelled/10 border border-status-cancelled/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-status-cancelled">{error} <button className="underline" onClick={fetchWishlist}>Retry</button></p>
        </div>
      )}

      {!error && items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          description="Browse our inventory and save your favourite vehicles"
          action={() => window.location.href = '/cars'}
          actionLabel="Browse Cars"
          icon={
            <svg className="w-16 h-16 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.vehicle_id} className="bg-bg-card border border-bg-border rounded-xl p-4 flex items-center gap-4">
              <Link to={`/cars/${item.vehicle_id}`} className="flex-shrink-0">
                <ImageWithFallback
                  src={item.main_image_url}
                  alt={`${item.year} ${item.make} ${item.model}`}
                  className="w-24 h-16 sm:w-32 sm:h-20 rounded-lg object-cover"
                  fallbackClassName="w-24 h-16 sm:w-32 sm:h-20 rounded-lg"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/cars/${item.vehicle_id}`} className="text-sm font-semibold text-text-primary hover:text-accent-blue transition-colors">
                  {item.year} {item.make} {item.model}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-bold text-accent-blue">{formatPrice(item.price, false)}</p>
                  <StockBadge stock={item.stock_quantity} />
                </div>
                <div className="mt-2">
                  <Link className="text-sm text-accent-blue underline" to={item.stock_quantity > 0 ? `/account/checkout/${item.vehicle_id}` : `/cars/${item.vehicle_id}`}>{item.stock_quantity > 0 ? 'Buy now' : 'View restock options'}</Link>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {item.fuel_type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">{item.fuel_type}</span>}
                  {item.transmission && <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">{item.transmission}</span>}
                  {item.body_type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">{item.body_type}</span>}
                </div>
              </div>
              <button
                onClick={() => setRemoveTarget(item.vehicle_id)}
                className="flex-shrink-0 p-2 text-text-muted hover:text-status-cancelled transition-colors"
                title="Remove from wishlist"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove from wishlist?"
        message="This vehicle will be removed from your saved list."
        confirmLabel="Remove"
        variant="danger"
        isLoading={removing}
      />
    </div>
  );
}
