/**
 * StatusBadge — styled badge for various entity statuses.
 * Colours follow the design tokens (Article XVII).
 */

const STATUS_STYLES = {
  // Reservations
  Active: 'bg-status-reserved/20 text-status-reserved',
  Expired: 'bg-status-cancelled/20 text-status-cancelled',
  Cancelled: 'bg-status-cancelled/20 text-status-cancelled',
  Converted: 'bg-status-sold/20 text-status-sold',

  // Test Drives
  Requested: 'bg-status-reserved/20 text-status-reserved',
  Confirmed: 'bg-accent-blue/20 text-accent-blue',
  Scheduled: 'bg-status-scheduled/20 text-status-scheduled',
  Completed: 'bg-status-available/20 text-status-available',
  Declined: 'bg-status-cancelled/20 text-status-cancelled',
  'No-show': 'bg-text-muted/20 text-text-muted',

  // Enquiries
  Open: 'bg-status-reserved/20 text-status-reserved',
  Replied: 'bg-accent-blue/20 text-accent-blue',
  Closed: 'bg-text-muted/20 text-text-muted',

  // Trade-ins
  Submitted: 'bg-status-reserved/20 text-status-reserved',
  'Under Review': 'bg-accent-blue/20 text-accent-blue',
  'Offer Made': 'bg-status-sold/20 text-status-sold',
  Accepted: 'bg-status-available/20 text-status-available',
  Rejected: 'bg-status-cancelled/20 text-status-cancelled',
  Used: 'bg-status-available/20 text-status-available',

  // Service Bookings
  Booked: 'bg-status-reserved/20 text-status-reserved',
  Pending: 'bg-status-reserved/20 text-status-reserved',
  'In Progress': 'bg-accent-blue/20 text-accent-blue',

  // Restock Requests
  Fulfilled: 'bg-status-available/20 text-status-available',
  Withdrawn: 'bg-text-muted/20 text-text-muted',

  // Reviews
  Visible: 'bg-status-available/20 text-status-available',
  Hidden: 'bg-status-cancelled/20 text-status-cancelled',

  // Vehicles
  Available: 'bg-status-available/20 text-status-available',
  Reserved: 'bg-status-reserved/20 text-status-reserved',
  Sold: 'bg-status-sold/20 text-status-sold',

  // Bank transactions
  deposit: 'bg-status-available/20 text-status-available',
  reservation_hold: 'bg-status-reserved/20 text-status-reserved',
  reservation_refund: 'bg-accent-blue/20 text-accent-blue',
  top_up: 'bg-status-available/20 text-status-available',
  service_fee: 'bg-status-sold/20 text-status-sold',
  service_refund: 'bg-accent-blue/20 text-accent-blue',
  trade_in_credit: 'bg-status-available/20 text-status-available',

  // Stock
  'In Stock': 'bg-status-available/20 text-status-available',
  'Out of Stock': 'bg-status-cancelled/20 text-status-cancelled',
  'Low Stock': 'bg-status-reserved/20 text-status-reserved',

  // Published
  Published: 'bg-status-available/20 text-status-available',
  Unpublished: 'bg-text-muted/20 text-text-muted',
};

const DEFAULT_STYLE = 'bg-bg-border/40 text-text-secondary';

export default function StatusBadge({ status, size = 'sm', className = '' }) {
  if (!status) return null;

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  const style = STATUS_STYLES[status] || DEFAULT_STYLE;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full whitespace-nowrap ${sizeClasses[size] || sizeClasses.sm} ${style} ${className}`}
    >
      {status}
    </span>
  );
}
