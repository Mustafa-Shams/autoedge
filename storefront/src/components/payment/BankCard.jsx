/**
 * BankCard — 3D-flipping gradient card showing bank name, masked/full number,
 * account holder, balance. Back shows demo CVV & password hint.
 * Per spec section 8.1 (enhanced).
 */
import { useState } from 'react';
import { formatPrice } from '../../utils/formatters';

export default function BankCard({
  bankName = 'AutoEdge Demo Bank',
  cardLast4 = '****',
  customerName = 'Account Holder',
  balance = 0,
  compact = false,
  className = '',
  accountNumber,
  demoCvv,
}) {
  const [flipped, setFlipped] = useState(false);
  const [showFullNumber, setShowFullNumber] = useState(false);

  const maskedNumber = `•••• •••• •••• ${cardLast4}`;
  const displayNumber = showFullNumber && accountNumber ? accountNumber : maskedNumber;

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
    <div
      className={`${className}`}
      style={{ perspective: '1000px' }}
    >
      <div
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'relative',
        }}
      >
        {/* ── FRONT ──────────────────────────────────────────── */}
        <div
          onClick={() => setFlipped(!flipped)}
          className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-accent-blue via-accent-blue/80 to-status-sold text-white select-none cursor-pointer"
          style={{ backfaceVisibility: 'hidden' }}
        >
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

          {/* Card number + eye toggle */}
          <div className="flex items-center gap-2 mb-6">
            <p className="text-lg font-mono tracking-[0.2em] opacity-90">
              {displayNumber}
            </p>
            {accountNumber && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullNumber(!showFullNumber);
                }}
                className="p-1 rounded hover:bg-white/20 transition-colors"
                aria-label={showFullNumber ? 'Hide full number' : 'Show full number'}
              >
                {showFullNumber ? (
                  /* Eye-off icon */
                  <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  /* Eye icon */
                  <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            )}
          </div>

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

          {/* Flip hint */}
          <p className="absolute bottom-2 right-4 text-[9px] opacity-40 italic">
            (tap to flip)
          </p>
        </div>

        {/* ── BACK ───────────────────────────────────────────── */}
        <div
          onClick={() => setFlipped(!flipped)}
          className="absolute inset-0 overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white select-none cursor-pointer flex flex-col justify-center"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

          {/* CVV box */}
          <div className="mb-4">
            <div className="inline-block bg-white/10 border border-white/20 rounded-lg px-4 py-2">
              <p className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">Demo CVV</p>
              <p className="text-xl font-mono font-bold tracking-[0.3em]">123</p>
            </div>
          </div>

          {/* Password hint */}
          <p className="text-sm opacity-80 mb-1">
            <span className="font-semibold">Account Password:</span> Use your login password
          </p>

          {/* Bank name */}
          <p className="absolute top-6 right-6 text-xs font-semibold opacity-70 tracking-wide">
            {bankName}
          </p>

          {/* Flip back hint */}
          <p className="absolute bottom-2 right-4 text-[9px] opacity-40 italic">
            (tap to flip back)
          </p>
        </div>
      </div>
    </div>
  );
}
