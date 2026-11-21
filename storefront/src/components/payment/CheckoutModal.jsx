/**
 * CheckoutModal — reservation checkout per spec 8.3-8.4.
 * Order summary, hold period selector (7/14/21/30 days), car details,
 * deposit calculation (10%), "Pay from AutoEdge Demo Bank" with masked card,
 * password confirm field, "Demo project — no real money" note,
 * Pay button with idempotency_key UUID generated on modal open.
 * 
 * Processing sequence: after clicking Pay show ProcessingSteps
 * (cosmetic, backend call runs at the same time). Disable button
 * and send a fresh idempotency_key.
 * 
 * Failure states: insufficient funds (402), incorrect password (401),
 * out of stock (409).
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as storeApi from '../../api/storeApi';
import BankCard from './BankCard';
import ProcessingSteps from './ProcessingSteps';
import PasswordField from '../forms/PasswordField';
import { formatPrice } from '../../utils/formatters';

const HOLD_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 21, label: '21 days' },
  { days: 30, label: '30 days' },
];

const DEPOSIT_PERCENT = 10; // spec: 10% of vehicle price

function generateIdempotencyKey() {
  // Generate a UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CheckoutModal({
  isOpen,
  onClose,
  vehicle,
  onSuccess,
}) {
  const navigate = useNavigate();
  const overlayRef = useRef(null);

  // State
  const [holdDays, setHoldDays] = useState(14);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('form'); // 'form' | 'processing' | 'success' | 'error'
  const [bankSummary, setBankSummary] = useState(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [reservationResult, setReservationResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Generate a fresh idempotency key when modal opens (spec: UUID created on modal open)
  const idempotencyKey = useMemo(() => {
    if (isOpen) return generateIdempotencyKey();
    return '';
  }, [isOpen]);

  // Fetch bank summary when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setPhase('form');
    setPassword('');
    setError('');
    setReservationResult(null);
    setSubmitting(false);
    setLoadingBank(true);

    storeApi.getBankSummary()
      .then((res) => setBankSummary(res.data))
      .catch(() => setBankSummary(null))
      .finally(() => setLoadingBank(false));
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape' && phase === 'form') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, phase, onClose]);

  if (!isOpen || !vehicle) return null;

  const price = parseFloat(vehicle.price);
  const deposit = Math.round(price * DEPOSIT_PERCENT) / 100;
  const balanceDueAtShowroom = price - deposit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || phase !== 'form') return;

    if (!password.trim()) {
      setError('Please enter your account password to confirm.');
      return;
    }

    setError('');
    setSubmitting(true);
    setPhase('processing');

    try {
      const res = await storeApi.createReservation({
        vehicle_id: vehicle.vehicle_id,
        hold_days: holdDays,
        password: password.trim(),
        idempotency_key: idempotencyKey,
      });

      setReservationResult(res.data);
      // ProcessingSteps will call onProcessingComplete when animation finishes
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || '';

      if (status === 401) {
        setError('Incorrect password. Please try again.');
      } else if (status === 402) {
        setError(detail || 'Payment declined — insufficient funds.');
      } else if (status === 409) {
        setError(detail || 'This car was just reserved or sold out.');
      } else if (status === 422) {
        const msg = err.response?.data?.detail;
        if (Array.isArray(msg)) {
          setError(msg.map((m) => m.msg || m.message || JSON.stringify(m)).join('; '));
        } else {
          setError(detail || 'Invalid request. Please check your inputs.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }

      setPhase('form');
      setSubmitting(false);
    }
  };

  const handleProcessingComplete = () => {
    setPhase('success');
  };

  const handleGoToReceipt = () => {
    if (reservationResult) {
      navigate(`/account/receipts/reservation/${reservationResult.reservation_id}`);
    }
    onClose();
  };

  const handleGoToReservations = () => {
    navigate('/account/reservations');
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === overlayRef.current && phase === 'form') onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="bg-bg-card border border-bg-border rounded-2xl shadow-2xl max-w-lg w-full my-4">
        {/* ── FORM PHASE ────────────────────────────────────────── */}
        {phase === 'form' && (
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-bg-border">
              <h2 id="checkout-modal-title" className="text-lg font-bold text-text-primary">
                Reserve Vehicle
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-elevated transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Car summary */}
              <div className="flex items-start gap-4">
                {vehicle.main_image_url ? (
                  <img
                    src={vehicle.main_image_url}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
                  />
                ) : (
                  <div className="w-24 h-16 bg-bg-elevated rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125M3.375 14.25h10.5" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {vehicle.color && `${vehicle.color} · `}
                    {vehicle.fuel_type && `${vehicle.fuel_type} · `}
                    {vehicle.transmission}
                  </p>
                  <p className="text-lg font-bold text-accent-blue mt-1">
                    {formatPrice(price)}
                  </p>
                </div>
              </div>

              {/* Hold period selector */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Hold Period
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {HOLD_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setHoldDays(opt.days)}
                      className={`py-2 text-sm font-medium rounded-lg border transition-colors ${
                        holdDays === opt.days
                          ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                          : 'border-bg-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-bg-border'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order summary */}
              <div className="bg-bg-elevated rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Vehicle Price</span>
                  <span className="text-text-primary">{formatPrice(price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Deposit ({DEPOSIT_PERCENT}%)</span>
                  <span className="text-accent-blue font-semibold">{formatPrice(deposit)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-bg-border">
                  <span className="text-text-secondary">Balance due at showroom</span>
                  <span className="text-text-primary font-medium">{formatPrice(balanceDueAtShowroom)}</span>
                </div>
              </div>

              {/* Payment method — bank card compact */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Pay from
                </label>
                {loadingBank ? (
                  <div className="flex items-center gap-2 p-3 bg-bg-elevated rounded-lg">
                    <div className="w-4 h-4 border-2 border-bg-border border-t-accent-blue rounded-full animate-spin" />
                    <span className="text-sm text-text-muted">Loading bank account…</span>
                  </div>
                ) : bankSummary ? (
                  <div className="p-3 bg-bg-elevated rounded-lg">
                    <BankCard
                      bankName="AutoEdge Demo Bank"
                      cardLast4={bankSummary.card_last4}
                      customerName={bankSummary.customer_name || 'Account Holder'}
                      balance={parseFloat(bankSummary.balance)}
                      compact
                    />
                    {parseFloat(bankSummary.balance) < deposit && (
                      <p className="mt-2 text-xs text-status-cancelled flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        Insufficient funds — you need {formatPrice(deposit)} but have {formatPrice(bankSummary.balance)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-status-cancelled p-3 bg-bg-elevated rounded-lg">
                    Unable to load bank account. Please try again.
                  </p>
                )}
              </div>

              {/* Password confirmation */}
              <PasswordField
                id="checkout-password"
                name="password"
                label="Confirm with your account password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter your password"
                error=""
                required
                autoComplete="current-password"
              />
              <p className="text-xs text-text-muted mt-1">
                Use your login password. <a href="/account/bank" className="text-accent-blue hover:underline">View card details →</a>
              </p>

              {/* Error message */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg">
                  <svg className="w-4 h-4 text-status-cancelled flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div className="text-sm text-status-cancelled">
                    <p>{error}</p>
                    {error.includes('insufficient funds') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate('/account/bank');
                          onClose();
                        }}
                        className="mt-1 text-accent-blue hover:text-accent-blue-hover text-xs underline"
                      >
                        Top up demo balance →
                      </button>
                    )}
                    {(error.includes('reserved') || error.includes('sold out') || error.includes('stock')) && (
                      <button
                        type="button"
                        onClick={() => {
                          // TODO: restock request in P41
                          onClose();
                        }}
                        className="mt-1 text-accent-blue hover:text-accent-blue-hover text-xs underline"
                      >
                        Request this car →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Demo note (Article XVIII) */}
              <p className="text-[11px] text-text-muted text-center">
                ⚠️ Demo project — no real money is being charged. This is a simulated bank transaction.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 p-6 border-t border-bg-border">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-border rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loadingBank || !bankSummary}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue-hover rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>Pay {formatPrice(deposit)}</>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── PROCESSING PHASE ──────────────────────────────────── */}
        {phase === 'processing' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-text-primary text-center mb-2">
              Processing Payment
            </h2>
            <p className="text-sm text-text-secondary text-center mb-4">
              Please wait while we process your reservation…
            </p>
            <ProcessingSteps onComplete={handleProcessingComplete} />
          </div>
        )}

        {/* ── SUCCESS PHASE ─────────────────────────────────────── */}
        {phase === 'success' && reservationResult && (
          <div className="p-6">
            {/* Success icon */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-status-available/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-status-available" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-text-primary">Reservation Confirmed!</h2>
              <p className="text-sm text-text-secondary mt-1">
                Your vehicle has been reserved successfully.
              </p>
            </div>

            {/* Receipt summary */}
            <div className="bg-bg-elevated rounded-xl p-4 space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Receipt Number</span>
                <span className="text-text-primary font-mono">
                  RSV-{String(reservationResult.reservation_id).padStart(6, '0')}
                </span>
              </div>
              {reservationResult.reference_code && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Transaction Ref</span>
                  <span className="text-text-primary font-mono text-xs">{reservationResult.reference_code}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Amount</span>
                <span className="text-accent-blue font-semibold">{formatPrice(reservationResult.deposit_amount)}</span>
              </div>
              {reservationResult.balance_after != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">New Balance</span>
                  <span className="text-text-primary">{formatPrice(reservationResult.balance_after)}</span>
                </div>
              )}
              {reservationResult.expires_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Hold Until</span>
                  <span className="text-text-primary">
                    {new Date(reservationResult.expires_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Demo note */}
            <p className="text-[11px] text-text-muted text-center mb-6">
              ⚠️ Demo project — no real money was charged
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleGoToReceipt}
                className="flex-1 py-2.5 text-sm font-medium text-text-primary bg-bg-elevated hover:bg-bg-border border border-bg-border rounded-xl transition-colors"
              >
                View Receipt
              </button>
              <button
                onClick={() => {
                  handleGoToReservations();
                  onSuccess?.();
                }}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue-hover rounded-xl transition-colors shadow-lg shadow-accent-blue/20"
              >
                My Reservations
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
