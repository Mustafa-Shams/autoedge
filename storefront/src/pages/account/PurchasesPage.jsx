import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getPurchases, openPurchaseConversation, requestPurchaseCancellation } from '../../api/storeApi';
import { getCustomer } from '../../store/authStore';
import { formatPrice, formatDate, formatDateTime } from '../../utils/formatters';

export default function PurchasesPage() {
  const purchases = useQuery({ queryKey: ['purchases', getCustomer()?.customer_id], queryFn: async () => (await getPurchases()).data });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const navigate = useNavigate();
  const { hash } = useLocation();
  useEffect(() => {
    if (purchases.data && /^#sale-\d+$/.test(hash)) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    }
  }, [purchases.data, hash]);
  async function act(sale, action) {
    setPending(sale.sale_id);
    setError('');
    try {
      if (action === 'message') {
        const { data } = await openPurchaseConversation(sale.sale_id);
        navigate(`/account/enquiries/${data.enquiry_id}`);
      } else {
        await requestPurchaseCancellation(sale.sale_id, Boolean(sale.trade_in_id));
        await purchases.refetch();
      }
    }
    catch (err) { setError(err.response?.data?.detail || 'Request failed. Try again.'); }
    finally { setPending(null); }
  }
  return <section className="space-y-4">
    <h1 className="text-2xl font-bold">My purchases</h1>
    {purchases.isPending && <p role="status">Loading receipts…</p>}
    {purchases.isError && <p role="alert">Receipts could not load. <button onClick={() => purchases.refetch()} className="underline">Retry</button></p>}
    {error && <p role="alert">{error}</p>}
    {purchases.data?.length === 0 && <p>Your completed purchases will appear here. <Link to="/cars" className="text-accent-blue">Browse vehicles</Link></p>}
    {purchases.data?.map(s => <article key={s.sale_id} id={`sale-${s.sale_id}`} className="space-y-3 rounded-xl border border-bg-border bg-bg-card p-5">
      <h2 className="text-xl font-semibold">{s.vehicle}</h2>
      <p>{s.stage === 'Awaiting pickup' && s.refund_if_cancelled == null ? 'Awaiting payment verification' : s.stage} · {formatDate(s.date)} · Receipt {s.reference}</p>
      <dl className="grid grid-cols-2 gap-2">{[['Price',s.price], ['Discount',s.discount], ['Deposit applied',s.deposit], ['Trade-in credit',s.trade_in_credit], ['Wallet payment',s.wallet_charge], ...(s.refund_amount !== null ? [['Wallet refund',s.refund_amount]] : [])].map(([label,value]) =>
        <div key={label}><dt className="text-sm text-text-secondary">{label}</dt><dd>{formatPrice(value)}</dd></div>)}</dl>
      <Link className="block underline" to={`/account/deals/${s.deal_id}`}>Deal #{s.deal_id} history</Link>
      {s.reservation_id && <Link className="block text-accent-blue" to={`/account/receipts/reservation/${s.reservation_id}`}>View deposit receipt</Link>}
      {s.cash_received != null && <p>Showroom payment {formatPrice(s.cash_received)} · Confirmed financing {formatPrice(s.external_funding)}</p>}
      {s.balance_due != null && <p>Balance due {formatPrice(s.balance_due)}</p>}
      {s.stage === 'Awaiting pickup' && <p>{s.refund_requested ? 'Cancellation requested. Awaiting manager approval.' :
        s.refund_if_cancelled == null ? 'Showroom staff will confirm your payment before pickup.' :
        'Pick up at the showroom. Staff will verify your VIN before releasing the car.'}</p>}
      {s.stage === 'Awaiting pickup' && s.pickup_deadline && <p>Collect by {formatDateTime(s.pickup_deadline)}</p>}
      {s.stage === 'Awaiting pickup' && s.refund_if_cancelled != null && !s.refund_requested &&
        <details><summary className="cursor-pointer">Cancellation and refund terms</summary>
          <p className="my-2">Manager approval returns {formatPrice(s.refund_if_cancelled)} to your demo wallet, 20% of cash and wallet payments including the deposit.</p>
          {s.trade_in_id && <p>Your original trade-in #{s.trade_in_id} must be returned before either vehicle is released.</p>}
          <button disabled={pending === s.sale_id} onClick={() => act(s, 'cancel')} className="underline">{s.trade_in_id ? 'Agree to trade-in return and request cancellation' : 'Request cancellation'}</button>
        </details>}
      {s.enquiry_id ? <Link className="block text-accent-blue" to={`/account/enquiries/${s.enquiry_id}`}>Purchase messages</Link> :
        <button disabled={pending === s.sale_id} className="text-accent-blue" onClick={() => act(s, 'message')}>Message the showroom</button>}
      {s.vin && <p>Verified VIN {s.vin} · <Link to="/account/garage" className="text-accent-blue">View garage</Link></p>}
    </article>)}
  </section>;
}
