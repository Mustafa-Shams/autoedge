import { Link } from 'react-router-dom';
import ImageWithFallback from '../common/ImageWithFallback';
import StarRating from '../common/StarRating';
import StockBadge from './StockBadge';
import { formatPrice } from '../../utils/formatters';

/**
 * CarCard — vehicle card per spec 11.4.
 *
 * Stock states:
 *   - in stock (>3): normal card
 *   - low stock (1-3): "Only N left" badge
 *   - stock = 0: shaded dark overlay, "Out of Stock — Currently Unavailable",
 *     "Request this car" button. NEVER labelled "Booked".
 */
export default function CarCard({
  vehicle,
  isWishlisted = false,
  onToggleWishlist,
  isCompareSelected = false,
  onToggleCompare,
  compareDisabled = false,
  restockRequested = false,
  onRequestRestock,
  loggedIn = false,
}) {
  const {
    vehicle_id,
    make,
    model,
    year,
    price,
    fuel_type,
    transmission,
    body_type,
    main_image_url,
    stock_quantity,
    avg_rating,
    review_count,
    open_restock_requests,
  } = vehicle;

  const isOutOfStock = stock_quantity === 0;

  return (
    <div className={`group relative bg-bg-card border border-bg-border rounded-xl overflow-hidden transition-all hover:border-bg-border/80 hover:shadow-lg hover:shadow-black/20 ${isOutOfStock ? 'opacity-80' : ''}`}>
      {/* Image section */}
      <Link to={`/cars/${vehicle_id}`} className="block relative">
        <ImageWithFallback
          src={main_image_url}
          alt={`${year} ${make} ${model}`}
          className="w-full h-48 sm:h-52 object-cover"
          fallbackClassName="w-full h-48 sm:h-52"
        />

        {/* Out-of-stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <p className="text-white font-semibold text-sm mb-1">Out of Stock</p>
            <p className="text-white/70 text-xs">Currently Unavailable</p>
          </div>
        )}

        {/* Stock badge */}
        {!isOutOfStock && stock_quantity <= 3 && (
          <div className="absolute top-2 left-2">
            <StockBadge stock={stock_quantity} />
          </div>
        )}
      </Link>

      {/* Wishlist heart button */}
      {onToggleWishlist && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(vehicle_id);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
            isWishlisted
              ? 'bg-status-cancelled/20 text-status-cancelled'
              : 'bg-black/40 text-white/70 hover:text-white hover:bg-black/60'
          }`}
          title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-label={`${isWishlisted ? 'Remove' : 'Save'} ${year} ${make} ${model} ${isWishlisted ? 'from' : 'to'} wishlist`}
          aria-pressed={isWishlisted}
        >
          <svg className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
      )}

      {/* Card body */}
      <div className="p-4">
        {/* Title */}
        <Link to={`/cars/${vehicle_id}`} className="block">
          <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-blue transition-colors truncate">
            {year} {make} {model}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-2 mt-1.5">
          <StarRating rating={parseFloat(avg_rating) || 0} size="xs" />
          <span className="text-xs text-text-muted">
            {review_count > 0 ? `(${review_count})` : 'No reviews'}
          </span>
        </div>

        {/* Chips: fuel, transmission, body type */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {fuel_type && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary border border-bg-border">
              {fuel_type}
            </span>
          )}
          {transmission && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary border border-bg-border">
              {transmission}
            </span>
          )}
          {body_type && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary border border-bg-border">
              {body_type}
            </span>
          )}
        </div>

        {/* Price + actions row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-bg-border">
          <p className="text-lg font-bold text-accent-blue">
            {formatPrice(price, false)}
          </p>

          <div className="flex items-center gap-2">
            {/* Compare checkbox */}
            {onToggleCompare && (
              <label
                className={`flex items-center gap-1 text-xs rounded focus-within:ring-2 focus-within:ring-accent-blue cursor-pointer ${
                  isCompareSelected ? 'text-accent-blue' : 'text-text-muted hover:text-text-secondary'
                } ${compareDisabled && !isCompareSelected ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={compareDisabled && !isCompareSelected ? 'Max 3 cars to compare' : 'Compare'}
              >
                <input
                  type="checkbox"
                  aria-label={`Compare ${year} ${make} ${model}`}
                  checked={isCompareSelected}
                  onChange={() => onToggleCompare(vehicle_id)}
                  disabled={compareDisabled && !isCompareSelected}
                  className="sr-only"
                />
                <svg className="w-4 h-4" fill={isCompareSelected ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </label>
            )}
          </div>
        </div>

        {/* Out-of-stock: Request this car */}
        {!isOutOfStock && <Link className="mt-3 block rounded-lg bg-accent-blue-strong px-3 py-2 text-center text-sm font-semibold text-white" to={`/account/checkout/${vehicle_id}`}>Buy now</Link>}
        {isOutOfStock && !onRequestRestock && <Link to={`/cars/${vehicle_id}`} className="mt-3 block text-accent-blue">View restock options</Link>}
        {isOutOfStock && onRequestRestock && (
          <div className="mt-3">
            {restockRequested ? (
              <div className="text-center">
                <p className="text-xs font-medium text-status-available">✓ Requested</p>
                {open_restock_requests > 0 && (
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {open_restock_requests} {open_restock_requests === 1 ? 'person' : 'people'} waiting
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRequestRestock) onRequestRestock(vehicle_id);
                }}
                className="w-full py-2 text-xs font-medium text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 rounded-lg transition-colors"
              >
                {loggedIn ? 'Request this car' : 'Log in to request'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
