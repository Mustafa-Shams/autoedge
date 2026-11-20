/**
 * Receipt — printable receipt component with receipt number, transaction ref,
 * amount, balance, hold-until, print-to-PDF button.
 * Per spec 8.5-8.6.
 */
import { formatPrice, formatDate, formatDateTime } from '../../utils/formatters';

export default function Receipt({
  type = 'reservation', // 'reservation' | 'service'
  receiptData,
  className = '',
}) {
  if (!receiptData) return null;

  const isReservation = type === 'reservation';

  // Build receipt number prefix
  const receiptNumber = isReservation
    ? `RSV-${String(receiptData.reservation_id || receiptData.id || 0).padStart(6, '0')}`
    : `SVC-${String(receiptData.booking_id || receiptData.id || 0).padStart(6, '0')}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`bg-bg-card border border-bg-border rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-accent-blue/10 to-status-sold/10 p-6 border-b border-bg-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {isReservation ? 'Reservation Receipt' : 'Service Booking Receipt'}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {receiptNumber}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-status-available/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-status-available" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>

        <p className="text-[11px] text-text-muted">
          ⚠️ Demo project — no real money was charged
        </p>
      </div>

      {/* Receipt details */}
      <div className="p-6 space-y-4">
        {/* Vehicle / Service info */}
        {isReservation && receiptData.vehicle && (
          <div className="flex items-start gap-4 pb-4 border-b border-bg-border">
            {receiptData.vehicle.main_image_url ? (
              <img
                src={receiptData.vehicle.main_image_url}
                alt={`${receiptData.vehicle.year} ${receiptData.vehicle.make} ${receiptData.vehicle.model}`}
                className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-16 bg-bg-elevated rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125M3.375 14.25h10.5" />
                </svg>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {receiptData.vehicle
                  ? `${receiptData.vehicle.year} ${receiptData.vehicle.make} ${receiptData.vehicle.model}`
                  : 'Vehicle'}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {receiptData.vehicle?.color && `${receiptData.vehicle.color} · `}
                {receiptData.vehicle?.fuel_type && `${receiptData.vehicle.fuel_type} · `}
                {receiptData.vehicle?.transmission}
              </p>
            </div>
          </div>
        )}

        {!isReservation && receiptData.service_type && (
          <div className="pb-4 border-b border-bg-border">
            <h3 className="text-sm font-semibold text-text-primary">
              {receiptData.service_type}
            </h3>
            {receiptData.vehicle_label && (
              <p className="text-xs text-text-secondary mt-0.5">
                Vehicle: {receiptData.vehicle_label}
              </p>
            )}
          </div>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div>
            <p className="text-text-muted text-xs">Receipt Number</p>
            <p className="text-text-primary font-medium">{receiptNumber}</p>
          </div>

          {receiptData.reference_code && (
            <div>
              <p className="text-text-muted text-xs">Transaction Reference</p>
              <p className="text-text-primary font-mono text-xs">{receiptData.reference_code}</p>
            </div>
          )}

          <div>
            <p className="text-text-muted text-xs">Amount Paid</p>
            <p className="text-text-primary font-semibold text-accent-blue">{formatPrice(receiptData.deposit_amount || receiptData.fee_amount || 0)}</p>
          </div>

          {receiptData.balance_after != null && (
            <div>
              <p className="text-text-muted text-xs">Balance After</p>
              <p className="text-text-primary">{formatPrice(receiptData.balance_after)}</p>
            </div>
          )}

          {isReservation && receiptData.vehicle?.price && (
            <div>
              <p className="text-text-muted text-xs">Vehicle Price</p>
              <p className="text-text-primary">{formatPrice(receiptData.vehicle.price)}</p>
            </div>
          )}

          {isReservation && receiptData.vehicle?.price && receiptData.deposit_amount && (
            <div>
              <p className="text-text-muted text-xs">Balance Due at Showroom</p>
              <p className="text-text-primary font-semibold">
                {formatPrice(parseFloat(receiptData.vehicle.price) - parseFloat(receiptData.deposit_amount))}
              </p>
            </div>
          )}

          {isReservation && receiptData.hold_days && (
            <div>
              <p className="text-text-muted text-xs">Hold Period</p>
              <p className="text-text-primary">{receiptData.hold_days} days</p>
            </div>
          )}

          {isReservation && receiptData.expires_at && (
            <div>
              <p className="text-text-muted text-xs">Hold Until</p>
              <p className="text-text-primary">{formatDateTime(receiptData.expires_at)}</p>
            </div>
          )}

          <div>
            <p className="text-text-muted text-xs">Date</p>
            <p className="text-text-primary">{formatDateTime(receiptData.created_at)}</p>
          </div>

          <div>
            <p className="text-text-muted text-xs">Status</p>
            <p className="text-text-primary">{receiptData.status}</p>
          </div>
        </div>

        {/* Cancellation policy */}
        {isReservation && receiptData.status === 'Active' && (
          <div className="mt-4 p-3 bg-bg-elevated rounded-lg">
            <p className="text-xs text-text-secondary">
              <span className="font-medium text-text-primary">Cancellation Policy:</span>{' '}
              A 10% cancellation fee applies. You'll receive 90% of your deposit back to your
              AutoEdge Demo Bank account instantly.
            </p>
          </div>
        )}
      </div>

      {/* Footer with print button */}
      <div className="px-6 py-4 border-t border-bg-border bg-bg-elevated/50 flex items-center justify-between print:hidden">
        <p className="text-[10px] text-text-muted">
          AutoEdge Demo Bank • This is a simulated transaction for a demo project
        </p>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-primary bg-bg-card hover:bg-bg-border border border-bg-border rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12z" />
          </svg>
          Print Receipt
        </button>
      </div>
    </div>
  );
}
