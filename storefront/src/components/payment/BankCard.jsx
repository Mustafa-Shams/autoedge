/**
 * BankCard — gradient card showing bank name "AutoEdge Demo Bank",
 * masked number •••• •••• •••• XXXX (only card_last4),
 * account title (customer name), and current balance.
 * Per spec section 8.1.
 */
import { formatPrice } from '../../utils/formatters';

export default function BankCard({
  bankName = 'AutoEdge Demo Bank',
  cardLast4 = '****',
  customerName = 'Account Holder',
  balance = 0,
  compact = false,
  className = '',
}) {
  const maskedNumber = `•••• •••• •••• ${cardLast4}`;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="w-10 h-7 rounded bg-gradient-to-br from-accent-blue via-accent-blue/80 to-status-sold flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-3.5 text-white" viewBox="0 0 24 16" fill="currentColor">
            <rect x="0" y="0" width="24" height="16" rx="2" opacity="0" />
            <circle cx="8.5" cy="8" r="5" opacity="0.7" />
            <circle cx="15.5" cy="8" r="5" opacity="0.5" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-secondary truncate">{bankName} {maskedNumber}</p>
          <p className="text-sm font-semibold text-text-primary">Balance {formatPrice(balance)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-accent-blue via-accent-blue/80 to-status-sold text-white select-none ${className}`}>
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
      
      {/* Chip icon */}
      <div className="w-10 h-7 rounded bg-white/20 backdrop-blur mb-6 flex items-center justify-center">
        <svg className="w-6 h-4 text-white/70" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="22" height="14" rx="2" />
          <line x1="8" y1="1" x2="8" y2="15" />
          <line x1="16" y1="1" x2="16" y2="15" />
          <line x1="1" y1="5.5" x2="23" y2="5.5" />
          <line x1="1" y1="10.5" x2="23" y2="10.5" />
        </svg>
      </div>

      {/* Card number */}
      <p className="text-lg font-mono tracking-[0.2em] mb-6 opacity-90">
        {maskedNumber}
      </p>

      {/* Bottom row */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
            Account Holder
          </p>
          <p className="text-sm font-medium">{customerName}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
            Balance
          </p>
          <p className="text-xl font-bold">{formatPrice(balance)}</p>
        </div>
      </div>

      {/* Bank name */}
      <p className="absolute top-6 right-6 text-xs font-semibold opacity-70 tracking-wide">
        {bankName}
      </p>
    </div>
  );
}
