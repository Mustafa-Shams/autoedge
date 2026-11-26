import ModalOverlay from '../common/ModalOverlay';
import { useQuery } from '@tanstack/react-query';
import useAuth from '../../hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as storeApi from '../../api/storeApi';
import BankCard from './BankCard';
import PasswordField from '../forms/PasswordField';
import PinHint from './PinHint';
import { formatPrice } from '../../utils/formatters';

const HOLD_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 21, label: '21 days' },
  { days: 30, label: '30 days' },
];



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

  // State
  const [holdDays, setHoldDays] = useState(14);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('form'); // 'form' | 'processing' | 'success' | 'error'
  const [bankSummary, setBankSummary] = useState(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const { customer } = useAuth();
  const quote = useQuery({
    queryKey: ['hold-terms', customer?.customer_id, vehicle?.vehicle_id, holdDays, isOpen],
    enabled: Boolean(isOpen && vehicle),
    queryFn: async () => (await storeApi.getHoldQuote(vehicle.vehicle_id, holdDays)).data,
    refetchOnWindowFocus: false,
  });
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
    setSubmitting(false);
    setLoadingBank(true);

    storeApi.getBankSummary()
      .then((res) => setBankSummary(res.data))
      .catch(() => setBankSummary(null))
      .finally(() => setLoadingBank(false));
  }, [isOpen]);



  if (!isOpen || !vehicle) return null;

  const terms = quote.data;
  const price = Number(terms?.price ?? vehicle.price);
  const deposit = Number(terms?.deposit ?? 0);
  const balanceDueAtShowroom = price - deposit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !terms || quote.isFetching || phase !== 'form') return;

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
        password,
        quote_token: terms.token,
        idempotency_key: idempotencyKey,
      });

      onSuccess?.();
      onClose();
      navigate(`/account/deals/${res.data.deal_id}`);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || '';

      if (status === 401) {
        setError('Incorrect password. Please try again.');
      } else if (status === 402) {
        setError(detail || 'Payment declined — insufficient funds.');
      } else if (status === 409) {
        quote.refetch();
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

  return (
    <ModalOverlay onDismiss={phase === 'processing' ? undefined : onClose} aria-label="Reservation checkout"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase === 'form') onClose();
      }}
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

              {quote.isError && <p role="alert">Could not load hold terms. <button type="button" className="underline" onClick={() => quote.refetch()}>Retry</button></p>}
              {quote.isFetching && <p role="status">Loading hold terms…</p>}
              {terms && <>
              <div className="bg-bg-elevated rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Vehicle Price</span>
                  <span className="text-text-primary">{formatPrice(price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Reservation deposit</span>
                  <span className="text-accent-blue font-semibold">{formatPrice(deposit)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-bg-border">
                  <span className="text-text-secondary">Purchase balance after deposit</span>
                  <span className="text-text-primary font-medium">{formatPrice(balanceDueAtShowroom)}</span>
                </div>
              </div>

              <p>Hold expires {new Date(terms.expires_at).toLocaleString(undefined, {dateStyle:'full', timeStyle:'long'})}.</p>
              <p>Cancel this hold before purchase and your demo wallet receives {formatPrice(terms.refund)}. The cancellation fee is {formatPrice(deposit - Number(terms.refund))}.</p></>}
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
              <PinHint />

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
                disabled={submitting || loadingBank || !bankSummary || !terms || quote.isFetching || quote.isError}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-accent-blue-strong hover:bg-accent-blue-strong-hover rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>{terms ? `Pay ${formatPrice(deposit)}` : "Loading quote…"}</>
                )}
              </button>
            </div>
          </form>
        )}

        {phase === 'processing' && <p className="p-6" role="status">Processing reservation payment…</p>}
      </div>
    </ModalOverlay>
  );
}
