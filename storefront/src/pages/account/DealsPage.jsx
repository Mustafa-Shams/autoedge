import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../api/axiosInstance';
import useAuth from '../../hooks/useAuth';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const base = '/account/deals';
const endpoint = '/store/deals';

export default function DealsPage() {
  const { id } = useParams();
  const [linkError, setLinkError] = useState('');
  const [linking, setLinking] = useState(false);
  const [params, setParams] = useSearchParams();
  const viewer = useAuth().customer?.customer_id;
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  const query = useQuery({ queryKey: ['deal-history', viewer, id, offset],
    queryFn: async () => (await api.get(id ? endpoint + '/' + id : endpoint, { params: { offset } })).data });
  if (query.isPending) return <p role="status">Loading deals…</p>;
  if (query.isError) return <p role="alert">Could not load this deal history. <button className="underline" onClick={() => query.refetch()}>Retry</button></p>;
  const data = query.data;
  if (!id) return <section className="space-y-4"><h1 className="text-2xl font-bold">Deals</h1>
    {!data.items.length && <p>No vehicle deals on this page.</p>}
    {data.items.map(d => <Link className="block rounded-xl border border-bg-border bg-bg-card p-4" key={d.id} to={base + '/' + d.id}>
      <strong>Deal #{d.id} · {d.vehicle}</strong><span className="block">{d.customer} · {d.stage}</span></Link>)}
    <nav className="flex gap-4">{offset > 0 && <button className="underline" onClick={() => setParams({offset: Math.max(0,offset-50)})}>Previous</button>}
      {data.more && <button className="underline" onClick={() => setParams({offset: offset+50})}>Next</button>}</nav></section>;
  return <section className="space-y-5">
    <Link className="underline" to={base}>All deals</Link>
    <header><h1 className="text-2xl font-bold">Deal #{data.id} · {data.vehicle}</h1>
      <p>{data.customer} · {data.stage}</p>
      {data.sales_contact && <p>Sales contact · {data.sales_contact}</p>}</header>
    <section className="space-y-3 rounded-xl border border-bg-border bg-bg-card p-4"><h2 className="font-semibold">{data.next_action}</h2>
      <dl>{[['Vehicle price',data.price],['Deposit paid',data.deposit],['Verified trade-in credit',data.credit],['Remaining balance', data.due],['Refund if hold is cancelled',data.refund]].filter(([,v]) => v != null).map(([k,v]) =>
        <div key={k} className="flex justify-between gap-4"><dt>{k}</dt><dd>{money.format(v)}</dd></div>)}</dl>
      {data.expires_at && <p>Hold expires {new Date(data.expires_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'long'})}</p>}
      {data.credits.map(t => <p key={t.id}>Trade-in #{t.id} · {t.status} · {money.format(t.value)}</p>)}
      <nav className="flex flex-wrap gap-4">{data.links.map(l => <Link key={l.path} className="font-semibold underline" to={l.path}>{l.label}</Link>)}</nav></section>
    {data.unlinked_enquiries?.length > 0 && <form className="space-y-2" onSubmit={async event => {
      event.preventDefault();
      const enquiry = new FormData(event.currentTarget).get('enquiry');
      setLinking(true);
      setLinkError('');
      try { await api.post(endpoint + '/' + id + '/enquiries/' + enquiry); await query.refetch(); }
      catch { setLinkError("Could not link this enquiry. Refresh the deal and try again."); }
      finally { setLinking(false); }
    }}>
      <label className="block">Link an earlier general enquiry<select required name="enquiry" defaultValue="" className="block w-full rounded bg-bg-elevated p-2">
        <option value="" disabled>Choose a conversation</option>{data.unlinked_enquiries.map(e => <option key={e.id} value={e.id}>#{e.id} · {e.subject}</option>)}</select></label>
      <button disabled={linking} className="underline">Link conversation</button>
      {linkError && <p role="alert">{linkError}</p>}
    </form>}
    <h2 className="text-lg font-semibold">Deal history</h2>
    <ol className="space-y-3">{data.events.map((e,i) => <li key={i} className="rounded-lg border border-bg-border p-3">
      <time dateTime={e.at} className="text-sm text-text-secondary">{new Date(e.at).toLocaleString()}</time>
      <p className="font-semibold">{e.path ? <Link className="underline" to={e.path}>{e.title}</Link> : e.title}</p>
      <p className="whitespace-pre-wrap break-words">{e.detail}</p></li>)}</ol>
    {!data.events.length && <p>No dated activity to display.</p>}
  </section>;
}
