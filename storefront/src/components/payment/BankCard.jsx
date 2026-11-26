/**
 * BankCard — demo card. Full variant flips (click, Enter or Space) to show the demo CVV and PIN help;
 * the eye button reveals the full account number when the owner's card details are loaded.
 * Compact variant is a one-line balance summary for payment forms.
 */
import { useState } from 'react';
import { formatPrice } from '../../utils/formatters';

const Icon = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    {d.map((path) => <path key={path} strokeLinecap="round" strokeLinejoin="round" d={path} />)}
  </svg>
);
const EYE = ['M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z',
  'M15 12a3 3 0 11-6 0 3 3 0 016 0z'];
const EYE_OFF = ['M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88'];
const FLIP = ['M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99'];

export default function BankCard({
  bankName = 'AutoEdge Demo Bank',
  cardLast4,
  customerName = 'Account Holder',
  balance = 0,
  compact = false,
  className = '',
  accountNumber,
  demoCvv,
}) {
  const [flipped, setFlipped] = useState(false);
  const [showFullNumber, setShowFullNumber] = useState(false);
  const masked = `•••• •••• •••• ${cardLast4 || '••••'}`;
  const number = showFullNumber && accountNumber ? accountNumber : masked;

  if (compact) {
    return (
      <div className={`space-y-1 ${className}`}>
        <p className="text-sm text-text-secondary">{bankName}{cardLast4 && ` · Ending in ${cardLast4}`}</p>
        <p className="text-sm text-text-secondary">Available balance</p>
        <p className="text-lg font-bold text-text-primary">{formatPrice(balance)}</p>
      </div>
    );
  }

  const face = 'absolute inset-0 overflow-hidden rounded-2xl p-6 text-white';
  return (
    <div className={className}>
      <div className="relative h-52" style={{ perspective: '1000px' }}>
        <div
          className="relative h-full w-full"
          style={{ transformStyle: 'preserve-3d', transition: 'transform 0.6s',
                   transform: flipped ? 'rotateY(180deg)' : 'none' }}
        >
          {/* Front */}
          <div className={`${face} bg-gradient-to-br from-card-front to-card-front-end`}
               style={{ backfaceVisibility: 'hidden' }} aria-hidden={flipped}>
            <p className="absolute top-6 right-6 text-xs font-semibold tracking-wide">{bankName}</p>
            <div className="w-10 h-7 rounded bg-white/25 mb-6" aria-hidden="true" />
            <div className="flex items-center gap-2 mb-6">
              <p className="text-lg font-mono tracking-[0.15em]" aria-label="Account number">{number}</p>
              {accountNumber && (
                <button type="button" tabIndex={flipped ? -1 : 0}
                  onClick={() => setShowFullNumber((v) => !v)}
                  className="p-1.5 rounded hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label={showFullNumber ? 'Hide full account number' : 'Show full account number'}
                  aria-pressed={showFullNumber}>
                  <Icon d={showFullNumber ? EYE_OFF : EYE} />
                </button>
              )}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/80">Account holder</p>
                <p className="text-sm font-medium">{customerName}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-white/80">Balance</p>
                <p className="text-xl font-bold">{formatPrice(balance)}</p>
              </div>
            </div>
          </div>

          {/* Back */}
          <div className={`${face} bg-gradient-to-br from-bg-elevated to-bg-primary border border-bg-border flex flex-col justify-center`}
               style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} aria-hidden={!flipped}>
            <p className="absolute top-6 right-6 text-xs font-semibold tracking-wide">{bankName}</p>
            <div className="mb-4 inline-block self-start bg-white/10 border border-white/30 rounded-lg px-4 py-2">
              <p className="text-[11px] uppercase tracking-wider text-white/80">Demo CVV</p>
              <p className="text-xl font-mono font-bold tracking-[0.3em]">{demoCvv || '•••'}</p>
            </div>
            <p className="text-sm"><span className="font-semibold">PIN:</span> your AutoEdge login password</p>
            <p className="text-xs text-white/80 mt-1">Asked when you pay a deposit, buy a car or pay a service booking fee.</p>
          </div>
        </div>
      </div>
      <button type="button" onClick={() => setFlipped((v) => !v)} aria-pressed={flipped}
        className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue rounded">
        <Icon d={FLIP} />
        {flipped ? 'Show card front' : 'Flip card to see CVV and PIN'}
      </button>
    </div>
  );
}
