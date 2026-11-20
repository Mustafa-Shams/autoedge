/**
 * StockBadge — shows stock status per spec 11.4.
 * - In stock (>3): no badge
 * - Low stock (1-3): "Only N left" warning badge
 * - Out of stock (0): "Out of Stock" badge
 */
export default function StockBadge({ stock, className = '' }) {
  if (stock == null) return null;

  if (stock === 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-status-cancelled/20 text-status-cancelled ${className}`}>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        Out of Stock
      </span>
    );
  }

  if (stock <= 3) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-status-reserved/20 text-status-reserved ${className}`}>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        Only {stock} left
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-status-available/20 text-status-available ${className}`}>
      In Stock
    </span>
  );
}
