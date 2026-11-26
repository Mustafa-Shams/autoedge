import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { buyVehicle, getBankSummary, getPurchaseQuote } from '../../api/storeApi';
import { getCustomer } from '../../store/authStore';
import { formatPrice } from '../../utils/formatters';
import PinHint from '../../components/payment/PinHint';

export default function PurchaseCheckout() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const reservation = params.get('reservation');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [trade, setTrade] = useState(params.get('trade') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const customer = getCustomer()?.customer_id;
  const quote = useQuery({
    queryKey: ['checkout', customer, id, reservation, trade],
    queryFn: async () => {
      const [offer, bank] = await Promise.all([getPurchaseQuote(id, reservation, trade), getBankSummary()]);
      return { ...offer.data, balance: bank.data.balance };
    }, retry: false,
  });
  const offer = quote.data;

  async function pay(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const keyName = `purchase:${customer}:${id}:${offer.reservation_id || 0}:${trade}:${offer.charge}`;
    try {
      const key = sessionStorage.getItem(keyName) || crypto.randomUUID();
      sessionStorage.setItem(keyName, key);
      const { data } = await buyVehicle({ vehicle_id: Number(id), reservation_id: offer.reservation_id,
        trade_in_id: offer.trade_in_id, expected_price: offer.price, expected_charge: offer.charge, password, idempotency_key: key });
      sessionStorage.removeItem(keyName);
      navigate(`/account/purchases#sale-${data.sale_id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Payment result unavailable. Check My purchases before retrying.');
      if (err.response?.status === 409) quote.refetch();
    } finally {
      setBusy(false);
    }
  }
  return <section className="max-w-xl space-y-5">
    <Link to="/account/purchases" className="text-accent-blue">My purchases</Link>
    <h1 className="text-2xl font-bold">Review purchase</h1>
    {quote.isPending && <p role="status">Loading the current price and wallet balance…</p>}
    {quote.isError && <p role="alert">{quote.error.response?.data?.detail || 'Checkout could not load.'} <button onClick={() => quote.refetch()} className="underline">Retry</button></p>}
    {quote.isError && trade && <button onClick={() => setTrade('')} className="underline">Remove trade-in</button>}
    {offer && !quote.isError && <form onSubmit={pay} className="space-y-4 rounded-xl border border-bg-border bg-bg-card p-5">
      <h2 className="text-xl font-semibold">{offer.vehicle}</h2>
      {offer.pending_trades?.map(t => <p key={t.id}>Trade-in #{t.id} · pending credit {formatPrice(t.value)}. Your balance updates after verified intake and selection.</p>)}
      {offer.trade_ins?.length > 0 && <label className="block">Trade-in<select className="block w-full rounded-lg bg-bg-elevated p-2" value={trade} onChange={e => setTrade(e.target.value)}>
        <option value="">Continue without trade-in</option>{offer.trade_ins.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>}
      <dl className="space-y-2">{[['Vehicle price', offer.price], ['Paid deposit', offer.deposit], ['Verified trade-in credit', offer.trade_in_credit], ['Pay now', offer.charge], ['Demo wallet balance', offer.balance]].map(([label, amount]) =>
        <div className="flex justify-between" key={label}><dt>{label}</dt><dd>{formatPrice(amount)}</dd></div>)}</dl>
      <p>Collect at the showroom. Staff will verify the car’s VIN at handover.</p>
      <p>Cancellation before pickup requires manager approval. Your demo wallet receives 20% of the total paid, including your deposit.</p>
      {offer.trade_in_id && <p>Both parties must agree to return your trade-in. Its value is excluded from the cash and wallet refund.</p>}
      {Number(offer.excess_at_pickup) > 0 && <p>Separately agreed payment to you at pickup · {formatPrice(offer.excess_at_pickup)}</p>}
      {Number(offer.balance) < Number(offer.charge) && <Link className="block text-accent-blue" to="/account/bank">Add funds to your demo wallet</Link>}
      <label className="block">Confirm your account password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full rounded-lg border border-bg-border bg-bg-elevated p-2" /></label>
      <PinHint />
      <button disabled={busy || quote.isFetching || Number(offer.balance) < Number(offer.charge)} className="rounded-xl bg-[#285bcf] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Processing…' : `Pay ${formatPrice(offer.charge)} and reserve pickup`}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
