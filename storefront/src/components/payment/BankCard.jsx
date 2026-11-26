import { formatPrice } from '../../utils/formatters';

export default function BankCard({
  bankName = 'AutoEdge Demo Bank', cardLast4, customerName, balance = 0, compact = false, className = '',
}) {
  return (
    <div className={`${compact ? 'space-y-1' : 'rounded-xl border border-bg-border bg-bg-card p-6 space-y-2'} ${className}`}>
      <p className="text-sm text-text-secondary">{bankName}{cardLast4 && ` · Ending in ${cardLast4}`}</p>
      <p className="text-sm text-text-secondary">Available balance</p>
      <p className={`font-bold text-text-primary ${compact ? 'text-lg' : 'text-3xl'}`}>{formatPrice(balance)}</p>
      {!compact && customerName && <p className="text-sm text-text-secondary">{customerName}</p>}
    </div>
  );
}
